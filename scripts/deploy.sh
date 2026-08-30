#!/usr/bin/env bash
#
# 一键部署脚本 —— 在【你自己的电脑】上运行（不是在服务器上）。
# 它会把 app/ 传到你的 VPS，装好 Nginx，并申请 HTTPS 证书。
# 你的服务器密码/密钥全程只在你本机的 ssh 里，别人拿不到。
#
# 用法：
#   bash scripts/deploy.sh <ssh登录> <域名> [邮箱]
#
# 例子：
#   bash scripts/deploy.sh root@1.2.3.4 chat.example.com me@example.com
#
# 前提：
#   - 你本机能用 ssh 登上这台 VPS（ssh root@你的IP 能进）
#   - 域名的 DNS 已经解析到这台 VPS 的 IP（A 记录）
#   - 项目已经 build 过（存在 app/index.html；没有就先跑 node scripts/build-app.mjs）

set -euo pipefail

SSH_TARGET="${1:-}"
DOMAIN="${2:-}"
EMAIL="${3:-}"

if [[ -z "$SSH_TARGET" || -z "$DOMAIN" ]]; then
  echo "用法: bash scripts/deploy.sh <ssh登录> <域名> [邮箱]"
  echo "例子: bash scripts/deploy.sh root@1.2.3.4 chat.example.com me@example.com"
  exit 1
fi

# 定位到项目根目录
cd "$(dirname "$0")/.."

if [[ ! -f app/index.html ]]; then
  echo "没找到 app/index.html，先生成：node scripts/build-app.mjs"
  node scripts/build-app.mjs
fi

REMOTE_DIR="/var/www/liquid-chat"

echo "==> [1/3] 上传 app/ 到 $SSH_TARGET:$REMOTE_DIR"
ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
# 优先用 rsync，没有就退回 scp
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete app/ "$SSH_TARGET:$REMOTE_DIR/"
else
  scp -r app/. "$SSH_TARGET:$REMOTE_DIR/"
fi

echo "==> [2/3] 在服务器上配置 Nginx"
ssh "$SSH_TARGET" DOMAIN="$DOMAIN" REMOTE_DIR="$REMOTE_DIR" 'bash -s' <<'REMOTE'
set -euo pipefail
# 装 nginx（若未安装）
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "无法自动安装 nginx，请手动安装后重试"; exit 1
  fi
fi

# 找到 nginx 配置目录
if [[ -d /etc/nginx/conf.d ]]; then
  CONF=/etc/nginx/conf.d/liquid-chat.conf
else
  mkdir -p /etc/nginx/sites-enabled
  CONF=/etc/nginx/sites-enabled/liquid-chat.conf
fi

cat > "$CONF" <<CONFEOF
server {
    listen 80;
    server_name ${DOMAIN};
    root ${REMOTE_DIR};
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    # Service Worker 不缓存，保证更新及时
    location = /sw.js { add_header Cache-Control "no-cache"; }
}
CONFEOF

nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart nginx
echo "Nginx 配置完成：$CONF"
REMOTE

echo "==> [3/3] 申请 HTTPS 证书 (Let's Encrypt)"
if [[ -n "$EMAIL" ]]; then
  ssh "$SSH_TARGET" DOMAIN="$DOMAIN" EMAIL="$EMAIL" 'bash -s' <<'REMOTE'
set -euo pipefail
# 装 certbot（若未安装）
if ! command -v certbot >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y certbot python3-certbot-nginx
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y certbot python3-certbot-nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y certbot python3-certbot-nginx
  fi
fi
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
echo "HTTPS 证书申请完成，会自动续期。"
REMOTE
else
  echo "（跳过 HTTPS：没提供邮箱）"
  echo "想加 HTTPS，请登上服务器运行："
  echo "  apt install -y certbot python3-certbot-nginx && certbot --nginx -d $DOMAIN"
fi

echo ""
echo "✅ 完成！打开: http://$DOMAIN  (配了证书则是 https://$DOMAIN)"
echo "   然后在手机浏览器打开该网址 → 添加到主屏幕。"
