import type { Page, Route } from '@playwright/test'

/**
 * e2e 的 API 造桩。
 *
 * 端到端测试跑在 `--mode test` 下（`.env.test` 里 `VITE_USE_MOCK=false`），
 * 因此请求真的会发出去，由这里的 `page.route` 在浏览器侧拦下：
 * 不依赖任何后端，CI 也能跑，并且能精确构造 409/401 这类真实环境不易复现的分支。
 *
 * 想连自己的后端联调时，删掉 `mockApi(...)` 调用即可。
 */

export const ADMIN = { id: 1, username: 'admin', must_change_password: false }

export function ok<T>(data: T) {
  return { code: 200, message: 'success', data, trace_id: 'trace-e2e', timestamp: Date.now() }
}

export function fail(status: number, code: number, message: string, errorCode?: string) {
  return {
    code,
    message,
    ...(errorCode === undefined ? {} : { error_code: errorCode }),
    data: null,
    trace_id: 'trace-e2e',
    timestamp: Date.now(),
  }
}

export type StubResponder = (route: Route) => Promise<void>

export interface StubRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** 相对 `/api/v1` 的路径，支持 `:id` 占位，如 `/units/:id` */
  path: string
  respond: StubResponder
}

function toRegExp(path: string): RegExp {
  // `:id` 只匹配单个路径段：否则 `/materials/:id` 会连 `/materials/1/unit-conversions` 一起吃掉，
  // 让更具体的桩永远匹配不到（表现为页面静默 404）。
  const pattern = path
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/')
  return new RegExp(`^${pattern}$`)
}

/**
 * 安装造桩路由。
 *
 * 所有 route 共用一个 `page.route` 处理器，未命中的请求会以 404 失败并带上可读原因，
 * 避免「页面静默空白但测试通过」。
 */
export async function mockApi(page: Page, routes: StubRoute[]) {
  const compiled = routes.map((route) => ({ ...route, pattern: toRegExp(route.path) }))

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname.replace(/^\/api\/v1/, '')
    const method = request.method()

    // 会话：让路由守卫的 auth.bootstrap() 通过
    if (method === 'GET' && pathname === '/auth/admin/me') {
      await route.fulfill({ json: ok(ADMIN) })
      return
    }

    const match = compiled.find(
      (candidate) => candidate.method === method && candidate.pattern.test(pathname),
    )

    if (!match) {
      await route.fulfill({
        status: 404,
        json: fail(404, 1004, `e2e 未造桩的请求：${method} ${pathname}`),
      })
      return
    }

    await match.respond(route)
  })
}

/** 按 `NFormItem` 的标签文本定位输入框（Naive UI 的 label 没有 for/id 关联） */
export function fieldInput(page: Page, label: string) {
  return page
    .locator('.n-form-item')
    .filter({ has: page.getByText(label, { exact: true }) })
    .locator('input')
}
