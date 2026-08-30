# 部署到 VPS + 加到手机桌面（PWA）

这份说明教你把聊天界面变成一个**有自己网址、能加到手机主屏幕当 App 用**的网页。

---

## 📁 要上传的东西

真正要放到服务器上的，就是 **`app/` 这个文件夹**里的全部内容：

```
app/
├── index.html            ← 完整可部署页面（由 preview.html 生成）
├── manifest.webmanifest  ← App 名称/图标/全屏配置
├── sw.js                 ← 离线缓存
└── icons/                ← App 图标
    ├── icon-180.png
    ├── icon-192.png
    ├── icon-512.png
    └── maskable-512.png
```

> `preview.html` 是「源文件」，你改它之后运行 `node scripts/build-app.mjs` 就会重新生成 `app/index.html`。
> 想换 App 图标：改 `scripts/make-icons.mjs` 里的颜色/形状，再运行 `node scripts/make-icons.mjs`。

---

## 🚀 最简单的部署（Nginx）

假设你有一台 VPS，已经装了 Nginx。

**1. 把 app/ 上传到服务器**（在你电脑上运行，替换成你的服务器地址）：

```bash
scp -r app/* root@你的服务器IP:/var/www/liquid-chat/
```

**2. 配置 Nginx**，新建 `/etc/nginx/conf.d/liquid-chat.conf`：

```nginx
server {
    listen 80;
    server_name chat.你的域名.com;   # 或直接用 IP

    root /var/www/liquid-chat;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**3. 重载 Nginx**：

```bash
nginx -t && systemctl reload nginx
```

现在浏览器打开 `http://chat.你的域名.com` 就能看到啦。

---

## 🔒 关键：一定要配 HTTPS

**PWA（Service Worker、添加到主屏幕）只有在 HTTPS 下才生效**，http 不行。
最省事的免费证书用 Certbot：

```bash
# 装 certbot（Ubuntu/Debian）
apt install certbot python3-certbot-nginx -y
# 自动申请证书并改好 Nginx（按提示填域名和邮箱）
certbot --nginx -d chat.你的域名.com
```

搞定后网址会变成 `https://chat.你的域名.com`，证书还会自动续期。

> 没有域名？可以先用 IP + 自签证书测试，但手机会提示不安全。
> 想要免费域名可以看 [Cloudflare](https://www.cloudflare.com/) 或用免费二级域名服务。

---

## 📱 加到手机桌面

网址能用 HTTPS 打开后：

- **iPhone（Safari）**：打开网址 → 点底部「分享」按钮 → **添加到主屏幕**
- **安卓（Chrome）**：打开网址 → 右上角菜单 → **安装应用 / 添加到主屏幕**

桌面就会出现玻璃气泡图标，点开**全屏运行**、有独立启动画面，跟原生 App 几乎一样，断网也能打开界面。🎉

---

## 🖥️ 想先在自己电脑上试 PWA？

```bash
# 在项目根目录起一个本地静态服务器
npx serve app
```

然后用 Chrome 打开它给的 `http://localhost:xxxx`，按 F12 → Application → Manifest / Service Workers 就能看到 PWA 状态。
（localhost 被浏览器当作安全环境，所以本地也能测 PWA。）
