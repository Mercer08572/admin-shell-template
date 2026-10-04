import { expect, test } from '@playwright/test'

import {
  fieldInput,
  mockApi,
  ok,
  fail,
  type StubResponder,
  type StubRoute,
} from './support/api-mock'

/**
 * 客户列表（配置驱动的 CRUD）的端到端验证。
 *
 * 请求全部由 `tests/support/api-mock.ts` 造桩：e2e 以 `VITE_USE_MOCK=false` 运行，
 * 进程内 mock（`src/api/mock`）不参与，因此这里能精确构造 409 这类分支。
 */

const now = '2026-01-05T09:30:00Z'

interface CustomerFixture {
  id: number
  code: string
  name: string
  level: string
  status: string
  phone: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

const customer: CustomerFixture = {
  id: 101,
  code: 'C-001',
  name: '华南贸易',
  level: 'important',
  status: 'active',
  phone: '13800000001',
  remark: null,
  created_at: now,
  updated_at: now,
}

/** 造一批可翻页的数据：编码按 id 递增，便于断言当前页 */
function customerAt(id: number): CustomerFixture {
  return { ...customer, id, code: `C-${String(id).padStart(3, '0')}` }
}

type RouteKey =
  | 'GET /customers'
  | 'POST /customers'
  | 'GET /customers/:id'
  | 'PUT /customers/:id'
  | 'DELETE /customers/:id'

function customerRoutes(
  overrides: Partial<Record<RouteKey, StubResponder>> = {},
  items: CustomerFixture[] = [customer],
): StubRoute[] {
  const routes: StubRoute[] = [
    {
      method: 'GET',
      path: '/customers',
      respond: (route) => route.fulfill({ json: ok({ items, limit: items.length, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/customers/:id',
      respond: (route) => route.fulfill({ json: ok(customer) }),
    },
    {
      method: 'POST',
      path: '/customers',
      respond: (route) =>
        route.fulfill({ json: ok({ ...customer, ...route.request().postDataJSON() }) }),
    },
    {
      method: 'PUT',
      path: '/customers/:id',
      respond: (route) => route.fulfill({ json: ok(customer) }),
    },
    {
      method: 'DELETE',
      path: '/customers/:id',
      respond: (route) => route.fulfill({ json: ok(null) }),
    },
  ]

  return routes.map((route) => {
    const override = overrides[`${route.method} ${route.path}` as RouteKey]
    return override ? { ...route, respond: override } : route
  })
}

/** NSelect 的选中值渲染在 `.n-base-selection-label`，而 input.value 始终为空 */
function selectionLabel(page: Parameters<typeof mockApi>[0], label: string) {
  return page
    .locator('.n-drawer .n-form-item')
    .filter({ has: page.locator('.n-form-item-label', { hasText: label }) })
    .locator('.n-base-selection-label')
}

/**
 * 抽屉里的字段。
 *
 * 不能直接用 `fieldInput(page, label)`：筛选栏里也有「等级」这类同名字段，
 * 页面级定位会同时命中两处（strict mode violation）。
 */
function drawerField(page: Parameters<typeof mockApi>[0], label: string) {
  return page
    .locator('.n-drawer .n-form-item')
    .filter({ has: page.locator('.n-form-item-label', { hasText: label }) })
    .locator('input')
}

test('lists customers and pages forward with the offset query', async ({ page }) => {
  const urls: URL[] = []

  await mockApi(
    page,
    customerRoutes({
      'GET /customers': (route) => {
        const url = new URL(route.request().url())
        urls.push(url)

        const limit = Number(url.searchParams.get('limit'))
        const offset = Number(url.searchParams.get('offset'))
        // 第一页刻意取满：契约没有总数，列表只能靠「本页是否满页」判断还有下一页
        const items =
          offset === 0 ? Array.from({ length: limit }, (_, index) => customerAt(index + 1)) : []

        return route.fulfill({ json: ok({ items, limit, offset }) })
      },
    }),
  )

  await page.goto('/customers')
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()
  await expect(page.getByText(/第 1 页/)).toBeVisible()

  await page.getByRole('button', { name: '下一页' }).click()

  await expect.poll(() => urls.length).toBe(2)
  const first = urls[0]!
  const second = urls[1]!
  expect(first.searchParams.get('offset')).toBe('0')
  // 翻页必须把 offset 前移一页，且页大小原样透传
  expect(second.searchParams.get('offset')).toBe(first.searchParams.get('limit'))
  await expect(page.getByText(/第 2 页/)).toBeVisible()

  await page.getByRole('button', { name: '上一页' }).click()
  await expect.poll(() => urls.length).toBe(3)
  expect(urls[2]!.searchParams.get('offset')).toBe('0')
})

test('sends the selected filters and resets back to the first page', async ({ page }) => {
  const urls: URL[] = []

  await mockApi(
    page,
    customerRoutes({
      'GET /customers': (route) => {
        const url = new URL(route.request().url())
        urls.push(url)
        return route.fulfill({ json: ok({ items: [customer], limit: 20, offset: 0 }) })
      },
    }),
  )

  await page.goto('/customers')
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()

  await fieldInput(page, '关键词').fill('华南')
  await page.getByRole('button', { name: '查询' }).click()

  await expect.poll(() => urls.length).toBe(2)
  expect(urls[1]!.searchParams.get('keyword')).toBe('华南')
  expect(urls[1]!.searchParams.get('offset')).toBe('0')

  // 等级下拉：选项来自配置，值按 query 参数名发送
  await page
    .locator('.filters .n-form-item')
    .filter({ hasText: '等级' })
    .locator('.n-base-selection')
    .click()
  await page.locator('.n-base-select-option').filter({ hasText: 'VIP' }).click()
  await page.getByRole('button', { name: '查询' }).click()

  await expect.poll(() => urls.length).toBe(3)
  expect(urls[2]!.searchParams.get('level')).toBe('vip')
  expect(urls[2]!.searchParams.has('status')).toBe(false)

  await page.getByRole('button', { name: '重置' }).click()
  await expect.poll(() => urls.length).toBe(4)
  expect([...urls[3]!.searchParams.keys()].sort()).toEqual(['limit', 'offset'])
})

test('creates a customer from the drawer with every field in the payload', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    customerRoutes({
      'POST /customers': async (route) => {
        postBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: ok(customer) })
      },
    }),
  )

  await page.goto('/customers')
  await page.getByRole('button', { name: '新增' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('新增客户')).toBeVisible()

  await drawerField(page, '编码').fill('C-100')
  await drawerField(page, '名称').fill('新客户')
  await drawerField(page, '等级').click()
  await page.locator('.n-base-select-option').filter({ hasText: 'VIP' }).click()
  await drawerField(page, '电话').fill('13800000099')

  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => postBodies.length).toBe(1)
  // 新增载荷里每个字段都要出现：可选项留空显式发 null，状态默认 active
  expect(postBodies[0]).toEqual({
    code: 'C-100',
    name: '新客户',
    level: 'vip',
    status: 'active',
    phone: '13800000099',
    remark: null,
  })
})

test('edits a customer with every field prefilled from the API', async ({ page }) => {
  const putBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    customerRoutes({
      'PUT /customers/:id': async (route) => {
        putBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: ok(customer) })
      },
    }),
  )

  await page.goto('/customers')
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '编辑' }).first().click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer.getByText('编辑客户')).toBeVisible()

  // 预填：来自 GET /customers/:id，而不是空表单
  await expect(drawerField(page, '编码')).toHaveValue('C-001')
  await expect(drawerField(page, '名称')).toHaveValue('华南贸易')
  await expect(selectionLabel(page, '等级')).toHaveText('重要')
  await expect(selectionLabel(page, '状态')).toHaveText('正常')

  await drawerField(page, '名称').fill('华南贸易（改）')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => putBodies.length).toBe(1)
  expect(putBodies[0]).toEqual({
    code: 'C-001',
    name: '华南贸易（改）',
    level: 'important',
    status: 'active',
    phone: '13800000001',
    remark: null,
  })
})

test('requires confirmation before deleting a customer', async ({ page }) => {
  const deleted: string[] = []

  await mockApi(
    page,
    customerRoutes({
      'DELETE /customers/:id': async (route) => {
        deleted.push(new URL(route.request().url()).pathname)
        await route.fulfill({ json: ok(null) })
      },
    }),
  )

  await page.goto('/customers')
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '删除' }).first().click()

  const dialog = page.locator('.n-dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('C-001')
  await expect(dialog).toContainText('华南贸易')

  // 只打开确认框不应发出请求
  expect(deleted).toHaveLength(0)

  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  expect(deleted).toHaveLength(0)

  await page.getByRole('button', { name: '删除' }).first().click()
  await page.locator('.n-dialog').getByRole('button', { name: '确认删除' }).click()

  await expect.poll(() => deleted).toEqual(['/api/v1/customers/101'])
})

test('shows the Chinese message when the customer still has contacts', async ({ page }) => {
  await mockApi(
    page,
    customerRoutes({
      'DELETE /customers/:id': (route) =>
        route.fulfill({
          status: 409,
          json: fail(409, 409, 'customer still has contacts', 'CUSTOMER_HAS_CONTACTS'),
        }),
    }),
  )

  await page.goto('/customers')
  await page.getByRole('button', { name: '删除' }).first().click()
  await page.locator('.n-dialog').getByRole('button', { name: '确认删除' }).click()

  // 展示的是 error_code 映射的中文文案，而不是后端的英文原文
  await expect(page.locator('.n-message')).toContainText('该客户下还有联系人，请先删除')
})

test('shows the Chinese message when the customer code already exists', async ({ page }) => {
  await mockApi(
    page,
    customerRoutes({
      'POST /customers': (route) =>
        route.fulfill({
          status: 409,
          json: fail(409, 409, 'customer code already exists', 'CUSTOMER_CODE_DUPLICATE'),
        }),
    }),
  )

  await page.goto('/customers')
  await page.getByRole('button', { name: '新增' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()

  await drawerField(page, '编码').fill('C-001')
  await drawerField(page, '名称').fill('重复编码')
  await drawerField(page, '等级').click()
  await page.locator('.n-base-select-option').first().click()

  await drawer.getByRole('button', { name: '保存' }).click()

  await expect(page.locator('.n-message')).toContainText('编码已存在，请更换后重试')
  // 失败后抽屉不关闭，用户可以直接改编码重试
  await expect(drawer).toBeVisible()
})

test('the customer list stays usable at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockApi(page, customerRoutes())

  await page.goto('/customers')
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()

  // 窄屏下筛选栏堆叠，仍可操作
  await expect(fieldInput(page, '关键词')).toBeVisible()
  await expect(page.getByRole('button', { name: '查询' })).toBeVisible()

  // 行操作按钮必须仍可点击（表格容器自己横向滚动，页面不横向溢出）
  for (const name of ['编辑', '删除']) {
    const button = page.getByRole('button', { name }).first()
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeVisible()
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
