import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPrefix = env.VITE_API_BASE_URL || '/api/v1'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      // 5273 而不是 5173：避免与相邻项目的开发服务器抢端口
      port: 5273,
      proxy: {
        [apiPrefix]: {
          // 只在 VITE_USE_MOCK=false 时才会用到；换成自己后端的地址即可
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8181',
          changeOrigin: true,
        },
      },
    },
  }
})
