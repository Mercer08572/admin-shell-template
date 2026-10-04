import { describe, expect, it } from 'vitest'

import {
  closeTab,
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
