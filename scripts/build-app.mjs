// 把 preview.html 包装成可部署的 app/index.html（加上 PWA 头 + Service Worker 注册）
// 改完 preview.html 后运行：node scripts/build-app.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const body = readFileSync(new URL('../preview.html', import.meta.url), 'utf8');

const head = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
<meta name="theme-color" content="#12181f" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="icons/icon-180.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="玻璃聊天" />
<meta name="mobile-web-app-capable" content="yes" />
</head>
<body>
`;

const tail = `
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
</script>
</body>
</html>
`;

writeFileSync(new URL('../app/index.html', import.meta.url), head + body + tail);
console.log('app/index.html 已更新');
