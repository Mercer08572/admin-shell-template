import { expect, test, type Locator, type Page } from '@playwright/test'

import { mockApi, ok } from './support/api-mock'

/**
 * 侧栏可收窄为图标栏。
 *
 * 两组断言各自的落点：
 * 1. 「变窄之后名称怎么还能被看到」——Naive 折叠态把菜单项名称设成 `opacity: 0`
 *    （元素还在 DOM 里，不是 `display: none`），hover 时才用 tooltip / dropdown 展示；
 *    所以断言的是 opacity 与悬浮浮层，而不是元素存不存在。
 * 2. 「开关和菜单图标长得一样、且钉在底部」——颜色/尺寸直接与相邻的非选中菜单项比对，
 *    位置用几何关系锁定（菜单占满中间、开关贴着底边），避免以后样式漂移回不一致。
 */

const EXPANDED_WIDTH = 232
const COLLAPSED_WIDTH = 64

/**
 * 非选中菜单项：作为「常规菜单图标」的基准（选中项会变白，不适合当基准）。
 * 这里选「工作台」——下面的一致性用例会先切到 `/customers`，此时它是非选中的顶层叶子项。
 */
const REFERENCE_ITEM = '工作台'

const siderWidth = (page: Page) =>
  page
    .locator('.app-sidebar')
    .evaluate((element) => Math.round(element.getBoundingClientRect().width))

/** 菜单项：折叠后名称仍在该元素的 textContent 里（只是 opacity: 0），因此可以按文本定位 */
const menuItem = (page: Page, label: string) =>
  page.locator('.app-sidebar .n-menu-item').filter({ hasText: label })

const menuIcon = (page: Page) =>
  menuItem(page, REFERENCE_ITEM).locator('.n-menu-item-content__icon svg')
const menuLabel = (page: Page) =>
  menuItem(page, REFERENCE_ITEM).locator('.n-menu-item-content-header')

const toggleButton = (page: Page) => page.locator('.sider-toggle')
const toggleIcon = (page: Page) => page.locator('.sider-toggle__icon svg')

/** 图标的外观与横向位置：颜色、渲染尺寸、中心点（用于和菜单图标对同一条竖线） */
const iconStyle = (locator: Locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      color: getComputedStyle(element).color,
      size: Math.round(rect.width),
      center: Math.round(rect.left + rect.width / 2),
    }
  })

/** 文字起点：开关的文字要与菜单项文字左对齐 */
const textLeft = (locator: Locator) =>
  locator.evaluate((element) => Math.round(element.getBoundingClientRect().left))

const box = (locator: Locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) }
  })

async function collapse(page: Page) {
  await page.getByRole('button', { name: '收起导航' }).click()
  await expect.poll(() => siderWidth(page)).toBe(COLLAPSED_WIDTH)
}

test.beforeEach(async ({ page }) => {
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
      respond: (route) =>
        route.fulfill({
          json: ok({
            items: [
              {
                id: 101,
                code: 'C-001',
                name: '华南贸易',
                level: 'important',
                status: 'active',
                phone: '13800000001',
                remark: null,
                created_at: '2026-01-05T09:30:00Z',
                updated_at: '2026-01-05T09:30:00Z',
              },
            ],
            limit: 20,
            offset: 0,
          }),
        }),
    },
  ])
})

test.describe('侧栏折叠（桌面）', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('收起后只剩图标，悬浮图标显示菜单名', async ({ page }) => {
    await page.goto('/')
    expect(await siderWidth(page)).toBe(EXPANDED_WIDTH)

    await collapse(page)

    // 品牌文字让位（这里是 display: none），菜单名称变成不可见但不占视觉空间
    await expect(page.locator('.brand__title')).toBeHidden()
    await expect(page.locator('.app-sidebar .n-menu-item-content-header').first()).toHaveCSS(
      'opacity',
      '0',
    )

    // 叶子项：hover 出 tooltip（Naive 的 NTooltip 只在 collapsed 时启用）
    await menuItem(page, '工作台').hover()
    await expect(page.locator('.n-tooltip').filter({ hasText: '工作台' })).toBeVisible()

    // 分组：hover 出下拉，列出子项名称
    await menuItem(page, '业务示例').hover()
    await expect(page.locator('.n-dropdown').filter({ hasText: '客户' })).toBeVisible()
  })

  test('开关钉在侧栏底部，颜色与尺寸和菜单图标一致', async ({ page }) => {
    // 先进入客户页：这样「工作台」成为非选中的常规菜单项，可与开关逐项比对
    await page.goto('/customers')
    await page.getByRole('cell', { name: 'C-001', exact: true }).waitFor()

    // 位置：菜单占满中间，开关贴着侧栏底边
    const [sidebar, menu, footer] = await Promise.all([
      box(page.locator('.app-sidebar')),
      box(page.locator('.app-sidebar .n-menu')),
      box(page.locator('.sider-footer')),
    ])
    expect(footer.top).toBe(menu.bottom)
    expect(sidebar.bottom - footer.bottom).toBeLessThanOrEqual(1)

    // 默认态与相邻的非选中菜单项完全一致：同为 #bbb、同为 20px，且图标中心在同一条竖线上
    const expandedMenuIcon = await iconStyle(menuIcon(page))
    expect(expandedMenuIcon).toEqual({ color: 'rgb(187, 187, 187)', size: 20, center: 32 })
    expect(await iconStyle(toggleIcon(page))).toEqual(expandedMenuIcon)

    // 文字起点也与菜单项文字对齐
    expect(await textLeft(page.locator('.sider-toggle__label'))).toBe(
      await textLeft(menuLabel(page)),
    )

    // 悬浮态也一致：两边都变白，且背景不变（与菜单项一样）
    await toggleButton(page).hover()
    await expect
      .poll(async () => (await iconStyle(toggleIcon(page))).color)
      .toBe('rgb(255, 255, 255)')
    expect(
      await toggleButton(page).evaluate((element) => getComputedStyle(element).backgroundColor),
    ).toBe('rgba(0, 0, 0, 0)')

    await menuItem(page, REFERENCE_ITEM).hover()
    await expect
      .poll(async () => (await iconStyle(menuIcon(page))).color)
      .toBe('rgb(255, 255, 255)')

    // 折叠后与菜单图标一起变成 24px，并一起居中在 64px 栏内（中心仍是 32）
    await collapse(page)
    const collapsedMenuIcon = await iconStyle(menuIcon(page))
    const collapsedToggleIcon = await iconStyle(toggleIcon(page))
    expect(collapsedMenuIcon.size).toBe(24)
    expect(collapsedToggleIcon.size).toBe(24)
    expect(collapsedToggleIcon.center).toBe(collapsedMenuIcon.center)
  })

  test('宽度过渡期间：图标不跳动、文字不竖排、不冒横向滚动条', async ({ page }) => {
    await page.goto('/')
    // 必须等外壳挂载完成：`page.goto` 在 load 事件就返回，而外壳要等会话 bootstrap
    // 完成才渲染，过早采样会拿到 null
    await page.locator('.sider-toggle').waitFor()

    /**
     * 采集一次宽度过渡里的逐帧数据。
     *
     * 横向滚动条必须**扫描侧栏整棵子树**：Naive 给 sider 内容区（`.n-layout-sider-scroll-container`）
     * 打了内联 `overflow: auto`，只要某一层子项比容器宽就会渲染出滚动条——
     * 曾经只盯 `.n-menu` / `.sider-footer` 两个元素，漏掉了容器本身，于是「展开时闪一下」没被拦住。
     */
    const sample = () =>
      page.evaluate(() => {
        const query = (selector: string) => document.querySelector(selector) as HTMLElement
        const icon = query('.sider-toggle__icon')
        const label = query('.sider-toggle__label')
        const mark = query('.brand__mark')
        const title = query('.brand__title')
        const sidebar = query('.app-sidebar')

        const withHorizontalScrollbar: string[] = []
        for (const element of sidebar.querySelectorAll('*')) {
          if (!(element instanceof HTMLElement)) continue
          const style = getComputedStyle(element)
          const verticalBorders =
            parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
          // 真的渲染了横向滚动条时，clientHeight 会小于「内容高度 - 上下边框」
          const renderedBar = element.offsetHeight - element.clientHeight - verticalBorders
          const scrollable =
            element.scrollWidth > element.clientWidth &&
            style.overflowX !== 'visible' &&
            style.overflowX !== 'hidden'
          if (renderedBar > 0 || scrollable) {
            withHorizontalScrollbar.push(
              `${element.tagName.toLowerCase()}.${element.className.toString().split(' ')[0]}`,
            )
          }
        }

        return {
          siderWidth: Math.round(sidebar.getBoundingClientRect().width),
          iconLeft: Math.round(icon.getBoundingClientRect().left),
          labelHeight: Math.round(label.getBoundingClientRect().height),
          markLeft: Math.round(mark.getBoundingClientRect().left * 10) / 10,
          markWidth: Math.round(mark.getBoundingClientRect().width),
          markHeight: Math.round(mark.getBoundingClientRect().height),
          titleHeight: Math.round(title.getBoundingClientRect().height),
          titleOpacity: Number(getComputedStyle(title).opacity),
          withHorizontalScrollbar: [...new Set(withHorizontalScrollbar)],
          pageOverflowX:
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })

    /** 点一下再密集采样：20ms × 16 ≈ 覆盖 300ms 的宽度过渡；结束后补一帧用于终态断言 */
    const collect = async (target: number) => {
      const samples = []
      await page.locator('.sider-toggle').click()
      for (let index = 0; index < 16; index += 1) {
        samples.push(await sample())
        await page.waitForTimeout(20)
      }
      await expect.poll(() => siderWidth(page)).toBe(target)
      return { samples, settled: await sample() }
    }

    for (const target of [COLLAPSED_WIDTH, EXPANDED_WIDTH]) {
      const { samples, settled } = await collect(target)

      // 图标在整段过渡里原地不动（上一版「先跳到中间再缩回左边」的回归点）
      const lefts = samples.map((item) => item.iconLeft)
      expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(1)

      // 文字始终单行：竖排时行高会涨到几十像素
      expect(Math.max(...samples.map((item) => item.labelHeight))).toBeLessThanOrEqual(24)

      // 品牌区标记同样不允许瞬时跳变：允许 20↔15 的平滑滑动，但单帧位移必须很小
      const markLefts = samples.map((item) => item.markLeft)
      const stepDeltas = markLefts
        .slice(1)
        .map((value, index) => Math.abs((value - markLefts[index]) as number))
      expect(Math.max(...stepDeltas)).toBeLessThanOrEqual(2)

      /*
       * 与 Naive 的宽度过渡**同步**：栏宽走到一半时，品牌标记也必须走到一半（±20%）。
       * 这条用来兜住 `--shell-collapse-duration` 与 Naive 内部时长的一致性——
       * 若哪天两边时长不同（例如又有人写回 0.2s），这里会先红，而不是靠肉眼看出错位。
       */
      const progress = (from: number, to: number, value: number) =>
        from === to ? 1 : (from - value) / (from - to)
      const widths = samples.map((item) => item.siderWidth)
      const marks = samples.map((item) => item.markLeft)
      const closestToHalf = samples
        .map((_, index) => ({
          width: progress(
            widths[0] as number,
            widths[widths.length - 1] as number,
            widths[index] as number,
          ),
          mark: progress(
            marks[0] as number,
            marks[marks.length - 1] as number,
            marks[index] as number,
          ),
        }))
        .reduce((best, current) =>
          Math.abs(current.width - 0.5) < Math.abs(best.width - 0.5) ? current : best,
        )
      expect(Math.abs(closestToHalf.width - closestToHalf.mark)).toBeLessThanOrEqual(0.2)

      // 品牌标记不能被压扁：整段过渡里恒为 34×34（折叠栏窄，flex 默认会把它压到图标宽度）
      expect([...new Set(samples.map((item) => `${item.markWidth}×${item.markHeight}`))]).toEqual([
        '34×34',
      ])

      // 品牌文字被裁掉而不是换行
      expect(Math.max(...samples.map((item) => item.titleHeight))).toBeLessThanOrEqual(30)

      // 终态（抓过渡结束后的那一帧）：标记展开态与菜单图标左对齐（x=20），折叠态栏内居中（x=15）
      const isCollapsed = target === COLLAPSED_WIDTH
      expect(settled.markLeft).toBe(isCollapsed ? 15 : 20)
      expect(isCollapsed ? settled.titleOpacity : 1 - settled.titleOpacity).toBeLessThan(0.05)

      // 任何一帧都不应出现横向滚动条（扫描侧栏整棵子树）
      expect([...new Set(samples.flatMap((item) => item.withHorizontalScrollbar))]).toEqual([])
      expect(Math.max(...samples.map((item) => item.pageOverflowX))).toBeLessThanOrEqual(1)
    }
  })

  test('再点一次展开，名称恢复', async ({ page }) => {
    await page.goto('/')
    await collapse(page)

    await page.getByRole('button', { name: '展开导航' }).click()
    await expect.poll(() => siderWidth(page)).toBe(EXPANDED_WIDTH)
    await expect(page.locator('.brand__title')).toBeVisible()
    await expect(page.locator('.app-sidebar .n-menu-item-content-header').first()).toHaveCSS(
      'opacity',
      '1',
    )
  })

  test('折叠状态在刷新后保持', async ({ page }) => {
    await page.goto('/')
    await collapse(page)

    await page.reload()
    await expect.poll(() => siderWidth(page)).toBe(COLLAPSED_WIDTH)
    await expect(page.getByRole('button', { name: '展开导航' })).toBeVisible()
  })

  test('折叠后仍能从图标导航（悬浮分组选子项）', async ({ page }) => {
    await page.goto('/')
    await collapse(page)

    await menuItem(page, '业务示例').hover()
    await page.locator('.n-dropdown').getByText('客户', { exact: true }).click()

    await expect(page).toHaveURL('/customers')
    // 新页面照常作为标签打开，说明折叠只影响侧栏，不影响多标签外壳
    await expect(page.locator('.n-tabs-tab[data-name="/customers"]')).toBeVisible()
  })
})

test.describe('移动端 320 px', () => {
  test.use({ viewport: { width: 320, height: 720 } })

  test('侧栏由抽屉代替，不出现折叠开关', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('.app-sidebar')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '收起导航' })).toHaveCount(0)

    // 抽屉里始终显示名称，不做折叠
    await page.getByRole('button', { name: '打开导航' }).click()
    const drawer = page.locator('.n-drawer')
    await expect(drawer.locator('.n-menu-item-content-header').first()).toBeVisible()
    await drawer.locator('.n-menu-item-content').filter({ hasText: '业务示例' }).click()
    await drawer.locator('.n-menu-item-content').filter({ hasText: '客户' }).click()
    await expect(page).toHaveURL('/customers')
  })
})
