/**
 * 客户资源的列表列与表单字段。
 *
 * 与 `customersApi` 的绑定只出现在这里，页面（`CustomerListView.vue`）不直接认识 API。
 * 本文件就是「新增一个资源页需要提供什么」的完整示例，字段说明见 `@/lib/crud/list-config.ts`。
 */

import { customersApi, type CustomerListQuery } from '@/api/customers'
import {
  enumLabel,
  statusOptions,
  toApiInput,
  type FieldConfig,
  type FieldOption,
} from '@/lib/crud/entity-form'
import {
  statusColumn,
  timeColumn,
  type FilterConfig,
  type ListQuery,
  type ResourceConfig,
} from '@/lib/crud/list-config'

import type { DataTableColumn } from '@/components/common/data-table'
import type { Customer, CustomerInput } from '@/types/api'

/** 客户等级的中文标签与下拉选项（同一份来源，避免标签与选项两处漂移） */
export const customerLevelOptions: readonly FieldOption[] = [
  { label: '普通', value: 'normal' },
  { label: '重要', value: 'important' },
  { label: 'VIP', value: 'vip' },
]

/** 等级的中文文案；列表列与详情页共用 */
export function customerLevelLabel(level: unknown): string {
  return enumLabel(customerLevelOptions, level)
}

const columns: readonly DataTableColumn<Customer>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '名称', width: 180 },
  { key: 'level', title: '等级', width: 100, render: (row) => customerLevelLabel(row.level) },
  statusColumn,
  timeColumn,
]

/** 表单字段；列表页的抽屉与详情页的「编辑客户」共用同一份定义 */
export const customerFields: readonly FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  { key: 'level', label: '等级', type: 'select', required: true, options: customerLevelOptions },
  { key: 'status', label: '状态', type: 'status', required: true },
  { key: 'phone', label: '电话', type: 'text', placeholder: '可选，手机号或座机' },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
]

const filters: readonly FilterConfig[] = [
  { key: 'keyword', label: '关键词', type: 'text', placeholder: '编码或名称' },
  { key: 'status', label: '状态', type: 'select', options: statusOptions },
  { key: 'level', label: '等级', type: 'select', options: customerLevelOptions },
]

/**
 * 页面的通用查询 → `GET /customers` 的 query。
 *
 * 空条件不放进 query（`api/client.ts` 也会丢弃空值，这里显式表达意图：
 * 只有用户真的选了才发这个参数）。
 */
function toListQuery(query: ListQuery): CustomerListQuery {
  const result: CustomerListQuery = { limit: query.limit, offset: query.offset }
  const keyword = query.filters.keyword
  const status = query.filters.status
  const level = query.filters.level

  if (typeof keyword === 'string' && keyword !== '') result.keyword = keyword
  if (typeof status === 'string' && status !== '') result.status = status
  if (typeof level === 'string' && level !== '') result.level = level

  return result
}

export const customerConfig: ResourceConfig<Customer> = {
  title: '客户',
  load: (query) => customersApi.list(toListQuery(query)),
  columns,
  fields: customerFields,
  filters,
  // 表单载荷由 buildPayload 动态构造，这里断言回接口自己的输入类型
  create: (body) => customersApi.create(toApiInput<CustomerInput>(body)),
  get: customersApi.get,
  update: (id, body) => customersApi.update(id, toApiInput<CustomerInput>(body)),
  remove: customersApi.remove,
  detailRoute: (row) => `/customers/${row.id}`,
}
