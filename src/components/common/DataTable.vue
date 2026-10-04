<script setup lang="ts" generic="T">
/* global Blob, URL, document, Element, EventTarget, KeyboardEvent, MouseEvent */
import { Download, SlidersHorizontal } from '@lucide/vue'
import { useBreakpoints } from '@vueuse/core'
import {
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NEmpty,
  NPopover,
  type DataTableBaseColumn,
  type DataTableColumns,
  type DataTableRowData,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { formatCellText, readPath, type DataTableColumn } from './data-table'
import AsyncState from './AsyncState.vue'

const props = withDefaults(
  defineProps<{
    /** 项目自有的列描述，见 ./data-table.ts */
    columns: DataTableColumn<T>[]
    rows: T[]
    loading?: boolean
    /** 有值时用错误提示替代表格，并提供重试入口 */
    error?: string
    /** 后端响应封装中的 trace_id，随错误态一起展示 */
    errorTraceId?: string
    emptyText?: string
    exportFileName?: string
    /** 行可点击（用于打开明细），同时支持回车 / 空格触发 */
    rowClickable?: boolean
  }>(),
  {
    loading: false,
    error: '',
    errorTraceId: '',
    emptyText: '暂无数据',
    exportFileName: 'export',
    rowClickable: false,
  },
)

const emit = defineEmits<{ retry: []; rowClick: [row: T] }>()

/**
 * 行点击交给适配层统一实现：页面不接触底层表格库的行属性 API。
 *
 * 点行内的按钮（编辑 / 删除 / 详情）不能让整行跳转，否则「编辑」会变成「打开详情」。
 */
function rowProps(row: T) {
  if (!props.rowClickable) return {}
  return {
    tabindex: 0,
    class: 'data-table__row--clickable',
    onClick: (event: MouseEvent) => {
      if (isInteractiveTarget(event.target)) return
      emit('rowClick', row)
    },
    onKeydown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      emit('rowClick', row)
    },
  }
}

/** 行内按钮 / 链接等交互元素及其子元素不参与行点击 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('button, a, input, select, textarea, [role="button"]') !== null
}

const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
/**
 * 表格最大高度按「视口减去页头等固定高度」估算。
 *
 * 常驻的标签条（`--shell-tabbar-height`）也占掉了内容区的高度，必须一起减掉：
 * 否则列表页会固定多出约一个标签条高度的页面滚动条，把分页按钮压到折叠线以下。
 * 变量缺失时（例如表格被用在没有外壳的页面）回退为 0，算式等价于改动前的行为。
 */
const maxHeight = computed(() =>
  isMobile.value
    ? 'max(320px, min(520px, calc(100vh - 240px - var(--shell-tabbar-height, 0px))))'
    : 'max(380px, min(620px, calc(100vh - 280px - var(--shell-tabbar-height, 0px))))',
)

const visibleKeys = ref<string[]>([])
watch(
  () => props.columns,
  (columns) => {
    visibleKeys.value = columns.map((column) => column.key)
  },
  { immediate: true },
)

const visibleColumns = computed(() =>
  props.columns.filter((column) => visibleKeys.value.includes(column.key)),
)

// 列宽之和作为横向滚动宽度：容器更窄时横向滚动，更宽时仍铺满容器。
// 没有任何列声明宽度时取 0（等价于不限制），而不是 undefined：
// 在 `exactOptionalPropertyTypes` 下把 undefined 绑给 `scroll-x` 是类型错误。
const scrollX = computed(() => {
  const total = visibleColumns.value.reduce((sum, column) => sum + (column.width ?? 0), 0)
  return total > 0 ? total : 0
})

function updateVisibleKeys(keys: Array<string | number>) {
  // 至少保留一列，避免把表格整体隐藏掉
  if (keys.length === 0) return
  visibleKeys.value = keys.map(String)
}

function compareValues(left: unknown, right: unknown): number {
  const leftEmpty = left === null || left === undefined || left === ''
  const rightEmpty = right === null || right === undefined || right === ''
  if (leftEmpty || rightEmpty) return leftEmpty && rightEmpty ? 0 : leftEmpty ? -1 : 1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'zh-CN')
}

/**
 * Naive 的 `data` 要求带索引签名的 `RowData`，而业务行是具体 interface（`Customer` 等没有索引签名）。
 * 适配层就是这种类型收敛该发生的地方：业务侧保持强类型，只在这里让渡一次。
 */
const tableRows = computed(() => props.rows as unknown as DataTableRowData[])

const tableColumns = computed<DataTableColumns<T>>(() =>
  visibleColumns.value.map((column) => {
    const render = column.render
    const naiveColumn: DataTableBaseColumn<T> = {
      key: column.key,
      title: column.title,
      resizable: true,
      ellipsis: { tooltip: true },
      render: (row) => (render ? render(row) : formatCellText(readPath(row, column.key))),
    }
    if (column.width !== undefined) {
      naiveColumn.width = column.width
      // 未显式声明 minWidth 时，用布局宽度作为可拖拽缩小的下限
      naiveColumn.minWidth = column.minWidth ?? column.width
    } else if (column.minWidth !== undefined) {
      naiveColumn.minWidth = column.minWidth
    }
    if (column.align !== undefined) naiveColumn.align = column.align
    if (column.fixed !== undefined) naiveColumn.fixed = column.fixed
    if (column.sortable !== false) {
      naiveColumn.sorter = (rowA, rowB) =>
        compareValues(readPath(rowA, column.key), readPath(rowB, column.key))
    }
    if (column.filterOptions !== undefined && column.filterOptions.length > 0) {
      naiveColumn.filterOptions = column.filterOptions
      naiveColumn.filter = (optionValue, row) =>
        String(readPath(row, column.key)) === String(optionValue)
    }
    return naiveColumn
  }),
)

const tableThemeOverrides = {
  thColor: '#f7f9f8',
  thTextColor: '#17201d',
  thFontWeight: '600',
  tdColorHover: '#f2f8f6',
  fontSizeSmall: '13px',
  common: {
    borderColor: '#dfe5e2',
  },
}

function quoteCsv(text: string): string {
  return `"${text.replace(/"/g, '""')}"`
}

function exportCsv() {
  const exportColumns = visibleColumns.value.filter((column) => column.exportable !== false)
  if (props.rows.length === 0 || exportColumns.length === 0) return

  const lines = [
    exportColumns.map((column) => quoteCsv(column.title)).join(','),
    ...props.rows.map((row) =>
      exportColumns
        .map((column) =>
          quoteCsv(
            column.exportValue
              ? column.exportValue(row)
              : formatCellText(readPath(row, column.key), ''),
          ),
        )
        .join(','),
    ),
  ]

  // 前置 BOM，保证 Excel 以 UTF-8 打开中文表头
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = props.exportFileName.endsWith('.csv')
    ? props.exportFileName
    : `${props.exportFileName}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="data-table">
    <AsyncState
      v-if="error"
      :error="error"
      :error-trace-id="errorTraceId"
      class="data-table__error"
      @retry="emit('retry')"
    />

    <template v-else>
      <div class="data-table__toolbar">
        <NPopover
          v-if="columns.length > 1"
          trigger="click"
          placement="bottom-end"
          :show-arrow="false"
        >
          <template #trigger>
            <NButton size="small" quaternary>
              <template #icon><SlidersHorizontal :size="15" /></template>
              列设置
            </NButton>
          </template>
          <NCheckboxGroup
            class="data-table__column-picker"
            :value="visibleKeys"
            @update:value="updateVisibleKeys"
          >
            <NCheckbox
              v-for="column in columns"
              :key="column.key"
              :value="column.key"
              :label="column.title"
            />
          </NCheckboxGroup>
        </NPopover>

        <NButton size="small" quaternary :disabled="rows.length === 0" @click="exportCsv">
          <template #icon><Download :size="15" /></template>
          导出 CSV
        </NButton>
      </div>

      <NDataTable
        size="small"
        :bordered="false"
        :columns="tableColumns"
        :data="tableRows"
        :loading="loading"
        :max-height="maxHeight"
        :scroll-x="scrollX"
        :row-props="rowProps"
        :theme-overrides="tableThemeOverrides"
      >
        <template #empty>
          <NEmpty size="small" :description="emptyText" />
        </template>
      </NDataTable>
    </template>
  </div>
</template>

<style scoped>
.data-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.data-table__column-picker {
  display: flex;
  max-height: 300px;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.data-table__error {
  margin: 16px;
}

:deep(.data-table__row--clickable) {
  cursor: pointer;
}

:deep(.data-table__row--clickable:focus-visible) {
  outline: 2px solid var(--color-primary, #18a058);
  outline-offset: -2px;
}
</style>
