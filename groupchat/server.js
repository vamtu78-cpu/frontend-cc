// AI 群聊：两个人 + 各自的 AI 在一个房间里聊天
// 零依赖（Node 20+ 自带 fetch），前端用 SSE 实时接收，AI 回复流式推送给所有人
// AI 接口统一按 OpenAI 兼容格式调用：POST {baseUrl}/chat/completions
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = process.env.CONFIG || path.join(DIR, 'config.json');
const DATA_FILE = process.env.DATA || path.join(DIR, 'data', 'messages.json');

if(!fs.existsSync(CONFIG_FILE)){
  console.error('找不到 config.json：请先 cp config.example.json config.json 并填好');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const PORT = process.env.PORT || cfg.port || 8788;
const PASSWORD = cfg.roomPassword || '';
const AUTO_REPLY = cfg.autoReply || 'all';        // all：没 @ 时所有 AI 都接话；none：只回被 @ 的
const MAX_CHAIN = cfg.maxBotChain ?? 3;           // AI 之间互相 @ 最多连续接力几轮，防止无限对聊
const CONTEXT = cfg.contextMessages || 40;        // 每次给 AI 看最近多少条
const KEEP = 1000;                                // 最多保存多少条历史
const bots = (cfg.bots || []).map((b, i) => ({ id: b.id || 'bot' + i, ...b }));
const publicBots = bots.map(({ id, name, owner, avatar, color }) => ({ id, name, owner, avatar, color }));

/* ================= 消息存储 ================= */
let messages = [];
try { messages = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch(e){}
let saveTimer = null;
function save(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages.filter(m => !m.streaming)));
  }, 300);
}
function addMessage(m){
  const msg = { id: crypto.randomUUID(), ts: Date.now(), ...m };
  messages.push(msg);
  if(messages.length > KEEP) messages = messages.slice(-KEEP);
  broadcast('msg', msg);
  save();
  return msg;
}

/* ================= SSE 广播 ================= */
const clients = new Set();
function broadcast(event, data){
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for(const res of clients) res.write(payload);
}
setInterval(() => { for(const res of clients) res.write(': ping\n\n'); }, 25000);

/* ================= AI 调度 ================= */
// 所有 AI 发言排成一个队列，一次只有一个在说话，保证顺序自然
const queue = [];
let running = false, stopFlag = false, currentAbort = null;

const mentioned = (text, bot) => text.includes('@' + bot.name);

function onNewMessage(msg, depth){
  let targets = bots.filter(b => b.id !== msg.botId && mentioned(msg.text, b));
  if(!targets.length && msg.role === 'human' && AUTO_REPLY === 'all'){
    targets = bots.slice().sort(() => Math.random() - 0.5);   // 顺序随机一点，更像群聊
  }
  if(msg.role === 'bot' && depth >= MAX_CHAIN) targets = [];
  for(const b of targets){
    if(!queue.some(q => q.bot.id === b.id)) queue.push({ bot: b, depth });
  }
  run();
}

async function run(){
  if(running) return;
  running = true;
  stopFlag = false;
  while(queue.length && !stopFlag){
    const { bot, depth } = queue.shift();
    const reply = await speak(bot);
    if(reply && !stopFlag) onNewMessage(reply, depth + 1);
  }
  queue.length = 0;
  running = false;
}

function buildPrompt(bot){
  const humans = [...new Set(messages.filter(m => m.role === 'human').map(m => m.name))];
  const others = bots.filter(b => b.id !== bot.id).map(b => `${b.name}（${b.owner || '某人'}的 AI）`);
  const system = (bot.system || '') + `

【群聊说明】你正在一个群聊里，你的名字是「${bot.name}」${bot.owner ? `，你是${bot.owner}的 AI` : ''}。
群里的人类：${humans.join('、') || '（暂无）'}；其他 AI：${others.join('、') || '（无）'}。
别人的消息格式是「【名字】内容」。你只以自己的身份说一次话，直接输出内容，不要加【${bot.name}】前缀，不要替别人说话。
像真人在群里聊天一样，简短自然，不必每句都回应。想让别的 AI 接话可以 @它的名字。`;

  const out = [];
  for(const m of messages.filter(m => !m.streaming).slice(-CONTEXT)){
    const mine = m.botId === bot.id;
    const role = mine ? 'assistant' : 'user';
    const content = mine ? m.text : `【${m.name}】${m.text}`;
    const last = out[out.length - 1];
    if(last && last.role === role) last.content += '\n' + content;   // 合并连续同角色，兼容严格交替的上游
    else out.push({ role, content });
  }
  if(!out.length || out[0].role !== 'user') out.unshift({ role: 'user', content: '（群聊开始）' });
  return [{ role: 'system', content: system }, ...out];
}

async function speak(bot){
  const msg = addMessage({ role: 'bot', botId: bot.id, name: bot.name, text: '', streaming: true });
  const abort = new AbortController();
  currentAbort = abort;
  const timer = setTimeout(() => abort.abort(), 180000);
  let text = '';
  try {
    const base = bot.baseUrl.replace(/\/$/, '');
    const url = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
    const r = await fetch(url, {
      method: 'POST',
      signal: abort.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + bot.apiKey },
      body: JSON.stringify({
        model: bot.model,
        messages: buildPrompt(bot),
        stream: true,
        max_tokens: bot.maxTokens || 1024,
        ...(bot.temperature != null ? { temperature: bot.temperature } : {})
      })
    });
    if(!r.ok || !r.body) throw new Error(`HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while(true){
      const { value, done } = await reader.read();
      if(done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while((idx = buf.indexOf('\n')) >= 0){
        const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
        if(!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if(data === '[DONE]') continue;
        try {
          const d = JSON.parse(data).choices?.[0]?.delta?.content;
          if(d){ text += d; broadcast('delta', { id: msg.id, text: d }); }
        } catch(e){}
      }
    }
  } catch(e){
    if(!stopFlag){
      console.warn(`[${bot.name}] 调用失败：`, e.message);
      text = text || `（${bot.name} 掉线了：${e.message}）`;
      msg.error = true;
    }
  } finally {
    clearTimeout(timer);
    currentAbort = null;
  }
  // 模型偶尔会自己加上【名字】前缀，去掉
  text = text.replace(new RegExp(`^\\s*【${bot.name}】\\s*`), '').trim();
  msg.text = text;
  delete msg.streaming;
  if(!text){
    messages = messages.filter(m => m.id !== msg.id);
    broadcast('remove', { id: msg.id });
    save();
    return null;
  }
  broadcast('done', msg);
  save();
  return msg.error ? null : msg;
}

/* ================= HTTP ================= */
const authed = (req, url) => !PASSWORD || (req.headers['x-room-key'] || url.searchParams.get('key')) === PASSWORD;

function readBody(req){
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if(s.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if(req.method === 'GET' && (p === '/' || p === '/index.html')){
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(DIR, 'public', 'index.html')).pipe(res);
    return;
  }
  if(!p.startsWith('/api/')) return json(res, 404, { error: 'not found' });
  if(!authed(req, url)) return json(res, 401, { error: '房间口令不对' });

  if(req.method === 'GET' && p === '/api/info'){
    return json(res, 200, { bots: publicBots, title: cfg.title || 'AI 群聊' });
  }
  if(req.method === 'GET' && p === '/api/events'){
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: history\ndata: ${JSON.stringify(messages.slice(-200))}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if(req.method === 'POST' && p === '/api/send'){
    let body;
    try { body = await readBody(req); } catch(e){ return json(res, 400, { error: 'bad json' }); }
    const name = String(body.name || '').trim().slice(0, 20);
    const text = String(body.text || '').trim().slice(0, 4000);
    if(!name || !text) return json(res, 400, { error: '名字和内容不能为空' });
    if(bots.some(b => b.name === name)) return json(res, 400, { error: '不能冒充 AI 的名字哦' });
    const msg = addMessage({ role: 'human', name, text });
    onNewMessage(msg, 0);
    return json(res, 200, { ok: true });
  }
  if(req.method === 'POST' && p === '/api/stop'){
    stopFlag = true;
    queue.length = 0;
    currentAbort?.abort();
    return json(res, 200, { ok: true });
  }
  json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log(`AI 群聊已启动 :${PORT}  AI：${bots.map(b => b.name).join('、') || '（未配置）'}`));
