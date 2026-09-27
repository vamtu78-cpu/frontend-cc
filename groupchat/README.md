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

## 部署（不用碰服务器，全在 GitHub 网页上点）

你的 VPS 早就和 GitHub 连好了（聊天 App 就是这么自动上线的），群聊走同一条路。**只需要做一件事：把配置贴进 GitHub。**

### 第一步：准备配置

复制下面这段，把**中文部分**换成你们自己的（引号、逗号别删）。两个 AI 的「接口地址 / key / 模型」就照抄各自 App 里「API 配置」填的那三样。

```json
{
  "title": "我们的小群 💬",
  "roomPassword": "你们俩约定的进群口令",
  "autoReply": "all",
  "maxBotChain": 3,
  "bots": [
    {
      "id": "mine",
      "name": "你的AI的名字",
      "owner": "Vyre",
      "avatar": "🌙",
      "color": "#9d8bff",
      "baseUrl": "你的接口地址",
      "apiKey": "你的key",
      "model": "你的模型名",
      "system": "你的AI的人设，写成一行；要换行就写 \n"
    },
    {
      "id": "hers",
      "name": "朋友的AI的名字",
      "owner": "朋友的名字",
      "avatar": "⭐",
      "color": "#ff8fab",
      "baseUrl": "朋友的接口地址",
      "apiKey": "朋友的key",
      "model": "朋友的模型名",
      "system": "朋友的AI的人设"
    }
  ]
}
```

> 这个仓库是**公开**的，所以 key 和人设绝对不要写进仓库文件里，只贴进下面的 Secret（加密保存，谁都看不到，包括 cc）。

### 第二步：贴进 GitHub

手机浏览器也能操作：

1. 打开仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点 **New repository secret**
3. Name 填 `GROUPCHAT_CONFIG`，Secret 粘贴上面改好的整段 → **Add secret**

### 第三步：触发部署

打开仓库 → **Actions** → 左边选 **Deploy group chat** → 点最近那一条 → 右上角 **Re-run jobs**（或者直接跟 cc 说一声）。

等一两分钟变成绿勾 ✅，群聊就上线了：**你聊天 App 的网址后面加 `/group/`**，比如 `https://chat.xxx.com/group/`。把网址和口令发给朋友就行 🎉

### 以后想改人设 / 换模型 / 换口令

回到第二步，点 `GROUPCHAT_CONFIG` 旁边的 ✏️ 重新贴一份，再 Re-run 一次就生效。聊天记录不会丢。

### 部署失败了？

点开红叉那一步看最后几行，会写清楚是哪儿不对：
- 「格式不对」：配置里少了逗号或引号，可以把配置（**先把 key 删掉**）发给 cc 帮你查
- 「没找到网站的 Nginx 配置」：截图发给 cc

<details><summary>自动部署具体做了什么（不用看）</summary>

`scripts/groupchat-remote.sh`：服务器没有 Node 就下载一份到 `/opt/groupchat/node`；把群聊注册成 systemd 服务 `groupchat`（端口 8788，开机自启、崩了自动重启）；在现有网站的 Nginx 配置里加一行 `include /etc/nginx/snippets/groupchat.conf`，把 `/group/` 反代过去（改之前会备份，`nginx -t` 不通过就自动恢复）。聊天记录在 `/opt/groupchat/data`。

</details>

### 手动部署（有 Docker 的话）

```bash
cd groupchat && cp config.example.json config.json && nano config.json
docker compose up -d --build     # 然后 Nginx 反代 127.0.0.1:8788，记得 proxy_buffering off
```

## 本地试一下

```bash
cd groupchat
cp config.example.json config.json   # 填好
node server.js                       # 打开 http://localhost:8788
```

## 常见问题

- **AI 回复「掉线了：HTTP 401」**：key 填错了；`HTTP 404` 一般是 `baseUrl` 少了或多了 `/v1`
- **消息要刷新才出来 / AI 回复一坨一坨地出**：Nginx 没加 `proxy_buffering off`
