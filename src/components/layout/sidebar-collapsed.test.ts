import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  readSidebarCollapsed,
  SIDEBAR_COLLAPSED_KEY,
  writeSidebarCollapsed,
} from './sidebar-collapsed'

describe('readSidebarCollapsed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to expanded when nothing is stored', () => {
    expect(readSidebarCollapsed()).toBe(false)
  })

  it('reads back what was written', () => {
    writeSidebarCollapsed(true)
    expect(readSidebarCollapsed()).toBe(true)

    writeSidebarCollapsed(false)
    expect(readSidebarCollapsed()).toBe(false)
  })

  it('treats an unexpected stored value as expanded', () => {
    // 手工改过存储、或旧版本写过别的格式：只有 '1' 才算收起
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'collapsed')
    expect(readSidebarCollapsed()).toBe(false)
  })

  it('falls back to expanded when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(readSidebarCollapsed()).toBe(false)
    getItem.mockRestore()
  })
})

describe('writeSidebarCollapsed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('swallows storage failures instead of breaking the toggle', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(() => writeSidebarCollapsed(true)).not.toThrow()
    setItem.mockRestore()
  })
})
