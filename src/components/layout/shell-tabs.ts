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

export interface CloseTabResult {
  /** 关闭后的标签集合；被拒时是原集合 */
  tabs: ShellTab[]
  /** 需要跳转的目标；`null` 表示调用方保持当前页面不动 */
  nextActive: string | null
}

/**
 * 关闭标签。
 *
 * 两条规则：
 * - 只有 `closable` 的标签能关（工作台点了也无效，且不能让激活项悬空）；
 * - 关掉**当前页**时激活它左侧的标签（工作台保底）——这是多标签工作台的通行直觉；
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

  return { tabs: next, nextActive: next[index - 1]?.path ?? WORKBENCH_PATH }
}
