/**
 * 共享 API 类型。
 *
 * 这里是模板与「后端契约」之间唯一的约定：响应统一是 `ApiEnvelope`，列表统一是
 * `ListResult`（`items + limit + offset`，**不带总数**——需要总数时由后端另给接口，
 * 前端不靠 count 猜分页：翻页由 `EntityListPage.vue` 按「本页是否满页」推断）。
 *
 * 演示模块（客户 / 联系人）沿用了 `BaseEntity` 的字段约定：`id / code / name / status`。
 * 把业务实体对齐到这套最小契约，通用列表页与抽屉表单才能完全配置化。
 */

export interface ApiEnvelope<T> {
  code: number
  message: string
  /** 稳定的业务错误码（成功响应不返回）；前端用它映射中文文案，见 src/api/error-messages.ts */
  error_code?: string
  data: T
  trace_id: string
  timestamp: number
}

export interface ListResult<T> {
  items: T[]
  limit: number
  offset: number
}

export type EntityStatus = 'active' | 'inactive'

export interface AdminIdentity {
  id: number
  username: string
  must_change_password: boolean
}

export interface LoginResponse {
  admin: AdminIdentity
  expires_at: string
}

export interface HealthStatus {
  service: string
  status: string
}

export interface BaseEntity {
  id: number
  code: string
  name: string
  status: EntityStatus
  created_at: string
  updated_at: string
}

/** 演示模块：客户等级 */
export type CustomerLevel = 'normal' | 'important' | 'vip'

export interface Customer extends BaseEntity {
  level: CustomerLevel
  phone: string | null
  remark: string | null
}

/** 演示模块：联系人角色 */
export type ContactRole = 'decision_maker' | 'user' | 'other'

export interface Contact extends BaseEntity {
  customer_id: number
  phone: string | null
  role: ContactRole
  remark: string | null
}

/** 新增 / 编辑用 `id` 之外的字段；快照式 PUT 与后端约定为全量替换 */
export type CustomerInput = Omit<Customer, 'id' | 'created_at' | 'updated_at'>
export type ContactInput = Omit<Contact, 'id' | 'created_at' | 'updated_at'>
