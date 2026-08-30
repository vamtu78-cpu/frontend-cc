# 记忆中转（Ombre Brain + DeepSeek）部署

给聊天 App 加上「Ombre Brain 长期记忆」。**主聊天用 Claude；DeepSeek 只负责把记忆压缩/总结/打标签**（便宜）。App 本身几乎不用改——只要把「接口地址」指向这个后端即可。

```
你的手机 App
   │  接口地址 = https://你的域名/mem，密钥/模型 = Claude
   ▼
记忆中转 (本目录, :8787)
   ├─ 先向 Ombre Brain 捞相关记忆，注入对话
   ├─ 转发给 Claude，流式返回
   └─ 聊完把这轮存回 Ombre Brain
Ombre Brain (:8000, 记忆大脑) ── 总结/情绪标注/遗忘 用 DeepSeek
```

## 一、准备

在 VPS 上（需要已装 Docker + docker compose）：

```bash
# 进到项目的 server 目录（先把仓库 clone / pull 下来）
cd frontend-cc/server

# 1. 克隆 Ombre Brain 到这里
git clone https://github.com/P0lar1zzZ/Ombre-Brain.git

# 2. 配置
cp .env.example .env
nano .env
#   CHAT_UPSTREAM_BASE = 你原来在 App 里填的 Claude 接口地址（主聊天上游）
#   DEEPSEEK_KEY / DEEPSEEK_BASE = 给 Ombre Brain 做记忆总结用的 DeepSeek
```

## 二、启动

```bash
docker compose up -d --build
# 看日志确认
docker compose logs -f memproxy
```

自检：

```bash
curl http://127.0.0.1:8787/health
# 期望看到 {"status":"ok","ombre":"ok",...}；ombre 若是 error 见下方排错
```

## 三、Nginx 反代（把 /mem 指到记忆中转）

在你站点的 nginx server 块里加：

```nginx
location /mem/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Authorization $http_authorization;
    proxy_buffering off;            # 关键：流式输出不缓冲
    proxy_read_timeout 300s;
    client_max_body_size 25m;       # 关键：允许带图片的大请求，避免 413
}
```

> 图片上传如果报 **413 Request Entity Too Large**：多半是某个 nginx 的 `client_max_body_size` 太小（默认 1MB）。
> App 端已在上传前把图压到 1280px/JPEG，通常不会超；若仍报 413，就在**对应那台 nginx**（你的中转或本 /mem）的 server 或 location 里加 `client_max_body_size 25m;` 再 `systemctl reload nginx`。

```bash
nginx -t && systemctl reload nginx
```

## 四、App 里切换

打开 App → 功能 → **API 配置**：
- **接口地址** 改成：`https://你的域名/mem`
- **API Key**：你的 **Claude** 密钥（会被转发给上游 Claude）
- **模型**：你的 Claude 模型名（比如 `claude-3-5-sonnet` 等，按你中转支持的填）

保存。现在聊天就自动带 Ombre Brain 记忆了 —— Claude 会自己记住重要的事，跨对话都记得；记忆的总结/标注在后台用 DeepSeek 悄悄做。

> 想临时关掉记忆、直连 Claude：把接口地址改回原来的 Claude 中转地址即可。

## 排错

- `/health` 里 `ombre` 不是 `ok`：
  - `docker compose logs ombre` 看 Ombre Brain 是否起来（端口 8000）
  - 确认 `.env` 的 `DEEPSEEK_KEY` 有效
- 聊天能回但没记忆：记忆调用失败会**自动降级**（照常聊天，只是不记），看 `memproxy` 日志里的 `[ombre] callTool 失败`
- 跨域报错：本服务已开 CORS；若仍报错，确认走的是 `https://你的域名/mem` 而不是直连 8787

## 说明

- 记忆存在 docker 卷 `ombre-data` 里，容器重建也不丢
- Ombre Brain 会给记忆打情绪标签、按遗忘曲线自然淡忘、强烈的记得更久
- 这个后端是独立部署的，和网页的自动部署（GitHub Actions 传 app/）互不影响
