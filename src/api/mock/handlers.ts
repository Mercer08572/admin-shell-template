import {
  ADMIN_ACCOUNTS,
  clearSession,
  createDb,
  readSessionUsername,
  writeSessionUsername,
} from './fixtures'

import type { MockDb } from './fixtures'
import type { RawResponse, RequestOptions } from '../client'
import type {
  AdminIdentity,
  Contact,
  ContactInput,
  Customer,
  CustomerInput,
  ListResult,
} from '@/types/api'

/**
 * 进程内 mock 后端。
 *
 * 与真实后端保持同一套约定，这样从 mock 切到真接口时页面零改动：
 * - 响应信封 `{ code, message, error_code, data, trace_id, timestamp }`；
 * - 失败一律带 HTTP 状态 + 业务错误码（`MockApiError`），由 `client.ts` 统一转成 `ApiError`；
 * - `DELETE` 成功返回 204（无 body），与 `client.ts` 的 204 分支对应。
 *
 * 未注册的路径返回 404 并带上方法名，避免「页面空白但测试通过」。
 */

export class MockApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
  ) {
    super(message)
    this.name = 'MockApiError'
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface MockContext {
  /** 路径参数，如 `/customers/:id` 中的 `id` */
  params: Record<string, string>
  query: Record<string, string>
  body: any
}

interface MockRoute {
  method: HttpMethod
  /** 相对接口前缀的路径，`:name` 匹配单个路径段 */
  path: string
  handle: (ctx: MockContext) => unknown
}

/** 内存数据库：模块级，页面生命周期内保持（刷新页面即重置） */
const db: MockDb = createDb()

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 20

function traceId(): string {
  return `mock-${Math.random().toString(16).slice(2, 10)}`
}

/** 人为延迟：方便观察加载态；`VITE_MOCK_DELAY_MS=0` 可关掉 */
function delayMs(): number {
  const raw = import.meta.env.VITE_MOCK_DELAY_MS
  if (raw === undefined || raw === '') return 120
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : 120
}

function nextId(): number {
  db.nextId += 1
  return db.nextId
}

function now(): string {
  return new Date().toISOString()
}

function currentAdmin(): AdminIdentity {
  const username = readSessionUsername()
  const account = ADMIN_ACCOUNTS.find((candidate) => candidate.username === username)
  if (!account) throw new MockApiError('登录已过期，请重新登录', 401, 'AUTH_REQUIRED')
  return account.identity
}

function requireText(value: unknown, label: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new MockApiError(`${label}不能为空`, 400, 'VALIDATION_FAILED')
  return text
}

/** 统一的列表行为：先过滤，再按 limit/offset 切片（与后端一致，不返回总数） */
function paginate<T>(items: T[], query: Record<string, string>): ListResult<T> {
  const requestedLimit = Number(query.limit ?? DEFAULT_LIMIT)
  const limit = Math.min(
    Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  )
  const requestedOffset = Number(query.offset ?? 0)
  const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0
  return { items: items.slice(offset, offset + limit), limit, offset }
}

/** 编码唯一性：与后端一样按大小写不敏感判重 */
function assertCodeUnique(
  rows: { id: number; code: string }[],
  code: string,
  errorCode: string,
  ignoreId?: number,
) {
  const duplicated = rows.some(
    (row) => row.id !== ignoreId && row.code.toLowerCase() === code.toLowerCase(),
  )
  if (duplicated) throw new MockApiError('编码已存在，请更换后重试', 409, errorCode)
}

const routes: MockRoute[] = [
  {
    method: 'GET',
    path: '/health',
    handle: () => ({ service: 'admin-shell-template', status: 'ok' }),
  },

  // ---- 会话 ----
  {
    method: 'POST',
    path: '/auth/admin/login',
    handle: ({ body }) => {
      const username = requireText(body?.username, '账号')
      const password = requireText(body?.password, '密码')
      const account = ADMIN_ACCOUNTS.find(
        (candidate) => candidate.username === username && candidate.password === password,
      )
      if (!account) throw new MockApiError('用户名或密码错误', 401, 'AUTH_INVALID_CREDENTIALS')

      writeSessionUsername(account.username)
      return { admin: account.identity, expires_at: expiresAt() }
    },
  },
  {
    method: 'GET',
    path: '/auth/admin/me',
    handle: () => currentAdmin(),
  },
  {
    method: 'POST',
    path: '/auth/admin/logout',
    handle: () => {
      clearSession()
      return undefined
    },
  },
  {
    method: 'PUT',
    path: '/auth/admin/password',
    handle: ({ body }) => {
      const admin = currentAdmin()
      const account = ADMIN_ACCOUNTS.find((candidate) => candidate.username === admin.username)
      const current = requireText(body?.current_password, '当前密码')
      const next = requireText(body?.new_password, '新密码')
      if (account && current !== account.password) {
        throw new MockApiError('当前密码不正确', 400, 'AUTH_CURRENT_PASSWORD_MISMATCH')
      }
      if (next.length < 8) {
        throw new MockApiError('新密码至少 8 位', 400, 'VALIDATION_FAILED')
      }
      // mock 里改密只解除「必须改密」标记；下一步真正接后端时这里是真实的密码更新
      return {
        admin: { ...admin, must_change_password: false },
        expires_at: expiresAt(),
      }
    },
  },

  // ---- 客户（演示 CRUD）----
  {
    method: 'GET',
    path: '/customers',
    handle: ({ query }) => {
      currentAdmin()
      const filtered = db.customers.filter((row) => {
        if (query.status && row.status !== query.status) return false
        if (query.level && row.level !== query.level) return false
        if (query.keyword) {
          const keyword = query.keyword.toLowerCase()
          const hit =
            row.code.toLowerCase().includes(keyword) || row.name.toLowerCase().includes(keyword)
          if (!hit) return false
        }
        return true
      })
      return paginate(filtered, query)
    },
  },
  {
    method: 'POST',
    path: '/customers',
    handle: ({ body }) => {
      currentAdmin()
      const input = body as CustomerInput
      const code = requireText(input?.code, '编码')
      requireText(input?.name, '名称')
      assertCodeUnique(db.customers, code, 'CUSTOMER_CODE_DUPLICATE')

      const created: Customer = {
        ...input,
        id: nextId(),
        code,
        created_at: now(),
        updated_at: now(),
      }
      db.customers = [...db.customers, created]
      return created
    },
  },
  {
    method: 'GET',
    path: '/customers/:id',
    handle: ({ params }) => {
      currentAdmin()
      const found = db.customers.find((row) => row.id === Number(params.id))
      if (!found) throw new MockApiError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
      return found
    },
  },
  {
    method: 'PUT',
    path: '/customers/:id',
    handle: ({ params, body }) => {
      currentAdmin()
      const input = body as CustomerInput
      const index = db.customers.findIndex((row) => row.id === Number(params.id))
      if (index === -1) throw new MockApiError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')

      const code = requireText(input?.code, '编码')
      requireText(input?.name, '名称')
      assertCodeUnique(db.customers, code, 'CUSTOMER_CODE_DUPLICATE', Number(params.id))

      // PUT 是全量替换：只保留 id / created_at，其余以请求体为准
      const updated: Customer = {
        ...input,
        id: db.customers[index]!.id,
        code,
        created_at: db.customers[index]!.created_at,
        updated_at: now(),
      }
      db.customers = db.customers.map((row, position) => (position === index ? updated : row))
      return updated
    },
  },
  {
    method: 'DELETE',
    path: '/customers/:id',
    handle: ({ params }) => {
      currentAdmin()
      const id = Number(params.id)
      if (!db.customers.some((row) => row.id === id)) {
        throw new MockApiError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
      }
      // 业务规则：还有联系人就不能删，演示「服务端拒绝」这条路
      if (db.contacts.some((row) => row.customer_id === id)) {
        throw new MockApiError('该客户下还有联系人，请先删除', 409, 'CUSTOMER_HAS_CONTACTS')
      }
      db.customers = db.customers.filter((row) => row.id !== id)
      return undefined
    },
  },

  // ---- 联系人（子表）----
  {
    method: 'GET',
    path: '/contacts',
    handle: ({ query }) => {
      currentAdmin()
      const filtered = db.contacts.filter((row) =>
        query.customer_id ? row.customer_id === Number(query.customer_id) : true,
      )
      return paginate(filtered, query)
    },
  },
  {
    method: 'POST',
    path: '/contacts',
    handle: ({ body }) => {
      currentAdmin()
      const input = body as ContactInput
      const code = requireText(input?.code, '编码')
      requireText(input?.name, '姓名')
      if (!db.customers.some((row) => row.id === Number(input?.customer_id))) {
        throw new MockApiError('客户不存在', 404, 'CUSTOMER_NOT_FOUND')
      }
      assertCodeUnique(db.contacts, code, 'CONTACT_CODE_DUPLICATE')

      const created: Contact = {
        ...input,
        id: nextId(),
        code,
        created_at: now(),
        updated_at: now(),
      }
      db.contacts = [...db.contacts, created]
      return created
    },
  },
  {
    method: 'PUT',
    path: '/contacts/:id',
    handle: ({ params, body }) => {
      currentAdmin()
      const input = body as ContactInput
      const index = db.contacts.findIndex((row) => row.id === Number(params.id))
      if (index === -1) throw new MockApiError('联系人不存在', 404, 'CONTACT_NOT_FOUND')

      const code = requireText(input?.code, '编码')
      requireText(input?.name, '姓名')
      assertCodeUnique(db.contacts, code, 'CONTACT_CODE_DUPLICATE', Number(params.id))

      const updated: Contact = {
        ...input,
        id: db.contacts[index]!.id,
        code,
        created_at: db.contacts[index]!.created_at,
        updated_at: now(),
      }
      db.contacts = db.contacts.map((row, position) => (position === index ? updated : row))
      return updated
    },
  },
  {
    method: 'DELETE',
    path: '/contacts/:id',
    handle: ({ params }) => {
      currentAdmin()
      const id = Number(params.id)
      if (!db.contacts.some((row) => row.id === id)) {
        throw new MockApiError('联系人不存在', 404, 'CONTACT_NOT_FOUND')
      }
      db.contacts = db.contacts.filter((row) => row.id !== id)
      return undefined
    },
  },
]

function expiresAt(): string {
  return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
}

/** 把 `/customers/:id` 编译成正则：`:id` 只匹配单个路径段 */
function compile(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? '([^/]+)' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/')
  return new RegExp(`^${source}$`)
}

const compiledRoutes = routes.map((route) => ({ ...route, pattern: compile(route.path) }))

function normalizeQuery(query: RequestOptions['query']): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') result[key] = String(value)
  }
  return result
}

function ok<T>(data: T): RawResponse<T> {
  return {
    status: 200,
    isJson: true,
    payload: { code: 200, message: 'success', data, trace_id: traceId(), timestamp: Date.now() },
  }
}

function fail(error: MockApiError): RawResponse<never> {
  return {
    status: error.status,
    isJson: true,
    payload: {
      code: error.status,
      message: error.message,
      ...(error.errorCode ? { error_code: error.errorCode } : {}),
      data: null as never,
      trace_id: traceId(),
      timestamp: Date.now(),
    },
  }
}

/** mock 层入口：与 `httpRequest` 返回同一个形状，供 `client.ts` 复用同一套错误模型 */
export async function mockRespond<T>(
  path: string,
  options: RequestOptions,
): Promise<RawResponse<T>> {
  const delay = delayMs()
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))

  const method = String(options.method ?? 'GET').toUpperCase() as HttpMethod
  const matched = compiledRoutes.find(
    (route) => route.method === method && route.pattern.test(path),
  )

  try {
    if (!matched) {
      throw new MockApiError(`mock 未实现该接口：${method} ${path}`, 404, 'MOCK_ROUTE_NOT_FOUND')
    }

    const match = matched.pattern.exec(path)!
    const params: Record<string, string> = {}
    matched.path
      .split('/')
      .filter((segment) => segment.startsWith(':'))
      .forEach((segment, index) => {
        params[segment.slice(1)] = decodeURIComponent(match[index + 1] ?? '')
      })

    const data = matched.handle({
      params,
      query: normalizeQuery(options.query),
      body: options.body,
    })
    return data === undefined ? { status: 204, isJson: false } : ok(data as T)
  } catch (error) {
    // 只把显式声明的 MockApiError 转成响应；其他异常照抛，避免把代码 bug 伪装成业务错误
    if (error instanceof MockApiError) return fail(error) as RawResponse<T>
    throw error
  }
}
