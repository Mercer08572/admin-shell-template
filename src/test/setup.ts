/**
 * vitest 全局环境补丁。
 *
 * jsdom 没有实现 `ResizeObserver` 与 `matchMedia`，而 Naive UI 的 NDataTable
 * （经 vueuc）与 `@vueuse/core` 的 `useBreakpoints` 都依赖它们。
 * 只做最小可用的桩，避免为了让测试跑起来而引入新依赖。
 */

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
}
