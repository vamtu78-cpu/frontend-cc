# 记忆中转（Ombre Brain + DeepSeek）部署

给聊天 App 加上「Ombre Brain 长期记忆」。App 本身几乎不用改——只要把「接口地址」指向这个后端即可。

```
你的手机 App
   │  接口地址 = https://你的域名/mem
   ▼
记忆中转 (本目录, :8787)
   ├─ 先向 Ombre Brain 捞相关记忆，注入对话
   ├─ 转发给 DeepSeek，流式返回
   └─ 聊完把这轮存回 Ombre Brain
Ombre Brain (:8000, 记忆大脑，情绪标注 + 遗忘曲线)
```

## 一、准备

在 VPS 上（需要已装 Docker + docker compose）：

```bash
# 进到项目的 server 目录（先把仓库 clone / pull 下来）
cd frontend-cc/server

# 1. 克隆 Ombre Brain 到这里
git clone https://github.com/P0lar1zzZ/Ombre-Brain.git

# 2. 配置密钥
cp .env.example .env
nano .env        # 填 DEEPSEEK_KEY，用中转就改 UPSTREAM_BASE
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
}
```

```bash
nginx -t && systemctl reload nginx
```

## 四、App 里切换

打开 App → 功能 → **API 配置**：
- **接口地址** 改成：`https://你的域名/mem`
- **API Key**：你的 DeepSeek 密钥（会被转发给上游）
- **模型**：`deepseek-chat` 或 `deepseek-reasoner`

保存。现在聊天就自动带 Ombre Brain 记忆了 —— AI 会自己记住重要的事，跨对话都记得。

> 想临时关掉记忆、直连 DeepSeek：把接口地址改回原来的中转地址即可。

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
