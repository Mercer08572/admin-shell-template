import { api } from './client'

import type { Contact, ContactInput, ListResult } from '@/types/api'

export type ContactListQuery = {
  /** 子表永远按所属实体过滤，不做跨实体查询 */
  customer_id: number
  limit?: number
  offset?: number
}

export const contactsApi = {
  list: (query: ContactListQuery) => api.get<ListResult<Contact>>('/contacts', query),
  create: (body: ContactInput) => api.post<Contact>('/contacts', body),
  update: (id: number, body: ContactInput) => api.put<Contact>(`/contacts/${id}`, body),
  remove: (id: number) => api.delete<void>(`/contacts/${id}`),
}
