import { expect, test } from '@playwright/test'

import { mockApi, ok } from './support/api-mock'

/**
 * 路由级加载进度条：导航开始到路由确认之间应可见。
 *
 * 直接点菜单通常几十毫秒就结束，断言会不稳定；这里把目标页面的懒加载模块延迟 800ms，
 * 让导航停留在 chunk 下载阶段，从而能稳定观察到进度条出现与收尾。
 */
test('shows a progress bar while a lazy route chunk loads', async ({ page }) => {
  await mockApi(page, [
    {
      method: 'GET',
      path: '/health',
      respond: (route) =>
        route.fulfill({ json: ok({ service: 'admin-shell-template', status: 'ok' }) }),
    },
    {
      method: 'GET',
      path: '/customers',
      respond: (route) => route.fulfill({ json: ok({ items: [], limit: 20, offset: 0 }) }),
    },
  ])

  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible()

  // 延迟「客户」页面的懒加载模块，导航会停在 beforeEach 之后的 chunk 下载阶段
  await page.route('**/src/features/customers/CustomerListView.vue*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })

  const bar = page.locator('.n-loading-bar-container')

  // 工作台的快捷入口在桌面端与移动端都可见，避免依赖移动端抽屉与分组菜单展开
  await page.locator('.quick-link').filter({ hasText: '客户列表' }).click()

  await expect(bar).toBeVisible()
  await expect(bar).toBeHidden({ timeout: 5000 })
})
