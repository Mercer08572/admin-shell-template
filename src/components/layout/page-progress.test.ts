import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bindPageProgress,
  failPageProgress,
  finishPageProgress,
  startPageProgress,
  unbindPageProgress,
} from './page-progress'

function createLoadingBar() {
  return {
    start: vi.fn(),
    finish: vi.fn(),
    error: vi.fn(),
  }
}

describe('page-progress bridge', () => {
  const bar = createLoadingBar()

  beforeEach(() => {
    vi.clearAllMocks()
    bindPageProgress(bar)
  })

  afterEach(() => {
    unbindPageProgress(bar)
  })

  it('delegates start / finish / error to the bound loading bar', () => {
    startPageProgress()
    finishPageProgress()
    failPageProgress()

    expect(bar.start).toHaveBeenCalledTimes(1)
    expect(bar.finish).toHaveBeenCalledTimes(1)
    expect(bar.error).toHaveBeenCalledTimes(1)
  })

  it('does nothing when no loading bar is bound', () => {
    unbindPageProgress(bar)
    vi.clearAllMocks()

    expect(() => {
      startPageProgress()
      finishPageProgress()
      failPageProgress()
    }).not.toThrow()

    expect(bar.start).not.toHaveBeenCalled()
    expect(bar.finish).not.toHaveBeenCalled()
    expect(bar.error).not.toHaveBeenCalled()
  })

  it('finishes the bar when the bound layout unmounts', () => {
    startPageProgress()
    vi.clearAllMocks()

    unbindPageProgress(bar)

    expect(bar.finish).toHaveBeenCalledTimes(1)
  })

  it('ignores unbind calls from a stale loading bar', () => {
    const stale = createLoadingBar()

    unbindPageProgress(stale)
    startPageProgress()

    expect(stale.finish).not.toHaveBeenCalled()
    expect(bar.start).toHaveBeenCalledTimes(1)
  })
})
