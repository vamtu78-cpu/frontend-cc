/** @type {import('tailwindcss').Config} */
// Tailwind 的配置。想加自定义颜色、字体、动画都写在这里。
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // 界面默认字体，想换字体改这里
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        // 消息淡入 + 轻微上浮的动画
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // "正在输入" 三个点的跳动
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out',
        'bounce-dot': 'bounce-dot 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}
