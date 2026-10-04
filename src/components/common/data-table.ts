import type { VNodeChild } from 'vue'

/**
 * 项目自有的表格列描述。
 *
 * 页面只依赖这个结构，不依赖任何具体表格库的列 API；
 * 更换底层表格实现时只需要改 `DataTable.vue`，页面列定义不用动。
 */
export interface DataTableColumn<T> {
  /** 取值路径，支持 `warehouse.code` 这类嵌套路径，同时作为列的稳定标识 */
  key: string
  title: string
  /** 列宽，同时作为可拖拽缩小的下限；不设置时由底层表格均分 */
  width?: number
  /** 缩小的下限，缺省等于 `width` */
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
  /** 是否允许排序，默认允许（与迁移前的 AG Grid 行为一致） */
  sortable?: boolean
  /** 提供后启用列头筛选，按取值精确匹配 */
  filterOptions?: DataTableFilterOption[]
  /** 自定义单元格渲染；缺省显示取值路径对应的原始文本 */
  render?: (row: T) => VNodeChild
  /** CSV 导出文本；缺省使用取值路径对应的原始文本 */
  exportValue?: (row: T) => string
  /** 是否导出到 CSV，默认导出 */
  exportable?: boolean
}

export interface DataTableFilterOption {
  label: string
  value: string | number
}

/** 读取（可能嵌套的）取值路径 */
export function readPath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || value === undefined) return undefined
    return (value as Record<string, unknown>)[segment]
  }, row)
}

/** 单元格文本，空值统一显示为占位符 */
export function formatCellText(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

/** 时间文本，非法值显示为占位符 */
export function formatDateTime(value: unknown, fallback = '-'): string {
  if (typeof value !== 'string' || value === '') return fallback
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('zh-CN')
}
