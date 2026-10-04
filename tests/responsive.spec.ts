import { expect, test, type Page } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 窄屏与桌面宽度的布局回归。
 *
 * 320 px 是模板承诺支持的最小宽度：页面整体不能横向溢出，
 * 宽表格由表格容器自己滚动，操作按钮必须仍然可点。
 */

const MOBILE = { width: 320, height: 720 }
const now = '2026-01-05T09:30:00Z'

const customers = [
  {
    id: 101,
    code: 'C-001',
    name: '华南贸易',
    level: 'important',
    status: 'active',
    phone: '13800000001',
    remark: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: 102,
    code: 'C-002',
    name: '北方机械',
    level: 'vip',
    status: 'inactive',
    phone: null,
    remark: '账期 60 天',
    created_at: now,
    updated_at: now,
  },
]

const routes: StubRoute[] = [
  {
    method: 'GET',
    path: '/health',
    respond: (route) =>
      route.fulfill({ json: ok({ service: 'admin-shell-template', status: 'ok' }) }),
  },
  {
    method: 'GET',
    path: '/customers',
    respond: (route) => route.fulfill({ json: ok({ items: customers, limit: 20, offset: 0 }) }),
  },
  {
    method: 'GET',
    path: '/customers/:id',
    respond: (route) => route.fulfill({ json: ok(customers[0]) }),
  },
  {
    method: 'GET',
    path: '/contacts',
    respond: (route) => route.fulfill({ json: ok({ items: [], limit: 20, offset: 0 }) }),
  },
]

/** 页面整体不应横向溢出；宽表格应由表格容器自己滚动 */
async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('320 px', () => {
  test.use({ viewport: MOBILE })

  test('客户列表与其行操作仍可用', async ({ page }) => {
    await mockApi(page, routes)
    await page.goto('/customers')

    await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '新增' })).toBeVisible()

    // 行操作在窄屏下必须还能点到（表格容器横向滚动）
    for (const name of ['编辑', '删除']) {
      const button = page.getByRole('button', { name }).first()
      await button.scrollIntoViewIfNeeded()
      await expect(button).toBeVisible()
    }

    await expectNoPageOverflow(page)
  })

  test('编辑抽屉可用且不横向溢出', async ({ page }) => {
    await mockApi(page, routes)
    await page.goto('/customers')
    await page.getByRole('button', { name: '编辑' }).first().click()

    const drawer = page.locator('.n-drawer')
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('button', { name: '保存' })).toBeVisible()

    const overflow = await drawer.evaluate((element) => element.scrollWidth - element.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('抽屉菜单可以展开分组并导航到客户列表', async ({ page }) => {
    await mockApi(page, routes)
    await page.goto('/')

    await page.getByRole('button', { name: '打开导航' }).click()
    const drawer = page.locator('.n-drawer')
    await drawer.locator('.n-menu-item-content').filter({ hasText: '业务示例' }).click()
    await drawer.locator('.n-menu-item-content').filter({ hasText: '客户' }).click()

    await expect(page).toHaveURL('/customers')
    await expect(page.locator('.n-tabs-tab[data-name="/customers"]')).toBeVisible()
    await expectNoPageOverflow(page)
  })
})

test.describe('桌面宽度', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('侧边栏与标签条同时可见，列表页不横向溢出', async ({ page }) => {
    await mockApi(page, routes)
    await page.goto('/customers')

    await expect(page.locator('.app-sidebar')).toBeVisible()
    await expect(page.locator('.tabbar')).toBeVisible()
    await expect(page.locator('.topbar')).toContainText('客户')
    await expect(page.getByRole('cell', { name: 'C-002', exact: true })).toBeVisible()

    await expectNoPageOverflow(page)
  })
})
