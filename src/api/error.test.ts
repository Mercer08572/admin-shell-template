import { describe, expect, it } from 'vitest'

import { ApiError, getErrorDetail, getErrorMessage } from './error'
import { ERROR_MESSAGES } from './error-messages'

function apiError(message: string, errorCode?: string) {
  return new ApiError(message, {
    status: 409,
    code: 1009,
    ...(errorCode === undefined ? {} : { errorCode }),
    traceId: 'trace-1',
  })
}

describe('getErrorDetail', () => {
  it('exposes message, status, code, error code and trace id', () => {
    expect(
      getErrorDetail(apiError('customer code already exists', 'CUSTOMER_CODE_DUPLICATE')),
    ).toEqual({
      message: 'customer code already exists',
      status: 409,
      code: 1009,
      errorCode: 'CUSTOMER_CODE_DUPLICATE',
      traceId: 'trace-1',
    })
  })

  it('falls back for non-Error values', () => {
    expect(getErrorDetail('boom')).toEqual({ message: '请求失败，请稍后重试' })
  })
})

describe('getErrorMessage', () => {
  it('maps a duplicate code conflict to Chinese', () => {
    expect(
      getErrorMessage(apiError('customer code already exists', 'CUSTOMER_CODE_DUPLICATE')),
    ).toBe('编码已存在，请更换后重试')
  })

  it('maps a business-rule conflict to Chinese', () => {
    expect(
      getErrorMessage(
        apiError('customer still has contacts and cannot be deleted', 'CUSTOMER_HAS_CONTACTS'),
      ),
    ).toBe('该客户下还有联系人，请先删除')
  })

  it('maps an authentication failure to Chinese', () => {
    expect(
      getErrorMessage(
        new ApiError('authentication failed', {
          status: 401,
          code: 1002,
          errorCode: 'AUTH_INVALID_CREDENTIALS',
        }),
      ),
    ).toBe('用户名或密码错误')
  })

  it('falls back to the backend message for an unmapped code', () => {
    expect(getErrorMessage(apiError('some future conflict', 'SOME_FUTURE_CONFLICT'))).toBe(
      'some future conflict',
    )
  })

  it('falls back to the backend message when no code is present', () => {
    expect(getErrorMessage(apiError('customer not found'))).toBe('customer not found')
  })

  it('falls back for plain errors and unknown values', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage(undefined)).toBe('请求失败，请稍后重试')
  })
})

describe('ERROR_MESSAGES', () => {
  it('never maps two codes to an empty message', () => {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      expect(message.trim(), `${code} 的文案不能为空`).not.toBe('')
    }
  })
})
