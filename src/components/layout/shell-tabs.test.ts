import { describe, expect, it } from 'vitest'

import {
  closeTab,
  closeTabsBy,
  openTab,
  toTab,
  WORKBENCH_PATH,
  WORKBENCH_TAB,
  type ShellTab,
} from './shell-tabs'

function tab(path: string, title = path): ShellTab {
  return { key: path, path, title, closable: path !== WORKBENCH_PATH }
}

const customers = tab('/customers', '客户')
const password = tab('/account/password', '修改密码')

describe('toTab', () => {
  it('uses the route meta title and path', () => {
    expect(toTab({ path: '/customers', meta: { title: '客户' } })).toEqual({
      key: '/customers',
      path: '/customers',
      title: '客户',
      closable: true,
    })
  })

  it('falls back to the app name when the route has no title', () => {
    expect(toTab({ path: '/customers', meta: {} }).title).toBe('Admin Shell')
  })

  it('keeps the workbench unclosable even when built from the dashboard route', () => {
    expect(toTab({ path: WORKBENCH_PATH, meta: { title: '工作台' } })).toEqual(WORKBENCH_TAB)
  })
})

describe('openTab', () => {
  it('appends a new tab at the end', () => {
    expect(openTab([WORKBENCH_TAB], customers)).toEqual([WORKBENCH_TAB, customers])
  })

  it('never opens the same route twice', () => {
    const opened = openTab(openTab([WORKBENCH_TAB], customers), customers)
    expect(opened).toHaveLength(2)
  })

  it('updates the title in place and keeps the order', () => {
    const opened = openTab([WORKBENCH_TAB, customers, password], tab('/customers', '客户（改）'))
    expect(opened).toEqual([WORKBENCH_TAB, tab('/customers', '客户（改）'), password])
  })

  it('returns the same array when nothing changed', () => {
    const current = [WORKBENCH_TAB, customers]
    expect(openTab(current, customers)).toBe(current)
  })
})

describe('closeTab', () => {
  it('refuses to close the workbench', () => {
    const current = [WORKBENCH_TAB, customers]
    expect(closeTab(current, WORKBENCH_PATH, WORKBENCH_PATH)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })

  it('ignores an unknown key', () => {
    const current = [WORKBENCH_TAB, customers]
    expect(closeTab(current, '/nope', '/nope').tabs).toBe(current)
  })

  it('keeps the current page when another tab is closed', () => {
    const result = closeTab([WORKBENCH_TAB, customers, password], password.path, customers.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, customers])
    expect(result.nextActive).toBeNull()
  })

  it('activates the tab on the left when the current page is closed', () => {
    const result = closeTab([WORKBENCH_TAB, customers, password], password.path, password.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, customers])
    expect(result.nextActive).toBe(customers.path)
  })

  it('falls back to the workbench when the only other tab is closed', () => {
    const result = closeTab([WORKBENCH_TAB, customers], customers.path, customers.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })
})

describe('closeTabsBy', () => {
  const detail = tab('/customers/101', '客户 C-001')
  // 工作台永远是第 0 位；它右边才是可关闭的标签
  const four = [WORKBENCH_TAB, customers, detail, password]

  it('closes only the closable tabs on the right of the anchor', () => {
    const result = closeTabsBy(four, detail.path, 'right', detail.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, customers, detail])
    // 当前页还在，不跳转
    expect(result.nextActive).toBeNull()
  })

  it('closes only the closable tabs on the left of the anchor', () => {
    const result = closeTabsBy(four, detail.path, 'left', detail.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, detail, password])
    expect(result.nextActive).toBeNull()
  })

  it('never closes the workbench when it sits on the left of the anchor', () => {
    const result = closeTabsBy(four, password.path, 'left', password.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, password])
    expect(result.tabs[0]).toBe(WORKBENCH_TAB)
    expect(result.nextActive).toBeNull()
  })

  it('closes everything except the anchor and the workbench', () => {
    const result = closeTabsBy(four, detail.path, 'others', detail.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB, detail])
    expect(result.nextActive).toBeNull()
  })

  it('closes only the workbench left when closing all', () => {
    const result = closeTabsBy(four, detail.path, 'all', detail.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    // 当前页被关掉：落到工作台
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })

  it('keeps the workbench as the anchor and closes the other tabs', () => {
    const result = closeTabsBy(four, WORKBENCH_PATH, 'others', customers.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)
  })

  it('activates the nearest surviving tab on the left of a closed current page', () => {
    const result = closeTabsBy([WORKBENCH_TAB, customers], customers.path, 'all', customers.path)
    expect(result.tabs).toEqual([WORKBENCH_TAB])
    expect(result.nextActive).toBe(WORKBENCH_PATH)

    // 当前页左侧还有幸存标签时选最近的那个，而不是直接回工作台
    const detailTab = tab('/customers/202', '客户 C-002')
    const result2 = closeTabsBy(
      [WORKBENCH_TAB, customers, detailTab, password],
      detailTab.path,
      'right',
      password.path,
    )
    expect(result2.tabs).toEqual([WORKBENCH_TAB, customers, detailTab])
    expect(result2.nextActive).toBe(detailTab.path)
  })

  it('does not touch the current page when it survives', () => {
    const result = closeTabsBy(four, customers.path, 'right', WORKBENCH_PATH)
    expect(result.nextActive).toBeNull()
  })

  it('returns the same array when there is nothing to close', () => {
    const onlyWorkbench = [WORKBENCH_TAB]
    expect(closeTabsBy(onlyWorkbench, WORKBENCH_PATH, 'all', WORKBENCH_PATH)).toEqual({
      tabs: onlyWorkbench,
      nextActive: null,
    })
    expect(closeTabsBy(onlyWorkbench, WORKBENCH_PATH, 'left', WORKBENCH_PATH).tabs).toBe(
      onlyWorkbench,
    )

    // 锚点是末尾标签：右侧无可关闭项
    const current = [WORKBENCH_TAB, customers]
    expect(closeTabsBy(current, customers.path, 'right', customers.path)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })

  it('ignores an unknown anchor', () => {
    const current = [WORKBENCH_TAB, customers]
    expect(closeTabsBy(current, '/nope', 'all', customers.path)).toEqual({
      tabs: current,
      nextActive: null,
    })
  })
})
