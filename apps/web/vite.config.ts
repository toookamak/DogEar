import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

// 应用版本号单一来源：apps/web/package.json 的 version（与根目录 CHANGELOG 的应用版本对齐），
// 编译期注入 __APP_VERSION__ 供顶栏品牌旁展示。
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
