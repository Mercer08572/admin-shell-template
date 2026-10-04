import { expect, test } from '@playwright/test'

import { ADMIN, fail, fieldInput, mockApi, ok } from './support/api-mock'

/**
 * 登录页与登录流程。
 *
 * e2e 跑在 `--mode test`（进程内 mock 关闭）下，因此这里能顺带验证一件事：
 * 演示账号提示框只在 `VITE_USE_MOCK=true` 时出现，不会跟着生产构建一起发出去。
 */

test('renders the login workflow', async ({ page }) => {
  await mockApi(page, [])
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: '管理端模板' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '欢迎回来' })).toBeVisible()
  await expect(page.getByLabel('账号', { exact: true })).toBeVisible()
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '登录' })).toBeVisible()

  // mock 关闭时不应该出现演示账号提示
  await expect(page.getByText('演示账号')).toHaveCount(0)
})

test('validates empty credentials', async ({ page }) => {
  await mockApi(page, [])
  await page.goto('/login')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(
    page.locator('.n-form-item-feedback__line').filter({ hasText: '请输入管理员账号' }),
  ).toBeVisible()
  await expect(
    page.locator('.n-form-item-feedback__line').filter({ hasText: '请输入密码' }),
  ).toBeVisible()
})

test('logs in and lands on the workbench with its tab', async ({ page }) => {
  await mockApi(page, [
    {
      method: 'POST',
      path: '/auth/admin/login',
      respond: (route) =>
        route.fulfill({ json: ok({ admin: ADMIN, expires_at: '2026-01-01T10:00:00Z' }) }),
    },
    {
      method: 'GET',
      path: '/health',
      respond: (route) =>
        route.fulfill({ json: ok({ service: 'admin-shell-template', status: 'ok' }) }),
    },
  ])

  await page.goto('/login')
  // Naive 的 aria-label 落在包裹层 div 上，`getByLabel().fill()` 会点到 div；
  // 定位输入框统一走 tests/support/api-mock.ts 的 fieldInput
  await fieldInput(page, '账号').fill('admin')
  await fieldInput(page, '密码').fill('admin123')
  await page.getByRole('button', { name: '登录' }).click()

  await expect(page).toHaveURL('/')
  // 工作台是常驻标签，且不可关闭
  await expect(page.locator('.n-tabs-tab[data-name="/"]')).toHaveClass(/n-tabs-tab--active/)
  await expect(page.locator('.n-tabs-tab[data-name="/"] .n-tabs-tab__close')).toHaveCount(0)
  await expect(page.locator('.service-strip')).toContainText('API 服务正常')
})

test('shows the mapped Chinese message for bad credentials', async ({ page }) => {
  await mockApi(page, [
    {
      method: 'POST',
      path: '/auth/admin/login',
      respond: (route) =>
        route.fulfill({
          status: 401,
          json: fail(401, 401, 'invalid credentials', 'AUTH_INVALID_CREDENTIALS'),
        }),
    },
  ])

  await page.goto('/login')
  await fieldInput(page, '账号').fill('admin')
  await fieldInput(page, '密码').fill('wrong-password')
  await page.getByRole('button', { name: '登录' }).click()

  // 错误码 → 中文文案这条链路走通（后端英文 message 不直接暴露给用户）
  await expect(page.locator('.n-message')).toContainText('用户名或密码错误')
  await expect(page).toHaveURL('/login')
})
