import { ApiError } from './error'

import type { ApiEnvelope } from '@/types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')

/**
 * mock 开关。
 *
 * `VITE_USE_MOCK=true` 时请求不进网络，改由 `src/api/mock` 在浏览器内应答；
 * mock 模块是**动态导入**的，因此开关为 false 的构建里它不会被打进产物。
 * 两条路径共用同一套信封解包与 `ApiError`，页面不需要知道数据从哪里来。
 */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  query?: Record<string, QueryValue>
}

/** 真实请求与 mock 请求的共同结果：一次响应能被观察到的全部事实 */
export interface RawResponse<T> {
  status: number
  isJson: boolean
  payload?: Partial<ApiEnvelope<T>>
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') searchParams.set(key, String(value))
  }

  const search = searchParams.toString()
  return `${API_BASE_URL}${normalizedPath}${search ? `?${search}` : ''}`
}

/** 真实请求：只把 HTTP 事实搬成 `RawResponse`，信封语义在下面统一处理 */
async function httpRequest<T>(path: string, options: RequestOptions): Promise<RawResponse<T>> {
  const { body, headers, query, ...requestInit } = options
  const response = await fetch(buildUrl(path, query), {
    ...requestInit,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

  if (response.status === 204) return { status: 204, isJson: false }

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
  return {
    status: response.status,
    isJson,
    ...(isJson ? { payload: (await response.json()) as Partial<ApiEnvelope<T>> } : {}),
  }
}

/** mock 请求：同一个 `RawResponse` 形状，错误模型与页面都感知不到差别 */
async function mockRequest<T>(path: string, options: RequestOptions): Promise<RawResponse<T>> {
  const { mockRespond } = await import('./mock')
  return mockRespond<T>(path, options)
}

/**
 * 统一的请求入口。
 *
 * 契约：`payload.data` 就是业务数据；HTTP 非 2xx 或 `code !== 200` 一律抛 `ApiError`，
 * 并且必须保留 `status / code / errorCode / traceId` —— 页面靠它区分 401 清会话、
 * 409 提示重试，以及把 traceId 交给运维排查。
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = USE_MOCK
    ? await mockRequest<T>(path, options)
    : await httpRequest<T>(path, options)
  const { status, payload } = response

  if (status === 204) return undefined as T

  if (status < 200 || status >= 300 || (payload?.code !== undefined && payload.code !== 200)) {
    throw new ApiError(payload?.message || `请求失败 (${status})`, {
      status,
      ...(payload?.code === undefined ? {} : { code: payload.code }),
      ...(payload?.error_code ? { errorCode: payload.error_code } : {}),
      ...(payload?.trace_id ? { traceId: payload.trace_id } : {}),
    })
  }

  return payload?.data as T
}

export const api = {
  get<T>(path: string, query?: Record<string, QueryValue>) {
    return apiRequest<T>(path, { method: 'GET', ...(query ? { query } : {}) })
  },
  post<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'POST', body })
  },
  put<T>(path: string, body?: unknown) {
    return apiRequest<T>(path, { method: 'PUT', body })
  },
  delete<T>(path: string) {
    return apiRequest<T>(path, { method: 'DELETE' })
  },
}
