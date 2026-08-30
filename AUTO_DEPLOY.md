# 自动部署设置（配一次，以后 push 就自动上线）

配好之后：**代码 push 到 GitHub → 自动 build → 自动传到你 VPS**，你再也不用手动跑部署脚本，手机上也不用删图标重装（Service Worker 会自动更新）。

全程你的服务器私钥只存在 GitHub 的加密 Secret 里，别人（包括我）看不到。

---

## 一、生成一把「部署专用」钥匙

在**你自己电脑**上运行（生成一对新钥匙，别用你平时登录的私钥）：

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-deploy"
```

会得到两个文件：
- `deploy_key`（私钥，等下贴进 GitHub）
- `deploy_key.pub`（公钥，等下放服务器）

## 二、把公钥装到 VPS

把公钥追加到服务器的授权列表（替换成你的登录信息）：

```bash
ssh-copy-id -i deploy_key.pub root@你的服务器IP
# 如果没有 ssh-copy-id，用这条：
# cat deploy_key.pub | ssh root@你的服务器IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

## 三、在 GitHub 仓库里加 Secrets

打开你的仓库 → **Settings → Secrets and variables → Actions → New repository secret**，
依次添加下面几个：

| 名字 | 值 | 必填 |
|---|---|---|
| `SSH_HOST` | 你服务器 IP 或域名 | ✅ |
| `SSH_USER` | 登录用户名（一般是 `root`） | ✅ |
| `SSH_KEY` | **`deploy_key` 私钥的全部内容**（`cat deploy_key` 复制全文，含首尾 BEGIN/END 行） | ✅ |
| `SSH_PORT` | SSH 端口（默认 22，不是 22 才填） | 选填 |
| `TARGET_DIR` | 网站目录（默认 `/var/www/liquid-chat`，一样就不用填） | 选填 |

> ⚠️ 加完记得把本地的 `deploy_key` / `deploy_key.pub` 收好或删掉，别提交进仓库。

## 四、完成！

以后只要代码推到分支 `claude/frontend-chat-app-kp2vju`，
GitHub 就会自动帮你 build 并部署。

- 看部署进度：仓库 → **Actions** 标签页
- 想手动触发一次：Actions → Deploy to VPS → **Run workflow**

前提：你第一次已经用 `deploy.sh` 配好了 Nginx（自动部署只更新网页文件，不重配 Nginx）。

---

## 手机上会自动更新吗？

会。Service Worker 已改成「网络优先」：只要手机联网，**打开 App 就会自动加载最新版**（新版本就绪会自动刷新一次）。不用再删图标重装。

偶尔想强制刷新：把 App 划掉重开即可。
