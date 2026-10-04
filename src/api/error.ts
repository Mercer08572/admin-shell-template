import { ERROR_MESSAGES } from './error-messages'

export class ApiError extends Error {
  readonly status: number
  readonly code?: number
  /** 后端业务错误码（pkg/apperr），用于选择用户可读文案 */
  readonly errorCode?: string
  readonly traceId?: string

  constructor(
    message: string,
    options: { status: number; code?: number; errorCode?: string; traceId?: string },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    if (options.code !== undefined) this.code = options.code
    if (options.errorCode !== undefined) this.errorCode = options.errorCode
    if (options.traceId !== undefined) this.traceId = options.traceId
  }
}

/** 错误的结构化明细，供页面统一渲染（错误文案 + 追踪 ID） */
export interface ErrorDetail {
  message: string
  /** 后端响应封装中的 trace_id，排障用 */
  traceId?: string
  status?: number
  code?: number
  /** 后端业务错误码；未命中字典时 message 为后端英文原文 */
  errorCode?: string
}

export function getErrorDetail(error: unknown): ErrorDetail {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      status: error.status,
      ...(error.code === undefined ? {} : { code: error.code }),
      ...(error.errorCode === undefined ? {} : { errorCode: error.errorCode }),
      ...(error.traceId === undefined ? {} : { traceId: error.traceId }),
    }
  }

  if (error instanceof Error) return { message: error.message }

  return { message: '请求失败，请稍后重试' }
}

/**
 * 用户可读文案。
 *
 * 优先按业务错误码查字典；字典未命中（后端新增了码、或错误没有业务身份）时
 * 回退到后端 message，所以不会出现「什么都看不到」的情况。
 */
export function getErrorMessage(error: unknown): string {
  const detail = getErrorDetail(error)
  const mapped = detail.errorCode === undefined ? undefined : ERROR_MESSAGES[detail.errorCode]

  return mapped ?? detail.message
}
