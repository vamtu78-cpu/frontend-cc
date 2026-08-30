// Service Worker：自动更新 + 离线可用
// - 页面(HTML)走"网络优先"：有网就永远拿最新版，没网才用缓存
// - 图标等静态资源走"缓存优先 + 后台更新"
// - 新版本安装后立即接管并让页面刷新，不用手动删图标重装
const CACHE = 'liquid-chat';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isNavigation(req) {
  return req.mode === 'navigate' || (req.destination === 'document');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面：网络优先，拿到就更新缓存；断网才用缓存
  if (isNavigation(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
    );
    return;
  }

  // 其它静态资源：缓存优先，后台悄悄更新
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
