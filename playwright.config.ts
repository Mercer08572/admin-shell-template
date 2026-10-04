import { defineConfig, devices } from '@playwright/test'

/**
 * 端到端测试默认跑在 5273 端口。
 *
 * 不要用 5173：那是相邻项目 stock-flow-admin 的开发端口，两个项目同时跑会互相抢端口。
 * 应用本身不依赖后端——浏览器里的请求由 tests/support/api-mock.ts 造桩，
 * 与开发时的进程内 mock（src/api/mock）是两条独立路径。
 */
const PORT = 5273

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // --mode test 会加载 .env.test：那里把 VITE_USE_MOCK 关掉，
    // 于是请求真的走网络，由 page.route 造桩接管（否则 mock 会在浏览器内把请求吃掉）
    command: `./node_modules/.bin/vite --host 127.0.0.1 --port ${PORT} --mode test`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
  },
})
