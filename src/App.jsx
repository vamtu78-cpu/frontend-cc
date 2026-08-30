import { useState, useRef, useEffect } from 'react'

/**
 * ============================================================
 *  这就是你的聊天界面。整份文件都是给你随便改着玩的。
 *  想改配色、气泡形状、字体、布局，主要就在这里动手。
 * ============================================================
 */

// —— 假的 AI 回复。等以后接真 API，只要改 getAIReply 这个函数就行 ——
const FAKE_REPLIES = [
  '收到～这是一条假回复😋 界面跑通啦！',
  '我现在还没接真的大模型，先陪你测试界面～',
  '气泡、动画、滚动都正常的话，就说明雏形成功啦🎉',
  '想改配色的话，找 App.jsx 里带颜色的那些 class 改就行。',
  '等你玩顺了，跟 cc 说一声，就能把我换成真的 AI 啦🥰',
]

// 模拟"AI 思考 + 回复"，之后换成真实网络请求
function getAIReply() {
  const text = FAKE_REPLIES[Math.floor(Math.random() * FAKE_REPLIES.length)]
  // 用 Promise 模拟网络延迟（0.8~1.6 秒）
  const delay = 800 + Math.random() * 800
  return new Promise((resolve) => setTimeout(() => resolve(text), delay))
}

// 生成简单的唯一 id
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function App() {
  // messages：整个对话记录。每条是 { id, role: 'user' | 'ai', text }
  const [messages, setMessages] = useState([
    { id: uid(), role: 'ai', text: '嗨～我是你的 AI 小助手，随便跟我说点什么吧！' },
  ])
  const [input, setInput] = useState('') // 输入框里的文字
  const [isTyping, setIsTyping] = useState(false) // AI 是否"正在输入"

  const scrollRef = useRef(null) // 用来自动滚到最新消息

  // 每次消息变化，自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isTyping])

  // 发送消息
  async function handleSend() {
    const text = input.trim()
    if (!text || isTyping) return

    // 1. 先把用户这条消息加进去
    const userMsg = { id: uid(), role: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')

    // 2. 显示"正在输入"，去拿 AI 回复
    setIsTyping(true)
    const reply = await getAIReply()
    setIsTyping(false)

    // 3. 把 AI 回复加进去
    setMessages((prev) => [...prev, { id: uid(), role: 'ai', text: reply }])
  }

  // 输入框按回车发送（Shift+回车换行）
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    // 最外层：整屏渐变背景，居中放一个聊天卡片
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4">
      {/* 聊天卡片本体 */}
      <div className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
        {/* ===== 顶部标题栏 ===== */}
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-lg shadow-lg">
            🤖
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">我的 AI 聊天</h1>
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              在线（当前为测试模式）
            </p>
          </div>
        </header>

        {/* ===== 消息区域 ===== */}
        <div
          ref={scrollRef}
          className="nice-scroll flex-1 space-y-4 overflow-y-auto px-4 py-6 sm:px-6"
        >
          {messages.map((msg) => (
            <Bubble key={msg.id} role={msg.role} text={msg.text} />
          ))}

          {/* AI 正在输入的三个跳动小点 */}
          {isTyping && <TypingIndicator />}
        </div>

        {/* ===== 底部输入区 ===== */}
        <div className="border-t border-white/10 p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-2xl bg-slate-800/80 p-2 ring-1 ring-white/10 focus-within:ring-indigo-400/50">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="说点什么…（回车发送，Shift+回车换行）"
              className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="发送"
            >
              {/* 一个简单的发送箭头图标 */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.993.993 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// —— 单条消息气泡 ——
function Bubble({ role, text }) {
  const isUser = role === 'user'
  return (
    <div className={`flex animate-fade-up items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm shadow ${
          isUser
            ? 'bg-gradient-to-br from-sky-400 to-blue-500'
            : 'bg-gradient-to-br from-indigo-400 to-fuchsia-500'
        }`}
      >
        {isUser ? '🧑' : '🤖'}
      </div>

      {/* 气泡 */}
      <div
        className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white'
            : 'rounded-bl-md bg-slate-800 text-slate-100'
        }`}
      >
        {text}
      </div>
    </div>
  )
}

// —— "正在输入" 三个跳动的点 ——
function TypingIndicator() {
  return (
    <div className="flex animate-fade-up items-end gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-sm shadow">
        🤖
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3 shadow-md">
        <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400" style={{ animationDelay: '200ms' }} />
        <span className="h-2 w-2 animate-bounce-dot rounded-full bg-slate-400" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  )
}
