/**
 * 应用外壳的多标签状态模型。
 *
 * 这里只放数据模型与纯函数：`AdminShell.vue` 负责把它和 vue-router 接起来。
 * 拆出来的原因是「关闭当前标签后该激活哪一个」这类规则很容易写错，
 * 而它们不依赖组件实例，可以脱离 DOM 直接单测。
 *
 * 约定：
 * - 标签键就是 `route.path`。同一路由的不同筛选条件复用同一个标签，
 *   否则用户在列表页每换一次筛选条件就会多出一个标签（本模板的筛选条件本来也不进 URL）。
 * - 工作台常驻第 0 位且不可关闭；其余标签都可关闭。
 * - 标签集合不持久化：刷新或深链后重建为「工作台 + 当前页」。
 */

export interface ShellTab {
  /** 唯一键，同时是 `NTabs` 的选中值 */
  key: string
  /** 点击标签时 `router.push` 的目标 */
  path: string
  /** 标签文案，取自 `route.meta.title` */
  title: string
  /**
   * 页面在数据到达后自报的标题，优先于 `title`。
   *
   * 详情页的 meta 标题是静态的（如「客户详情」），同一路由打开多个标签时无法区分，
   * 因此允许页面通过 `useShellTabTitle` 覆盖文案。它与 `title` 分开保存而不是直接改写，
   * 是为了让 `openTab` 每次导航仍能按 meta 复位，而展示时优先取这里。
   */
  customTitle?: string
  /** 工作台为 false（不渲染关闭按钮） */
  closable: boolean
}

export const WORKBENCH_PATH = '/'

/** 工作台标签。视为不可变常量，标签集合里的副本一律由 `openTab` 复制而来 */
export const WORKBENCH_TAB: ShellTab = {
  key: WORKBENCH_PATH,
  path: WORKBENCH_PATH,
  title: '工作台',
  closable: false,
}

/** 路由 → 标签。标题的取法必须和 topbar 一致，否则同页两处文案会打架 */
export function toTab(route: { path: string; meta: { title?: string } }): ShellTab {
  return {
    key: route.path,
    path: route.path,
    title: route.meta.title ?? 'Admin Shell',
    closable: route.path !== WORKBENCH_PATH,
  }
}

/**
 * 登记一个标签：已存在则原位更新标题（不重排、不重复），否则追加到末尾。
 *
 * 无变化时返回原数组引用，避免 `watch` 里每次导航都触发一次无意义的重渲染。
 */
export function openTab(tabs: readonly ShellTab[], tab: ShellTab): ShellTab[] {
  const current = tabs.find((item) => item.key === tab.key)
  if (!current) return [...tabs, tab]

  if (current.title === tab.title && current.path === tab.path) return tabs as ShellTab[]

  return tabs.map((item) =>
    item.key === tab.key ? { ...item, title: tab.title, path: tab.path } : item,
  )
}

/**
 * 用页面自报的标题覆盖某个标签的文案。
 *
 * 与 `openTab` 分开：`openTab` 在每次导航时按 meta 标题复位，若直接改 `title`，
 * 切回该标签的瞬间会闪回「客户详情」再变回真实标题；写到 `customTitle` 就不会。
 * 标签不存在（数据晚于标签关闭才到达）或标题无变化时返回原引用，避免无意义重渲染。
 */
export function retitleTab(tabs: readonly ShellTab[], key: string, title: string): ShellTab[] {
  const index = tabs.findIndex((item) => item.key === key)
  if (index === -1) return tabs as ShellTab[]

  const current = tabs[index]
  if (!current || !title || current.customTitle === title) return tabs as ShellTab[]

  const next = [...tabs]
  next[index] = { ...current, customTitle: title }
  return next
}

export interface CloseTabResult {
  /** 关闭后的标签集合；被拒时是原集合 */
  tabs: ShellTab[]
  /** 需要跳转的目标；`null` 表示调用方保持当前页面不动 */
  nextActive: string | null
}

/**
 * 关闭后应该激活谁。
 *
 * 当前页仍然存在就不动（`null`）；被关掉时取**原顺序中它左侧最近的幸存标签**，
 * 工作台保底。右侧标签不参与，否则用户会被甩到后面去——这是多标签工作台的通行直觉。
 * 单个关闭与右键批量关闭共用这一条，避免两处各写一遍后走偏。
 */
function pickNextActive(
  previous: readonly ShellTab[],
  remaining: readonly ShellTab[],
  activeKey: string,
): string | null {
  if (remaining.some((tab) => tab.key === activeKey)) return null

  const activeIndex = previous.findIndex((tab) => tab.key === activeKey)
  for (let index = activeIndex - 1; index >= 0; index -= 1) {
    const candidate = previous[index]
    if (candidate && remaining.some((tab) => tab.key === candidate.key)) return candidate.path
  }
  return WORKBENCH_PATH
}

/**
 * 关闭标签。
 *
 * 两条规则：
 * - 只有 `closable` 的标签能关（工作台点了也无效，且不能让激活项悬空）；
 * - 关掉**当前页**时激活它左侧的标签（工作台保底）；
 *   关掉**非当前页**时当前页面不动，否则用户会被莫名其妙地跳走。
 */
export function closeTab(
  tabs: readonly ShellTab[],
  key: string,
  activeKey: string,
): CloseTabResult {
  const index = tabs.findIndex((item) => item.key === key)
  const target = tabs[index]
  if (!target || !target.closable) return { tabs: tabs as ShellTab[], nextActive: null }

  const next = tabs.filter((item) => item.key !== key)
  if (key !== activeKey) return { tabs: next, nextActive: null }

  return { tabs: next, nextActive: pickNextActive(tabs, next, activeKey) }
}

/** 右键菜单的批量关闭模式，取值与菜单项一一对应（见 `AdminShell.vue`） */
export type CloseMode = 'left' | 'right' | 'others' | 'all'

/**
 * 以某个标签为锚点批量关闭。
 *
 * 四种模式只影响「范围」，`closable` 永远是硬约束：工作台在任何模式下都不会被关掉，
 * 即使锚点就在它右边、或者选的是「关闭所有」。锚点自身是否保留由模式决定：
 * - `left` / `right` / `others`：锚点保留；
 * - `all`：全部可关闭标签都关掉（锚点若可关闭也一起关）。
 *
 * 没有标签可关时返回**原数组引用**与 `nextActive: null`，调用方不会触发无意义的重渲染。
 */
export function closeTabsBy(
  tabs: readonly ShellTab[],
  anchorKey: string,
  mode: CloseMode,
  activeKey: string,
): CloseTabResult {
  const anchorIndex = tabs.findIndex((tab) => tab.key === anchorKey)
  if (anchorIndex === -1) return { tabs: tabs as ShellTab[], nextActive: null }

  const shouldClose = (tab: ShellTab, index: number): boolean => {
    if (!tab.closable) return false
    switch (mode) {
      case 'left':
        return index < anchorIndex
      case 'right':
        return index > anchorIndex
      case 'others':
        return index !== anchorIndex
      case 'all':
        return true
    }
  }

  const next = tabs.filter((tab, index) => !shouldClose(tab, index))
  if (next.length === tabs.length) return { tabs: tabs as ShellTab[], nextActive: null }

  return { tabs: next, nextActive: pickNextActive(tabs, next, activeKey) }
}
