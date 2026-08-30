# 我的 AI 聊天前端 🤖

一个自己玩、自己美化的 AI 聊天界面。用 **React + Tailwind CSS** 搭建。
目前是「雏形」阶段：界面已经好看能跑，聊天先用**假回复**，之后可以接真的 AI。

---

## 🚀 怎么在电脑上跑起来看效果

> 前提：电脑上装了 [Node.js](https://nodejs.org/)（下载 LTS 版本，一路下一步即可）。
> 装完打开终端（Windows 用 PowerShell，Mac 用「终端」），输入 `node -v` 能看到版本号就说明装好了。

在项目文件夹里，依次运行这两条命令：

```bash
# 1. 装依赖（第一次跑，或换了电脑才需要，可能要等一两分钟）
npm install

# 2. 启动开发服务器
npm run dev
```

跑起来后终端会显示一个网址，一般是 **http://localhost:5173**，
用浏览器打开它，就能看到你的聊天界面啦！

> 开发模式下改代码会**自动刷新**，改完存盘，浏览器立刻更新，特别适合一边改一边看效果。

---

## 🎨 我想美化，改哪里？

大部分能改的东西都在 **`src/App.jsx`** 里，文件里写满了中文注释：

- **换配色 / 气泡形状 / 圆角**：改 App.jsx 里那些带颜色的 `className`（比如 `from-indigo-500`、`rounded-2xl`）
- **改动画**：`tailwind.config.js` 里的 `keyframes`
- **换字体**：`index.html` 里引入字体的那行 + `tailwind.config.js` 的 `fontFamily`
- **改假回复内容**：`src/App.jsx` 顶部的 `FAKE_REPLIES`

Tailwind 的颜色 / 间距 / 圆角写法可以查官网：https://tailwindcss.com/docs

---

## 🔌 以后怎么接真的 AI？

现在聊天用的是假回复。等你准备好，只要改 `src/App.jsx` 里的 **`getAIReply` 函数**，
把它换成真正调用 AI 接口的网络请求就行。到时候跟 cc 说一声，会帮你接。

---

## 📦 部署到 VPS（自己用）

在电脑上打包出静态文件：

```bash
npm run build
```

会生成一个 `dist` 文件夹，里面就是纯静态网页（HTML/CSS/JS）。
把 `dist` 里的东西上传到 VPS，用 Nginx 之类的静态服务器一指，就能访问了。
（2C2G 的 VPS 跑这个绰绰有余，因为真正的 AI 计算在服务商那边，不吃你的服务器。）
