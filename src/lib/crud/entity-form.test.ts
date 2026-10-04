import { describe, expect, it } from 'vitest'

import {
  buildPayload,
  createEmptyForm,
  enumLabel,
  fieldDefault,
  fieldOptions,
  fillForm,
  findMissingRequired,
  statusOptions,
  toApiInput,
  type FieldConfig,
  type FieldOption,
} from './entity-form'

// 与 customers/customer.ts 的字段配置同形（必填 + 下拉 + 状态 + 可选文本）
const customerLevelOptions: readonly FieldOption[] = [
  { label: '普通', value: 'normal' },
  { label: '重要', value: 'important' },
  { label: 'VIP', value: 'vip' },
]

const customerFields: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true },
  { key: 'name', label: '名称', type: 'text', required: true },
  { key: 'level', label: '等级', type: 'select', required: true, options: customerLevelOptions },
  { key: 'status', label: '状态', type: 'status', required: true },
  { key: 'phone', label: '电话', type: 'text' },
  { key: 'remark', label: '备注', type: 'textarea' },
]

// 联系人子表的字段：所属客户锁定为当前客户，另有一个数值字段用于验证「0 不算空」
const contactFields: FieldConfig[] = [
  { key: 'customer_id', label: '所属客户', type: 'select', required: true, lockedValue: 101 },
  { key: 'code', label: '编码', type: 'text', required: true },
  { key: 'name', label: '姓名', type: 'text', required: true },
  { key: 'sort', label: '排序', type: 'number', required: true },
]

const customerForm = {
  code: 'C-001',
  name: '华南贸易',
  level: 'important',
  status: 'active',
  phone: '13800000001',
  remark: '',
}

describe('createEmptyForm', () => {
  it('defaults the status field to active and other fields to empty', () => {
    expect(createEmptyForm(customerFields)).toEqual({
      code: '',
      name: '',
      level: '',
      status: 'active',
      phone: '',
      remark: '',
    })
  })

  it('preseeds a locked field with its locked value', () => {
    const form = createEmptyForm(contactFields)

    // 锁定值不走「数值字段默认 null」的分支
    expect(form.customer_id).toBe(101)
    expect(form.sort).toBeNull()
  })
})

describe('fillForm', () => {
  it('prefills every field from the fetched entity', () => {
    const form = fillForm(customerFields, {
      id: 101,
      code: 'C-001',
      name: '华南贸易',
      level: 'vip',
      status: 'inactive',
      phone: '13800000001',
      remark: '战略客户',
    })

    expect(form).toEqual({
      code: 'C-001',
      name: '华南贸易',
      level: 'vip',
      status: 'inactive',
      phone: '13800000001',
      remark: '战略客户',
    })
  })

  it('maps a missing optional field to an empty value instead of undefined', () => {
    const form = fillForm(customerFields, { code: 'C1', name: '客户一', status: 'active' })

    // 后端可空字段可能整体缺失（omitempty），不能变成 undefined
    expect(form.remark).toBe('')
    expect(form.phone).toBe('')
  })

  it('keeps a zero numeric value instead of treating it as empty', () => {
    expect(fillForm(contactFields, { sort: 0 }).sort).toBe(0)
  })

  it('keeps the entity value of a locked field in edit mode', () => {
    expect(fillForm(contactFields, { customer_id: 202 }).customer_id).toBe(202)
  })
})

describe('findMissingRequired', () => {
  it('reports the first empty required field', () => {
    expect(findMissingRequired(customerFields, createEmptyForm(customerFields))?.key).toBe('code')
  })

  it('ignores empty optional fields', () => {
    expect(findMissingRequired(customerFields, customerForm)).toBeUndefined()
  })

  it('treats zero as a present value', () => {
    const form = { customer_id: 101, code: 'CT-001', name: '王经理', sort: 0 }

    expect(findMissingRequired(contactFields, form)).toBeUndefined()
  })
})

describe('buildPayload', () => {
  it('always sends every field so a full PUT replace cannot zero values out', () => {
    expect(buildPayload(customerFields, customerForm)).toEqual({
      code: 'C-001',
      name: '华南贸易',
      level: 'important',
      status: 'active',
      phone: '13800000001',
      remark: null,
    })
  })

  it('sends null (not omission) for empty optional fields', () => {
    const payload = buildPayload(customerFields, { ...customerForm, remark: '' })

    // 后端可选项是 *T：显式 null 才能清空
    expect('remark' in payload).toBe(true)
    expect(payload.remark).toBeNull()
  })

  it('keeps a numeric zero in the payload', () => {
    const payload = buildPayload(contactFields, {
      customer_id: 101,
      code: 'CT-001',
      name: '王经理',
      sort: 0,
    })

    expect(payload.sort).toBe(0)
  })

  it('keeps the locked field in the payload', () => {
    const payload = buildPayload(contactFields, {
      customer_id: 101,
      code: 'CT-001',
      name: '王经理',
      sort: 1,
    })

    // PUT 是全量替换：锁定字段漏发会被写成 0，归属就丢了
    expect(payload.customer_id).toBe(101)
  })

  it('does not invent a value for an empty required field', () => {
    // 必填留空由 findMissingRequired 拦下，载荷里不应出现该键
    expect('code' in buildPayload(customerFields, { ...customerForm, code: '' })).toBe(false)
  })
})

describe('fieldOptions / fieldDefault / enumLabel', () => {
  it('falls back to the generic status options for a status field', () => {
    const field: FieldConfig = { key: 'status', label: '状态', type: 'status' }

    expect(fieldOptions(field)).toEqual([...statusOptions])
  })

  it('prefers the options declared on the field', () => {
    const field: FieldConfig = {
      key: 'level',
      label: '等级',
      type: 'select',
      options: customerLevelOptions,
    }

    expect(fieldOptions(field)).toEqual([...customerLevelOptions])
  })

  it('returns an empty list for a free-text field', () => {
    expect(fieldOptions({ key: 'name', label: '名称', type: 'text' })).toEqual([])
  })

  it('defaults a locked status field to its locked value', () => {
    const field: FieldConfig = {
      key: 'status',
      label: '状态',
      type: 'status',
      lockedValue: 'inactive',
    }

    expect(fieldDefault(field)).toBe('inactive')
  })

  it('renders a known enum value as its Chinese label', () => {
    expect(enumLabel(customerLevelOptions, 'vip')).toBe('VIP')
  })

  it('falls back to the raw value for an unknown enum value', () => {
    // 后端新增枚举项时必须看得见原值，而不是空白
    expect(enumLabel(customerLevelOptions, 'strategic')).toBe('strategic')
    expect(enumLabel(customerLevelOptions, null)).toBe('-')
  })
})

describe('toApiInput', () => {
  it('passes the payload through untouched', () => {
    const payload = { code: 'C-001', remark: null }

    expect(toApiInput<{ code: string; remark: string | null }>(payload)).toEqual(payload)
  })
})
