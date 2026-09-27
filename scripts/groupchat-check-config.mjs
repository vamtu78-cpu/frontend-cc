// 部署前检查 GROUPCHAT_CONFIG，并宽容处理手机备忘录里常见的问题，把规范好的 JSON 写到 argv[2]
// - 人设里直接回车换行（JSON 字符串里不允许）→ 自动转成 \n
import fs from 'node:fs';

const fail = (msg) => { console.log('::error::' + msg); process.exit(1); };

function escapeRawNewlines(raw){
  let out = '', inStr = false, esc = false;
  for(const ch of raw.replace(/^\uFEFF/, '')){
    if(!inStr){ if(ch === '"') inStr = true; out += ch; continue; }
    if(esc){ out += ch; esc = false; }
    else if(ch === '\\'){ out += ch; esc = true; }
    else if(ch === '"'){ out += ch; inStr = false; }
    else if(ch === '\n') out += '\\n';
    else if(ch === '\t') out += '\\t';
    else if(ch === '\r' || ch.charCodeAt(0) < 0x20) {}
    else out += ch;
  }
  return out;
}

const fixed = escapeRawNewlines(process.env.GROUPCHAT_CONFIG || '');
let c;
try { c = JSON.parse(fixed); }
catch(e){
  fail('GROUPCHAT_CONFIG 格式不对（多半是少了逗号，或者格式引号被手机换成了中文弯引号 “ ”）：' + e.message);
}
if(!c.roomPassword) fail('roomPassword（房间口令）不能为空');
if(!Array.isArray(c.bots) || !c.bots.length) fail('bots 里至少要有一个 AI');
for(const b of c.bots) for(const k of ['name', 'baseUrl', 'apiKey', 'model'])
  if(!b[k]) fail(`AI「${b.name || '?'}」缺少 ${k}`);

fs.writeFileSync(process.argv[2], JSON.stringify(c, null, 2), { mode: 0o600 });
console.log('配置 OK：AI = ' + c.bots.map(b => b.name).join('、'));
