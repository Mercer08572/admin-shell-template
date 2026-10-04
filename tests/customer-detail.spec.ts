import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  fieldInput,
  mockApi,
  ok,
  fail,
  type StubResponder,
  type StubRoute,
} from './support/api-mock'

/**
 * 客户详情页（基础信息 + 联系人子表）的端到端验证。
 *
 * 关键断言不是「页面上有字」，而是**请求形状**：子表只按 `customer_id` 取数、
 * 新增联系人时 `customer_id` 恒为当前客户——这两条出错时页面看起来仍然正常。
 */

const CUSTOMER_ID = 101
const now = '2026-01-05T09:30:00Z'

const customer = {
  id: CUSTOMER_ID,
  code: 'C-001',
  name: '华南贸易',
  level: 'important',
  status: 'active',
  phone: '13800000001',
  remark: '合作 3 年',
  created_at: now,
  updated_at: now,
}

const decisionMaker = {
  id: 201,
  customer_id: CUSTOMER_ID,
  code: 'CT-001',
  name: '王经理',
  phone: '13900000001',
  role: 'decision_maker',
  remark: null,
  status: 'active',
  created_at: now,
  updated_at: now,
}

const assistant = {
  ...decisionMaker,
  id: 202,
  code: 'CT-002',
  name: '李助理',
  phone: '13900000002',
  role: 'user',
}

/** 基础信息里某个字段的取值元素（标签与取值分开渲染） */
function factValue(page: Page, label: string): Locator {
  return page
    .locator('.customer-fact')
    .filter({ has: page.locator('dt', { hasText: label }) })
    .locator('dd')
}

/** NSelect 的选中值渲染在 `.n-base-selection-label`，而 input.value 始终为空 */
function selectionLabel(page: Page, label: string): Locator {
  return page
    .locator('.n-drawer .n-form-item')
    .filter({ has: page.locator('.n-form-item-label', { hasText: label }) })
    .locator('.n-base-selection-label')
}

type RouteKey =
  | 'GET /customers'
  | 'GET /customers/:id'
  | 'GET /contacts'
  | 'POST /contacts'
  | 'PUT /contacts/:id'
  | 'DELETE /contacts/:id'

function detailRoutes(
  overrides: Partial<Record<RouteKey, StubResponder>> = {},
  onContactList?: (url: URL) => void,
): StubRoute[] {
  const routes: StubRoute[] = [
    {
      method: 'GET',
      path: '/customers',
      respond: (route) => route.fulfill({ json: ok({ items: [customer], limit: 20, offset: 0 }) }),
    },
    {
      method: 'GET',
      path: '/customers/:id',
      respond: (route) => route.fulfill({ json: ok(customer) }),
    },
    {
      method: 'GET',
      path: '/contacts',
      respond: (route) => {
        const url = new URL(route.request().url())
        onContactList?.(url)
        // 只有按当前客户过滤时才返回数据：漏传 customer_id 会立刻暴露成空表
        const filtered = url.searchParams.get('customer_id') === String(CUSTOMER_ID)
        const items = filtered ? [decisionMaker, assistant] : []
        return route.fulfill({ json: ok({ items, limit: 100, offset: 0 }) })
      },
    },
    {
      method: 'POST',
      path: '/contacts',
      respond: (route) => route.fulfill({ json: ok(assistant) }),
    },
    {
      method: 'PUT',
      path: '/contacts/:id',
      respond: (route) => route.fulfill({ json: ok(decisionMaker) }),
    },
    {
      method: 'DELETE',
      path: '/contacts/:id',
      respond: (route) => route.fulfill({ json: ok(null) }),
    },
  ]

  return routes.map((route) => {
    const override = overrides[`${route.method} ${route.path}` as RouteKey]
    return override ? { ...route, respond: override } : route
  })
}

test('opens customer 101 from the list and lists only its contacts', async ({ page }) => {
  const contactListUrls: URL[] = []

  await mockApi(
    page,
    detailRoutes({}, (url) => contactListUrls.push(url)),
  )

  // 从客户列表进入详情（列表页的 detailRoute 配置）
  await page.goto('/customers')
  await page.getByRole('button', { name: '详情' }).first().click()
  await expect(page).toHaveURL(`/customers/${CUSTOMER_ID}`)

  // 基础信息按「标签 / 取值」成对渲染：校验每一对，而不是整段文本
  await expect(page.getByRole('heading', { name: '客户 C-001 - 华南贸易' })).toBeVisible()
  await expect(factValue(page, '编码')).toHaveText('C-001')
  await expect(factValue(page, '名称')).toHaveText('华南贸易')
  await expect(factValue(page, '等级')).toHaveText('重要')
  await expect(factValue(page, '状态')).toHaveText('正常')
  await expect(factValue(page, '电话')).toHaveText('13800000001')
  await expect(factValue(page, '备注')).toHaveText('合作 3 年')

  // 子表只查当前客户，且只带这三个参数
  expect(contactListUrls).toHaveLength(1)
  const url = contactListUrls[0]!
  expect(url.searchParams.get('customer_id')).toBe(String(CUSTOMER_ID))
  expect([...url.searchParams.keys()].sort()).toEqual(['customer_id', 'limit', 'offset'])

  // 子表内容：联系人自己的列（不出现「所属客户」列）
  await expect(page.getByRole('heading', { name: '联系人（2）' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'CT-001', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '王经理' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '决策人' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '所属客户' })).toHaveCount(0)
})

test('adds a contact from the detail page with the customer pinned', async ({ page }) => {
  const postBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    detailRoutes({
      'POST /contacts': async (route) => {
        postBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: ok(assistant) })
      },
    }),
  )

  await page.goto(`/customers/${CUSTOMER_ID}`)
  await expect(page.getByRole('cell', { name: 'CT-001', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '新增联系人' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()

  // 所属客户锁定为当前客户：界面上不可改，但值一定进载荷
  await expect(selectionLabel(page, '所属客户')).toHaveText(`当前客户 #${CUSTOMER_ID}`)
  await expect(fieldInput(page, '所属客户')).toBeDisabled()

  await fieldInput(page, '编码').fill('CT-003')
  await fieldInput(page, '姓名').fill('赵主管')
  await fieldInput(page, '电话').fill('13900000003')
  await fieldInput(page, '角色').click()
  await page.locator('.n-base-select-option').filter({ hasText: '使用人' }).click()

  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => postBodies.length).toBe(1)
  expect(postBodies[0]).toEqual({
    customer_id: CUSTOMER_ID,
    code: 'CT-003',
    name: '赵主管',
    phone: '13900000003',
    role: 'user',
    status: 'active',
    remark: null,
  })
})

test('edits a contact in place with the customer still pinned', async ({ page }) => {
  const putBodies: Array<Record<string, unknown>> = []

  await mockApi(
    page,
    detailRoutes({
      'PUT /contacts/:id': async (route) => {
        putBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        await route.fulfill({ json: ok(decisionMaker) })
      },
    }),
  )

  await page.goto(`/customers/${CUSTOMER_ID}`)
  await expect(page.getByRole('cell', { name: 'CT-001', exact: true })).toBeVisible()

  // 编辑的是第一行（决策人），不是新增
  await page.locator('tbody tr').first().getByRole('button', { name: '编辑' }).click()

  const drawer = page.locator('.n-drawer')
  await expect(drawer.getByText('编辑联系人')).toBeVisible()

  // 预填来自子表已有的行（契约没有 GET /contacts/:id）
  await expect(fieldInput(page, '编码')).toHaveValue('CT-001')
  await expect(fieldInput(page, '姓名')).toHaveValue('王经理')
  await expect(selectionLabel(page, '所属客户')).toHaveText(`当前客户 #${CUSTOMER_ID}`)

  await fieldInput(page, '姓名').fill('王经理（改）')
  await drawer.getByRole('button', { name: '保存' }).click()

  await expect.poll(() => putBodies.length).toBe(1)
  expect(putBodies[0]).toEqual({
    customer_id: CUSTOMER_ID,
    code: 'CT-001',
    name: '王经理（改）',
    phone: '13900000001',
    role: 'decision_maker',
    status: 'active',
    remark: null,
  })
})

test('shows an error with retry when the contacts request fails, then recovers', async ({
  page,
}) => {
  let attempts = 0

  await mockApi(
    page,
    detailRoutes({
      'GET /contacts': (route) => {
        attempts += 1
        if (attempts === 1) {
          return route.fulfill({
            status: 500,
            json: fail(500, 1000, 'internal error', 'INTERNAL_ERROR'),
          })
        }
        return route.fulfill({
          json: ok({ items: [decisionMaker, assistant], limit: 100, offset: 0 }),
        })
      },
    }),
  )

  await page.goto(`/customers/${CUSTOMER_ID}`)

  // 联系人这一块自己给出错误与重试入口，不拖垮基础信息
  await expect(page.locator('.async-state__error')).toContainText('internal error')
  await expect(page.locator('.async-state__error')).toContainText('trace-e2e')

  await page.getByRole('button', { name: '重试' }).click()

  await expect(page.getByRole('cell', { name: 'CT-001', exact: true })).toBeVisible()
  await expect(page.locator('.async-state__error')).toHaveCount(0)
})

test('the customer detail page fits a 320 px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await mockApi(page, detailRoutes())

  await page.goto(`/customers/${CUSTOMER_ID}`)
  await expect(page.getByRole('cell', { name: 'CT-001', exact: true })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  // 窄屏下也要能进入新增联系人的抽屉
  await page.getByRole('button', { name: '新增联系人' }).click()
  const drawer = page.locator('.n-drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: '保存' })).toBeVisible()
})
