import { api } from './client'

import type { Customer, CustomerInput, ListResult } from '@/types/api'

/** 列表查询参数：字段名与后端 query 一一对应，前端不做重命名 */
export type CustomerListQuery = {
  status?: string
  level?: string
  keyword?: string
  limit?: number
  offset?: number
}

export const customersApi = {
  list: (query: CustomerListQuery) => api.get<ListResult<Customer>>('/customers', query),
  get: (id: number) => api.get<Customer>(`/customers/${id}`),
  create: (body: CustomerInput) => api.post<Customer>('/customers', body),
  update: (id: number, body: CustomerInput) => api.put<Customer>(`/customers/${id}`, body),
  remove: (id: number) => api.delete<void>(`/customers/${id}`),
}
