/**
 * 资源列表的共享契约与通用列。
 *
 * 每个资源自己维护一份配置（本模板的示例见 `src/features/customers/customer.ts`），
 * 这里只放**跨资源不变量**：配置的形状、通用列、查询参数形状。
 *
 * ## 新增一个资源页需要提供什么
 *
 * 1. `title`：资源名，用于页头、抽屉标题与提示文案（如「客户」）；
 * 2. `load(query)`：列表加载，把 `query.filters` 映射到自己接口的 query，
 *    `limit` / `offset` 必须原样透传（分页由列表页托管，唯一来源是后端 `ListResult`）；
 * 3. `columns`：列表列，**列宽要显式声明**——表格按列宽之和算横向滚动宽度；
 * 4. `fields`：抽屉表单字段（新增与编辑共用），字段名与接口请求体一一对应；
 * 5. `create` / `get` / `update` / `remove`：四个接口的绑定（`get` 供编辑模式预填）；
 * 6. `filters`（可选）：服务端筛选条件，页面按声明渲染筛选栏；
 * 7. `detailRoute`（可选）：提供后操作列出现「详情」按钮、表格整行可点击。
 *
 * 最后把这份配置交给 `components/crud/EntityListPage.vue` 渲染即可，
 * 页面本身不需要写任何模板细节（见 `CustomerListView.vue`）。
 */

import { h } from 'vue'

import StatusTag from '@/components/common/StatusTag.vue'
import { formatDateTime, type DataTableColumn } from '@/components/common/data-table'
import { statusOptions, type FieldConfig, type FieldOption } from '@/lib/crud/entity-form'

import type { BaseEntity, ListResult } from '@/types/api'

export type {
  EntityPayload,
  FieldConfig,
  FieldOption,
  FieldType,
  FormValues,
} from '@/lib/crud/entity-form'

/** 一页条数：与后端默认 `limit` 对齐，且不超过后端 `MaxListLimit`（100） */
export const DEFAULT_PAGE_SIZE = 20

/**
 * 一次列表查询：分页 + 资源自定义的筛选值。
 *
 * `filters` 的键名与后端 query 一一对应；页面只把「有值」的条件放进来，
 * 空值不会出现在请求 URL 里。
 */
export interface ListQuery {
  limit: number
  offset: number
  filters: Record<string, string | number>
}

/** 筛选控件类型：文本输入 / 下拉选择 */
export type FilterType = 'text' | 'select'

/** 服务端筛选条件：页面按 `type` 渲染控件，值按 `key` 组装进查询参数 */
export interface FilterConfig {
  /** query 参数名，与后端一致 */
  key: string
  label: string
  type: FilterType
  /** `select` 的候选值 */
  options?: readonly FieldOption[] | undefined
  placeholder?: string | undefined
}

export interface ResourceConfig<T extends BaseEntity> {
  /** 资源名，用于页头、抽屉标题与提示文案（如「客户」） */
  title: string
  /** 列表加载；分页与筛选条件都在 `query` 里 */
  load: (query: ListQuery) => Promise<ListResult<T>>
  /** 列表列；列宽显式声明，表格据此计算横向滚动宽度 */
  columns?: readonly DataTableColumn<T>[] | undefined
  /** 抽屉表单字段（新增与编辑共用） */
  fields: readonly FieldConfig[]
  /** 服务端筛选条件；缺省时页面不渲染筛选栏 */
  filters?: readonly FilterConfig[] | undefined
  create: (body: Record<string, unknown>) => Promise<T>
  get: (id: number) => Promise<T>
  update: (id: number, body: Record<string, unknown>) => Promise<T>
  remove: (id: number) => Promise<unknown>
  /**
   * 提供后该资源有详情页：操作列渲染「详情」按钮、表格行可点击。
   * 返回路由路径（如 `/customers/12`），列表页据此 push。
   */
  detailRoute?: ((row: T) => string) | undefined
}

/** `status` 列的筛选与渲染：所有遵循 `BaseEntity` 的资源完全一致 */
export const statusColumn: DataTableColumn<BaseEntity> = {
  key: 'status',
  title: '状态',
  width: 100,
  filterOptions: statusOptions.map((option) => ({ label: option.label, value: option.value })),
  render: (row) => h(StatusTag, { status: String(row.status ?? '') }),
}

/** `updated_at` 列的格式化：所有遵循 `BaseEntity` 的资源完全一致 */
export const timeColumn: DataTableColumn<BaseEntity> = {
  key: 'updated_at',
  title: '更新时间',
  width: 170,
  render: (row) => formatDateTime(row.updated_at),
}
