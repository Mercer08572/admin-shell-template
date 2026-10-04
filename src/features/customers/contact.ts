/**
 * 联系人（客户子表）的列表列与表单字段。
 *
 * 联系人没有独立的列表路由：它只作为客户详情页的子表出现，而 `GET /contacts`
 * 必须带 `customer_id`（见 `src/api/contacts.ts`），因此这里导出的是列与字段函数，
 * 不是一个完整的 `ResourceConfig`——子表的取数条件由详情页持有。
 */

import { enumLabel, type FieldConfig, type FieldOption } from '@/lib/crud/entity-form'
import { statusColumn, timeColumn } from '@/lib/crud/list-config'

import type { DataTableColumn } from '@/components/common/data-table'
import type { Contact } from '@/types/api'

/** 联系人角色的中文标签与下拉选项（同一份来源，避免标签与选项两处漂移） */
export const contactRoleOptions: readonly FieldOption[] = [
  { label: '决策人', value: 'decision_maker' },
  { label: '使用人', value: 'user' },
  { label: '其他', value: 'other' },
]

/** 角色的中文文案；列表列与表单共用 */
export function contactRoleLabel(role: unknown): string {
  return enumLabel(contactRoleOptions, role)
}

/**
 * 子表列：不出现「所属客户」列——整张表都属于同一个客户，
 * 其余列与独立资源列表保持一致（编码 / 姓名 / 电话 / 角色 / 状态 / 更新时间）。
 */
export const contactColumns: readonly DataTableColumn<Contact>[] = [
  { key: 'code', title: '编码', width: 140 },
  { key: 'name', title: '姓名', width: 140 },
  { key: 'phone', title: '电话', width: 150 },
  { key: 'role', title: '角色', width: 110, render: (row) => contactRoleLabel(row.role) },
  statusColumn,
  timeColumn,
]

/** 新增与编辑共用的字段；`BaseEntity` 契约要求 `code` 与 `name` 必填 */
const commonFields: readonly FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '姓名', type: 'text', required: true, placeholder: '请输入姓名' },
  { key: 'phone', label: '电话', type: 'text', placeholder: '可选，手机号或座机' },
  { key: 'role', label: '角色', type: 'select', required: true, options: contactRoleOptions },
  { key: 'status', label: '状态', type: 'status', required: true },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '可选' },
]

/**
 * 客户详情页里的联系人字段变体：`customer_id` 锁定为当前客户。
 *
 * 为什么不隐藏：隐藏会让载荷漏键，而 `PUT` 是全量替换，漏发等于把归属清空；
 * 禁用后值仍然随表单提交，也避免用户在详情页把联系人挪到别的客户。
 */
export function contactFieldsForCustomer(customerId: number): FieldConfig[] {
  return [
    {
      key: 'customer_id',
      label: '所属客户',
      type: 'select',
      required: true,
      disabled: true,
      lockedValue: customerId,
      options: [{ label: `当前客户 #${customerId}`, value: customerId }],
    },
    ...commonFields,
  ]
}
