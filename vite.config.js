import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 的配置。目前只用到 React 插件，暂时不用改这里。
export default defineConfig({
  plugins: [react()],
})
