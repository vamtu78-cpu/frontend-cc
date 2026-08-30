// 带记忆的中转：浏览器 → 本服务 → (Ombre Brain 记忆) + (DeepSeek 转发)
// 对 App 表现为一个 OpenAI 兼容接口：POST /chat/completions（也接受 /v1/chat/completions）
// 流程：breath 捞相关记忆 → 注入 system → 转发上游流式 → 结束后 hold 存回记忆
import express from 'express';
import cors from 'cors';

const PORT = process.env.PORT || 8787;
const OMBRE_URL = process.env.OMBRE_URL || 'http://ombre:8000/mcp';
const UPSTREAM_BASE = (process.env.UPSTREAM_BASE || 'https://api.deepseek.com').replace(/\/$/, '');
const MEMORY_ON = process.env.MEMORY_ON !== '0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

/* ================= 极简 MCP (streamable-http) 客户端 ================= */
let session = null, initialized = false;

async function rpc(method, params, id){
  const body = { jsonrpc: '2.0', method };
  if(id !== undefined) body.id = id;
  if(params) body.params = params;
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if(session) headers['mcp-session-id'] = session;
  const r = await fetch(OMBRE_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = r.headers.get('mcp-session-id'); if(sid) session = sid;
  if(id === undefined) return null; // 通知，无需响应
  const ct = r.headers.get('content-type') || '';
  if(ct.includes('text/event-stream')){
    const text = await r.text(); let found = null;
    for(const line of text.split('\n')){
      const t = line.trim(); if(!t.startsWith('data:')) continue;
      try { const j = JSON.parse(t.slice(5).trim()); if(j.id === id) found = j; } catch(e){}
    }
    return found;
  }
  return await r.json();
}

async function ensureInit(){
  if(initialized) return;
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ombre-mem-proxy', version: '1.0' }
  }, 1);
  await rpc('notifications/initialized', undefined, undefined);
  initialized = true;
}

async function callTool(name, args){
  try {
    await ensureInit();
    const resp = await rpc('tools/call', { name, arguments: args }, Date.now());
    if(resp && resp.result && Array.isArray(resp.result.content)){
      return resp.result.content.map(c => c.text || '').join('\n').trim();
    }
    return '';
  } catch(e){
    console.warn('[ombre] callTool 失败，降级无记忆：', name, e.message);
    initialized = false; session = null;   // 下次重连
    return '';
  }
}

/* ================= 聊天接口 ================= */
async function handleChat(req, res){
  const auth = req.headers['authorization'] || '';
  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages.slice() : [];

  // 取最后一条用户消息作为检索线索（内容可能是含图片的数组，取其中文字）
  const textOf = (c) => typeof c === 'string' ? c
    : Array.isArray(c) ? c.map(p => (p && p.type === 'text') ? p.text : '').join(' ').trim() : '';
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const query = lastUser ? textOf(lastUser.content) : '';

  // 1) 捞相关记忆
  let mem = '';
  if(MEMORY_ON && query){
    mem = await callTool('breath', { query, max_results: 4 });
  }

  // 2) 把记忆注入 system
  if(mem){
    const memBlock = '\n\n【记忆·Ombre Brain 检索到的相关往事】\n' + mem +
      '\n（以上是你自然记得的事，请像本来就记得一样自然地融入对话，不要生硬复述。）';
    if(messages[0] && messages[0].role === 'system'){
      messages[0] = { role: 'system', content: (messages[0].content || '') + memBlock };
    } else {
      messages.unshift({ role: 'system', content: '你拥有长期记忆。' + memBlock });
    }
  }

  // 3) 转发到上游（DeepSeek）流式
  let upstream;
  try {
    upstream = await fetch(UPSTREAM_BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': auth },
      body: JSON.stringify({ ...body, messages, stream: true })
    });
  } catch(e){
    res.status(502).json({ error: '上游连接失败: ' + e.message }); return;
  }
  if(!upstream.ok || !upstream.body){
    const t = await upstream.text().catch(() => '');
    res.status(upstream.status || 502).send(t || 'upstream error'); return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = '', assistant = '';
  try {
    while(true){
      const { value, done } = await reader.read(); if(done) break;
      const chunk = dec.decode(value, { stream: true });
      res.write(chunk);                         // 原样透传给 App
      buf += chunk;
      let idx;
      while((idx = buf.indexOf('\n')) >= 0){
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if(!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if(data === '[DONE]') continue;
        try { const j = JSON.parse(data); const d = j.choices?.[0]?.delta?.content; if(d) assistant += d; } catch(e){}
      }
    }
  } catch(e){ /* 客户端断开等 */ }
  res.end();

  // 4) 聊完把这轮存回记忆（不阻塞用户）
  if(MEMORY_ON && query && assistant){
    const digest = '用户说：' + query + '\n我回应：' + assistant;
    callTool('hold', { content: digest, importance: 5 }).catch(() => {});
  }
}

app.post('/chat/completions', handleChat);
app.post('/v1/chat/completions', handleChat);

app.get('/health', async (req, res) => {
  let ombre = 'unknown';
  try { const p = await callTool('pulse', {}); ombre = p ? 'ok' : 'no-reply'; } catch(e){ ombre = 'error'; }
  res.json({ status: 'ok', ombre, upstream: UPSTREAM_BASE, memory: MEMORY_ON });
});

app.listen(PORT, () => console.log('记忆中转已启动 :' + PORT + '  → Ombre ' + OMBRE_URL + '  上游 ' + UPSTREAM_BASE));
