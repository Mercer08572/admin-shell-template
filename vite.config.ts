import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPrefix = env.VITE_API_BASE_URL || '/api/v1'

  /**
   * 部署基路径。
   *
   * 默认 `/`（就是 Vite 的默认值），所以本地 `pnpm dev` / `pnpm preview`、构建与端到端测试
   * 都不受任何影响。只有托管在**子路径**下时才需要覆盖，例如 GitHub Pages 的项目站点
   * `https://<owner>.github.io/<repo>/`，由 .github/workflows/deploy-pages.yml 注入。
   *
   * 名字特意不带 `VITE_` 前缀：带前缀的变量会被一并注入客户端代码打进产物，
   * 而部署基路径只属于构建期。它同时也是 vue-router 的 history base（见 src/router/index.ts）。
   */
  const basePath = env.PAGES_BASE_PATH || '/'

  return {
    base: basePath,
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
