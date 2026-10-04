/**
 * 行操作列：详情 / 编辑 / 删除。
 *
 * 所有资源的按钮集合、顺序与样式一致，差异只有「回调做什么」；
 * 放在 lib 里是为了让各资源页不必各自写一遍 `h()` 渲染。
 */

import { h, type VNode } from 'vue'
import { NButton } from 'naive-ui'

import type { DataTableColumn } from '@/components/common/data-table'
import type { BaseEntity } from '@/types/api'

export interface RowActionHandlers<T> {
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  /** 只有配了详情页的资源才传；缺省时不渲染「详情」按钮 */
  onDetail?: ((row: T) => void) | undefined
}

export function actionColumn<T extends BaseEntity>(
  handlers: RowActionHandlers<T>,
): DataTableColumn<T> {
  return {
    key: 'actions',
    title: '操作',
    width: 160,
    align: 'right',
    sortable: false,
    exportable: false,
    render: (row) => {
      const buttons: VNode[] = []

      // 详情是进入下级数据（如客户的联系人）的入口，只有提供 detailRoute 的资源才有
      if (handlers.onDetail) {
        buttons.push(
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              type: 'primary',
              onClick: () => handlers.onDetail?.(row),
            },
            { default: () => '详情' },
          ),
        )
      }

      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'primary',
            onClick: () => handlers.onEdit(row),
          },
          { default: () => '编辑' },
        ),
      )

      buttons.push(
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'error',
            onClick: () => handlers.onDelete(row),
          },
          { default: () => '删除' },
        ),
      )

      return h('div', { class: 'row-actions' }, buttons)
    },
  }
}
