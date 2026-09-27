# AI 群聊 💬

把**你、朋友、你的 AI、朋友的 AI**拉进同一个群里聊天。一个网址，两个人手机打开就能用。

- 两个 AI 可以用**不同的服务商/模型/人设**（只要是 OpenAI 兼容接口：Claude 中转、DeepSeek、OpenAI、各种中转都行）
- AI 回复**实时流式**显示，两边同时看到
- API key 只放在服务器上，网页里看不到，朋友也拿不到你的 key
- 聊天记录存在服务器，关掉再开还在

## AI 什么时候说话？

| 情况 | 谁回复 |
|---|---|
| 消息里 `@小克` | 只有被点名的 AI 回 |
| 没 @ 任何 AI | `autoReply: "all"` 时两个 AI 都接话（顺序随机）；设成 `"none"` 就都不说话 |
| AI 在回复里 @ 了另一个 AI | 被 @ 的 AI 接着聊，最多连续接力 `maxBotChain` 轮（防止俩 AI 聊到天荒地老烧钱） |
| 点「✋ 让 AI 停一下」 | 立刻打断正在说话的 AI，清空排队 |

## 部署（VPS 上，和记忆中转一样用 Docker）

```bash
cd frontend-cc/groupchat
cp config.example.json config.json
nano config.json        # 填口令、两个 AI 的地址/key/模型/人设
docker compose up -d --build
```

`config.json` 字段：

- `roomPassword`：进群口令，发给朋友就行（留空 = 谁拿到网址都能进，不建议，会烧你的 key）
- `bots[]`：每个 AI 一项
  - `name`：群里显示的名字，也是 @ 它用的名字
  - `owner`：主人名字，显示成「Vyre的AI」
  - `baseUrl`：接口地址，填到 `/v1` 就行（和 App 的「接口地址」一样）
  - `apiKey` / `model`：key 和模型名
  - `system`：人设，可以直接复制各自 App 里的系统提示词
  - `avatar` / `color`：头像 emoji 和气泡颜色

想让 AI 也带上 Ombre Brain 记忆？把 `baseUrl` 填成记忆中转的地址（`https://你的域名/mem`）就行。

### Nginx

给群聊单独一个子域名最省事（SSE 实时推送需要关缓冲）：

```nginx
server {
    listen 443 ssl;
    server_name group.你的域名.com;
    # ssl 证书用 certbot --nginx -d group.你的域名.com 自动配

    location / {
        proxy_pass http://127.0.0.1:8788;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Connection '';
        proxy_buffering off;          # 关键：不然 AI 回复不会一个字一个字出来
        proxy_read_timeout 1h;        # 关键：保持实时连接
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

然后把 `https://group.你的域名.com` 和口令发给朋友，各自起个昵称进来就能聊了 🎉

## 本地试一下

```bash
cd groupchat
cp config.example.json config.json   # 填好
node server.js                       # 打开 http://localhost:8788
```

## 常见问题

- **AI 回复「掉线了：HTTP 401」**：key 填错了；`HTTP 404` 一般是 `baseUrl` 少了或多了 `/v1`
- **消息要刷新才出来 / AI 回复一坨一坨地出**：Nginx 没加 `proxy_buffering off`
- **改了 config.json**：`docker compose restart` 生效
- **清空聊天记录**：`docker compose down && rm -rf data && docker compose up -d`
