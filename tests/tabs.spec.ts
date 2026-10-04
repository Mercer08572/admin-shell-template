import { expect, test, type Page } from '@playwright/test'

import { mockApi, ok, type StubRoute } from './support/api-mock'

/**
 * 外壳：多标签 + 固定 band。
 *
 * 断言重点是**标签集合与 URL 的对应关系**，以及「滚动的是内容区、顶栏与标签条不动」——
 * 这两件事一旦脱钩，页面看起来仍然正常，但用户会被带到错误的页面或点不到按钮。
 */

const now = '2026-01-05T09:30:00Z'

const customer = {
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

/**
 * 列表桩的行数按用例调整：有些断言需要一个「必然比内容区高」的页面。
 * 通过变量而不是二次注册路由来实现，避免依赖 Playwright 的处理器优先级。
 */
let customerRows: (typeof customer)[] = [customer]

function manyCustomers(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    ...customer,
    id: index + 1,
    code: `C-${String(index + 1).padStart(3, '0')}`,
    name: `客户 ${index + 1}`,
  }))
}

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
    respond: (route) => route.fulfill({ json: ok({ items: customerRows, limit: 20, offset: 0 }) }),
  },
  {
    method: 'GET',
    path: '/customers/:id',
    respond: (route) => route.fulfill({ json: ok(customer) }),
  },
  {
    method: 'GET',
    path: '/contacts',
    respond: (route) => route.fulfill({ json: ok({ items: [], limit: 20, offset: 0 }) }),
  },
]

const WORKBENCH = '/'
const CUSTOMERS = '/customers'
const CUSTOMER_DETAIL = '/customers/101'
const PASSWORD = '/account/password'

/** 标签以路由路径为键，Naive UI 会把键渲染到 `data-name` 上 */
function tab(page: Page, path: string) {
  return page.locator(`.n-tabs-tab[data-name="${path}"]`)
}

function allTabs(page: Page) {
  return page.locator('.n-tabs-tab')
}

/**
 * 从工作台的快捷入口跳转（两种宽度下都可见）。
 *
 * 必须等 URL 落地再返回：连续两次不等待的点击会把两次导航压进同一个 tick，
 * 那次被压掉的页面从未渲染，自然也不会留下标签（断言会因此看起来「标签少了」）。
 */
async function openFromQuickLink(page: Page, label: string, path: string) {
  await page.locator('.quick-link').filter({ hasText: label }).click()
  await expect(page).toHaveURL(path)
}

test.beforeEach(async ({ page }) => {
  customerRows = [customer]
  await mockApi(page, routes)
})

test('每个访问过的页面各占一个标签，重复访问不重复开标签', async ({ page }) => {
  await page.goto(WORKBENCH)

  // 工作台常驻且不可关闭：标签上没有关闭按钮
  await expect(allTabs(page)).toHaveCount(1)
  await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)
  await expect(tab(page, WORKBENCH).locator('.n-tabs-tab__close')).toHaveCount(0)

  await openFromQuickLink(page, '客户列表', CUSTOMERS)
  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, CUSTOMERS)).toHaveClass(/n-tabs-tab--active/)
  await expect(page.getByRole('cell', { name: 'C-001', exact: true })).toBeVisible()

  // 点标签切回工作台，再点回来：数量不变（同一个路由只占一个标签）
  await tab(page, WORKBENCH).click()
  await expect(page).toHaveURL(WORKBENCH)
  await tab(page, CUSTOMERS).click()
  await expect(page).toHaveURL(CUSTOMERS)
  await expect(allTabs(page)).toHaveCount(2)

  // 关闭非当前页的标签：停留在当前页面不动
  await tab(page, WORKBENCH).click()
  await tab(page, CUSTOMERS).locator('.n-tabs-tab__close').click()
  await expect(allTabs(page)).toHaveCount(1)
  await expect(page).toHaveURL(WORKBENCH)
})

test('关闭当前页的标签时激活它左侧的标签', async ({ page }) => {
  await page.goto(WORKBENCH)
  await openFromQuickLink(page, '客户列表', CUSTOMERS)
  // 修改密码从用户下拉进入：快捷入口只存在于工作台，这里要验证「任意页面都能开新标签」
  await page.locator('.user-button').click()
  await page.locator('.n-dropdown-option').filter({ hasText: '修改密码' }).click()
  await expect(page).toHaveURL(PASSWORD)
  await expect(allTabs(page)).toHaveCount(3)

  await tab(page, PASSWORD).locator('.n-tabs-tab__close').click()
  await expect(page).toHaveURL(CUSTOMERS)
  await expect(tab(page, CUSTOMERS)).toHaveClass(/n-tabs-tab--active/)
  await expect(allTabs(page)).toHaveCount(2)

  // 再关掉当前页 → 落到保底的工作台
  await tab(page, CUSTOMERS).locator('.n-tabs-tab__close').click()
  await expect(page).toHaveURL(WORKBENCH)
  await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)
  await expect(allTabs(page)).toHaveCount(1)
})

test('深链与刷新后重建为「工作台 + 当前页」', async ({ page }) => {
  await page.goto(CUSTOMER_DETAIL)

  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, CUSTOMER_DETAIL)).toHaveClass(/n-tabs-tab--active/)
  await expect(tab(page, CUSTOMER_DETAIL)).toContainText('客户详情')
  await expect(tab(page, CUSTOMER_DETAIL).locator('.n-tabs-tab__close')).toHaveCount(1)

  await page.reload()
  await expect(page).toHaveURL(CUSTOMER_DETAIL)
  await expect(allTabs(page)).toHaveCount(2)
  await expect(tab(page, WORKBENCH)).toBeVisible()
})

test('左侧菜单跟随当前页面：自动展开分组并高亮', async ({ page }) => {
  const width = page.viewportSize()?.width ?? 0
  test.skip(width < 768, '移动端侧边栏收进抽屉，不做高亮断言')

  const menuItems = page.locator('.app-sidebar .n-menu-item-content')
  const selected = page.locator('.app-sidebar .n-menu-item-content--selected')

  // 深链：挂载时就要展开分组（菜单按路径前缀匹配，`/customers/101` 命中 `/customers`）
  await page.goto(CUSTOMER_DETAIL)
  await expect(menuItems.filter({ hasText: '客户' })).toHaveCount(1)
  await expect(selected.filter({ hasText: '客户' })).toHaveCount(1)

  // 会话内导航（快捷入口）：Naive UI 只在挂载时自动展开祖先分组，
  // 这里必须由外壳自己补上，否则从快捷入口/标签进入分组内页面时菜单看起来「什么都没选中」
  await page.locator('.n-tabs-tab[data-name="/"]').click()
  await expect(page).toHaveURL(WORKBENCH)
  await expect(selected.filter({ hasText: '客户' })).toHaveCount(0)

  await page.locator('.quick-link').filter({ hasText: '客户列表' }).click()
  await expect(page).toHaveURL(CUSTOMERS)
  await expect(menuItems.filter({ hasText: '客户' })).toHaveCount(1)
  await expect(selected.filter({ hasText: '客户' })).toHaveCount(1)
})

test.describe('固定外壳', () => {
  /** 视口压到 400 px 高，页面必然溢出，用来验证「滚动的是内容区、不是窗口」 */
  test.use({ viewport: { width: 1024, height: 400 } })

  test('内容区滚动时顶栏与标签条纹丝不动', async ({ page }) => {
    // 40 行数据把列表页撑得比内容区高，确保滚动的确实是内容区
    customerRows = manyCustomers(40)
    await page.goto(CUSTOMERS)
    await expect(allTabs(page)).toHaveCount(2)

    const geometry = () =>
      page.evaluate(() => {
        const rect = (selector: string) => {
          const element = document.querySelector(selector) as HTMLElement | null
          if (!element) return null
          const box = element.getBoundingClientRect()
          return { top: Math.round(box.top), bottom: Math.round(box.bottom) }
        }
        const content = document.querySelector('.app-content') as HTMLElement
        return {
          topbar: rect('.topbar'),
          tabbar: rect('.tabbar'),
          contentScrollTop: Math.round(content.scrollTop),
          contentScrollable: content.scrollHeight - content.clientHeight,
          windowScrollY: Math.round(window.scrollY),
          windowScrollable:
            document.documentElement.scrollHeight - document.documentElement.clientHeight,
        }
      })

    const before = await geometry()
    expect(before.contentScrollable).toBeGreaterThan(0)
    expect(before.windowScrollable).toBe(0)
    expect(before.topbar?.top).toBe(0)

    await page.evaluate(() => {
      const content = document.querySelector('.app-content') as HTMLElement
      content.scrollTop = content.scrollHeight
    })
    await expect
      .poll(async () => (await geometry()).contentScrollTop)
      .toBe(before.contentScrollable)

    const after = await geometry()
    // 顶栏与标签条原地不动，页面内容在它们下面滚动
    expect(after.topbar).toEqual(before.topbar)
    expect(after.tabbar).toEqual(before.tabbar)
    expect(after.windowScrollY).toBe(0)

    // 滚动到底后标签仍然可点（band 在内容之上，没有被内容盖住）
    await tab(page, WORKBENCH).click()
    await expect(page).toHaveURL(WORKBENCH)
  })
})

test.describe('短页面', () => {
  /** 视口给足高度：工作台内容必然装得下，多出来的滚动条只可能来自错误的高度算式 */
  test.use({ viewport: { width: 1440, height: 1200 } })

  test('不会多出多余的滚动条', async ({ page }) => {
    await page.goto(WORKBENCH)
    await expect(tab(page, WORKBENCH)).toHaveClass(/n-tabs-tab--active/)

    const metrics = await page.evaluate(() => {
      const content = document.querySelector('.app-content') as HTMLElement
      const page = document.querySelector('main.page') as HTMLElement
      return {
        contentHeight: content.clientHeight,
        pageHeight: Math.round(page.getBoundingClientRect().height),
        overflow: content.scrollHeight - content.clientHeight,
      }
    })
    expect(metrics.pageHeight).toBeLessThan(metrics.contentHeight)
    expect(metrics.overflow).toBe(0)
  })
})

test.describe('320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('标签条不换行、不横向溢出，且仍可切换与关闭', async ({ page }) => {
    await page.goto(CUSTOMERS)
    await expect(allTabs(page)).toHaveCount(2)

    // 标签必须排在同一行（换行会把内容区顶下去）
    const boxes = await allTabs(page).evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    )
    expect(new Set(boxes).size).toBe(1)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    await tab(page, WORKBENCH).click()
    await expect(page).toHaveURL(WORKBENCH)
    await tab(page, CUSTOMERS).click()
    await expect(page).toHaveURL(CUSTOMERS)

    // 关闭当前页 → 回到工作台，标签条只剩常驻的那一个
    await tab(page, CUSTOMERS).locator('.n-tabs-tab__close').click()
    await expect(page).toHaveURL(WORKBENCH)
    await expect(allTabs(page)).toHaveCount(1)
  })
})
