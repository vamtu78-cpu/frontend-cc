#!/usr/bin/env bash
# 在 VPS 上执行（由 GitHub Actions 通过 ssh 调用，不用手动跑）：
# 装好 Node（没有就下载一份放 /opt/groupchat/node）→ 注册 systemd 服务 → 给现有网站加上 /group/ 反代
set -euo pipefail
APP=/opt/groupchat
SITE_DIR="${SITE_DIR:-/var/www/liquid-chat}"
S=""; [ "$(id -u)" = 0 ] || S=sudo

# ---- Node ----
NODE="$(command -v node || true)"
if [ -z "$NODE" ] || [ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  NODE=$APP/node/bin/node
  if [ ! -x "$NODE" ]; then
    case "$(uname -m)" in x86_64) A=x64;; aarch64|arm64) A=arm64;; *) echo "不支持的 CPU 架构：$(uname -m)"; exit 1;; esac
    V=v20.18.0
    echo "==> 服务器没有 Node 18+，下载 Node $V"
    for M in https://nodejs.org/dist https://npmmirror.com/mirrors/node; do
      curl -fsSL "$M/$V/node-$V-linux-$A.tar.gz" -o /tmp/node.tgz && break
    done
    $S mkdir -p $APP/node
    $S tar -xzf /tmp/node.tgz -C $APP/node --strip-components=1
    rm -f /tmp/node.tgz
  fi
fi
echo "==> Node: $NODE ($("$NODE" -v))"

# ---- systemd 服务 ----
$S tee /etc/systemd/system/groupchat.service >/dev/null <<EOF
[Unit]
Description=AI group chat
After=network.target

[Service]
WorkingDirectory=$APP
ExecStart=$NODE $APP/server.js
Environment=PORT=8788
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
$S systemctl daemon-reload
$S systemctl enable groupchat >/dev/null 2>&1
$S systemctl restart groupchat

# ---- Nginx：在现有网站里挂 /group/ ----
$S mkdir -p /etc/nginx/snippets
$S tee /etc/nginx/snippets/groupchat.conf >/dev/null <<'EOF'
location = /group { return 301 /group/; }
location /group/ {
    proxy_pass http://127.0.0.1:8788/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1h;
}
EOF

CONF="$($S grep -rlE "root +$SITE_DIR/?;" /etc/nginx/ 2>/dev/null | grep -v snippets | head -1 || true)"
if [ -z "$CONF" ]; then
  echo "⚠️  没找到网站 $SITE_DIR 的 Nginx 配置，群聊服务已启动(:8788)，但没挂到网址上"
  exit 1
fi
if ! $S grep -q 'snippets/groupchat.conf' "$CONF"; then
  echo "==> 在 $CONF 里加入 /group/ 反代"
  $S cp "$CONF" $APP/nginx-site.bak
  $S sed -i -E "\#root +$SITE_DIR/?;#a\    include /etc/nginx/snippets/groupchat.conf;" "$CONF"
  if ! $S nginx -t 2>&1; then
    $S cp $APP/nginx-site.bak "$CONF"
    echo "❌ Nginx 配置检查失败，已恢复原配置"; exit 1
  fi
fi
$S nginx -t 2>&1 && $S systemctl reload nginx

# ---- 自检 ----
sleep 2
CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8788/api/info || true)"
if [ "$CODE" != 200 ] && [ "$CODE" != 401 ]; then
  echo "❌ 群聊服务没起来，最近日志："; $S journalctl -u groupchat -n 30 --no-pager; exit 1
fi
echo "✅ 群聊已上线：你聊天 App 的网址后面加 /group/"
