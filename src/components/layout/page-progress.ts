import type { LoadingBarApi } from 'naive-ui'

/**
 * 路由与布局之间的桥接层。
 *
 * `useLoadingBar()` 依赖组件 `inject`，只能在 `NLoadingBarProvider` 的子树里调用；
 * 而路由守卫是普通模块代码，没有组件实例，不能直接使用它。因此由 `AdminShell`
 * 在 setup 里拿到 API 后注册到这里，路由模块只调用 start / finish / error。
 *
 * `bar` 为 null 时所有调用都是 no-op：首次整页加载时外壳尚未挂载，这段导航不需要进度条。
 */
let bar: LoadingBarApi | null = null

export function bindPageProgress(api: LoadingBarApi): void {
  bar = api
}

export function unbindPageProgress(api: LoadingBarApi): void {
  if (bar !== api) return
  // 外壳卸载时若还有未完成的进度，直接收尾，避免停在 80%
  bar.finish()
  bar = null
}

export function startPageProgress(): void {
  bar?.start()
}

export function finishPageProgress(): void {
  bar?.finish()
}

export function failPageProgress(): void {
  bar?.error()
}
