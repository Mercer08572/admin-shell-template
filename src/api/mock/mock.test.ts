import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSession } from './fixtures'
import { mockRespond } from './handlers'

import type { Contact, Customer, ListResult } from '@/types/api'
import type { RequestOptions } from '../client'

/**
 * mock 层自己的契约测试。
 *
 * 这里直接打 `mockRespond`，而不是走 `apiRequest`：
 * `client.ts` 里的开关是模块级常量，测试里无法在导入后翻转，
 * 而传输层的信封/错误处理由 `src/api/client.test.ts` 覆盖。两者合起来覆盖完整链路。
 */

vi.stubEnv('VITE_MOCK_DELAY_MS', '0')

async function respond<T>(path: string, options: RequestOptions = {}) {
  return mockRespond<T>(path, options)
}

/** 断言成功响应，并取出 data */
async function data<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await respond<T>(path, options)
  expect(response.status).toBe(200)
  expect(response.payload?.code).toBe(200)
  return response.payload?.data as T
}

async function error(path: string, options: RequestOptions = {}) {
  const response = await respond(path, options)
  return {
    status: response.status,
    message: response.payload?.message,
    errorCode: response.payload?.error_code,
  }
}

async function login(username = 'admin', password = 'admin123') {
  return data('/auth/admin/login', { method: 'POST', body: { username, password } })
}

beforeEach(() => {
  // sessionStorage 在同一测试文件内是共享的，每个用例都要从「未登录」开始
  clearSession()
})

describe('会话', () => {
  it('拒绝错误的口令并给出业务错误码', async () => {
    expect(
      await error('/auth/admin/login', {
        method: 'POST',
        body: { username: 'admin', password: 'nope' },
      }),
    ).toEqual({
      status: 401,
      message: '用户名或密码错误',
      errorCode: 'AUTH_INVALID_CREDENTIALS',
    })
  })

  it('未登录时 /me 返回 401', async () => {
    expect((await error('/auth/admin/me')).errorCode).toBe('AUTH_REQUIRED')
  })

  it('登录后 /me 返回身份，登出后再次失效', async () => {
    await login()
    expect(await data('/auth/admin/me')).toMatchObject({
      username: 'admin',
      must_change_password: false,
    })

    const logout = await respond('/auth/admin/logout', { method: 'POST' })
    expect(logout.status).toBe(204)
    expect((await error('/auth/admin/me')).status).toBe(401)
  })

  it('starter 账号要求先改密', async () => {
    await login('starter', 'starter123')
    expect(await data('/auth/admin/me')).toMatchObject({ must_change_password: true })
  })

  it('改密校验当前口令并解除强制改密标记', async () => {
    await login('starter', 'starter123')

    expect(
      await error('/auth/admin/password', {
        method: 'PUT',
        body: { current_password: 'wrong', new_password: 'newpassword' },
      }),
    ).toMatchObject({ status: 400, errorCode: 'AUTH_CURRENT_PASSWORD_MISMATCH' })

    const result = await data<{ admin: { must_change_password: boolean } }>(
      '/auth/admin/password',
      {
        method: 'PUT',
        body: { current_password: 'starter123', new_password: 'newpassword' },
      },
    )
    expect(result.admin.must_change_password).toBe(false)
  })
})

describe('客户列表', () => {
  beforeEach(async () => {
    await login()
  })

  it('按 limit/offset 分页且不返回总数', async () => {
    const page = await data<ListResult<Customer>>('/customers', { query: { limit: 5, offset: 5 } })
    expect(page.items).toHaveLength(5)
    expect(page.limit).toBe(5)
    expect(page.offset).toBe(5)
    expect(page).not.toHaveProperty('total')
  })

  it('按状态与等级过滤', async () => {
    const inactive = await data<ListResult<Customer>>('/customers', {
      query: { status: 'inactive' },
    })
    expect(inactive.items.every((row) => row.status === 'inactive')).toBe(true)

    const vip = await data<ListResult<Customer>>('/customers', { query: { level: 'vip' } })
    expect(vip.items.map((row) => row.code)).toEqual(['C-002', 'C-006', 'C-010'])
  })

  it('关键词同时匹配编码与名称', async () => {
    const byCode = await data<ListResult<Customer>>('/customers', { query: { keyword: 'C-003' } })
    expect(byCode.items.map((row) => row.name)).toEqual(['东海物流'])
  })

  it('把 limit 收敛到后端上限', async () => {
    const page = await data<ListResult<Customer>>('/customers', { query: { limit: 9999 } })
    expect(page.limit).toBe(100)
  })
})

describe('客户写操作', () => {
  beforeEach(async () => {
    await login()
  })

  it('新增时编码不能重复', async () => {
    expect(
      await error('/customers', {
        method: 'POST',
        body: { code: 'c-001', name: '重复编码' },
      }),
    ).toMatchObject({ status: 409, errorCode: 'CUSTOMER_CODE_DUPLICATE' })
  })

  it('新增缺少必填字段时返回 400', async () => {
    expect(
      await error('/customers', { method: 'POST', body: { code: '  ', name: '空编码' } }),
    ).toMatchObject({ status: 400, errorCode: 'VALIDATION_FAILED' })
  })

  it('PUT 是全量替换：只保留 id 与 created_at', async () => {
    const before = await data<Customer>('/customers/101')
    const updated = await data<Customer>('/customers/101', {
      method: 'PUT',
      body: {
        code: 'C-001',
        name: '华南贸易（改）',
        level: 'vip',
        status: 'inactive',
        phone: null,
        remark: null,
      },
    })

    expect(updated).toMatchObject({
      id: 101,
      name: '华南贸易（改）',
      level: 'vip',
      status: 'inactive',
    })
    expect(updated.created_at).toBe(before.created_at)
    expect(updated.updated_at).not.toBe(before.updated_at)

    // 全量替换后列表里看不到旧值
    const list = await data<ListResult<Customer>>('/customers', {
      query: { keyword: '华南贸易（改）' },
    })
    expect(list.items).toHaveLength(1)
  })

  it('还有联系人时不允许删除', async () => {
    expect(await error('/customers/101', { method: 'DELETE' })).toMatchObject({
      status: 409,
      errorCode: 'CUSTOMER_HAS_CONTACTS',
    })
  })

  it('删除后列表里不再出现，重复删除返回 404', async () => {
    const created = await data<Customer>('/customers', {
      method: 'POST',
      body: {
        code: 'C-999',
        name: '待删除',
        level: 'normal',
        status: 'active',
        phone: null,
        remark: null,
      },
    })
    expect((await respond(`/customers/${created.id}`, { method: 'DELETE' })).status).toBe(204)
    expect(await error(`/customers/${created.id}`, { method: 'DELETE' })).toMatchObject({
      status: 404,
      errorCode: 'CUSTOMER_NOT_FOUND',
    })
  })

  it('未登录时写操作被拒绝', async () => {
    clearSession()
    expect(
      await error('/customers', { method: 'POST', body: { code: 'C-998', name: 'x' } }),
    ).toMatchObject({
      status: 401,
      errorCode: 'AUTH_REQUIRED',
    })
  })
})

describe('联系人子表', () => {
  beforeEach(async () => {
    await login()
  })

  it('只返回指定客户的联系人', async () => {
    const contacts = await data<ListResult<Contact>>('/contacts', { query: { customer_id: 101 } })
    expect(contacts.items.map((row) => row.code)).toEqual(['CT-001', 'CT-002'])
  })

  it('新增时要求客户存在', async () => {
    expect(
      await error('/contacts', {
        method: 'POST',
        body: { customer_id: 999999, code: 'CT-900', name: '无主联系人' },
      }),
    ).toMatchObject({ status: 404, errorCode: 'CUSTOMER_NOT_FOUND' })
  })

  it('新增后子表能查到', async () => {
    const created = await data<Contact>('/contacts', {
      method: 'POST',
      body: {
        customer_id: 103,
        code: 'CT-004',
        name: '钱会计',
        role: 'other',
        phone: null,
        remark: null,
        status: 'active',
      },
    })
    const contacts = await data<ListResult<Contact>>('/contacts', { query: { customer_id: 103 } })
    expect(contacts.items.map((row) => row.code)).toContain(created.code)
  })
})

describe('健壮性', () => {
  it('未注册的接口返回 404 而不是静默空响应', async () => {
    await login()
    expect(await error('/not-registered', { method: 'GET' })).toMatchObject({
      status: 404,
      errorCode: 'MOCK_ROUTE_NOT_FOUND',
    })
  })
})
