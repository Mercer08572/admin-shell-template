/**
 * 实体表单的纯逻辑：空表单、预填、必填校验、请求体构造。
 *
 * 每个资源（本模板里是客户 / 联系人）的表单字段不同，但下面两条规则必须只有一处实现：
 * 1. `PUT /xxx/:id` 是**全量替换**：漏发字段会被后端写成零值，
 *    因此可选项留空时必须显式发 `null`，见 `buildPayload`；
 * 2. 新增模式下状态字段的默认值是 `active`，不能被「空实体预填」覆盖成空串
 *    （这条曾经真的坏过：提交时被必填校验拦下）。
 *
 * 纯逻辑集中在这里，由 `components/crud/EntityFormDrawer.vue` 与各资源的 `*.ts` 共用。
 */

/** 字段控件类型：文本 / 多行文本 / 数字 / 下拉 / 状态 */
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'status'

/**
 * 下拉选项。
 *
 * 用类型别名而不是 `interface`：Naive UI 的 `SelectBaseOption` 带索引签名，
 * 匿名对象类型才能直接传给它，省掉每个页面各自的类型断言。
 */
export type FieldOption = {
  label: string
  value: string | number
}

/** 通用状态枚举：所有遵循 `BaseEntity` 的资源共用 */
export const statusOptions: readonly FieldOption[] = [
  { label: '正常', value: 'active' },
  { label: '停用', value: 'inactive' },
]

export interface FieldConfig {
  /** 字段名：同时是请求体键名与实体取值路径，与后端一一对应，前端不做重命名 */
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  min?: number
  max?: number
  /** 下拉选项（`select` / `status`）；`status` 不填时用通用状态枚举 */
  options?: readonly FieldOption[] | undefined
  /** 锁定字段：值仍随表单提交，但用户不可编辑（如详情页里的「所属客户」） */
  disabled?: boolean
  /** 锁定字段的固定值；新增模式下用它预置，编辑模式仍以实体自身的值为准 */
  lockedValue?: string | number
  /** 值变化时的回调；用于「选项随另一个字段联动」这类场景 */
  onChange?: (value: unknown) => void
}

export type FormValues = Record<string, string | number | null>

/** 表单载荷：键名由 `fields` 声明保证，具体接口只接受自己的 `*Input` 类型 */
export type EntityPayload = Record<string, unknown>

/**
 * 枚举值 → 中文标签（列表单元格、详情字段都用它）。
 *
 * 命中不到时回退原值而不是留空：后端新增了枚举项时，界面仍看得见原始值。
 */
export function enumLabel(options: readonly FieldOption[], value: unknown, fallback = '-'): string {
  const match = options.find((option) => String(option.value) === String(value))
  if (match) return match.label
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

/** 下拉字段的最终选项：`status` 未显式声明选项时回退到通用状态枚举 */
export function fieldOptions(field: FieldConfig): FieldOption[] {
  if (field.options) return [...field.options]
  return field.type === 'status' ? [...statusOptions] : []
}

/** 字段默认值：锁定字段用锁定值，状态字段用 `active`，数值字段用 `null`，其余空串 */
export function fieldDefault(field: FieldConfig): string | number | null {
  if (field.lockedValue !== undefined) return field.lockedValue
  if (field.key === 'status' || field.type === 'status') return 'active'
  return field.type === 'number' ? null : ''
}

/** 新增模式的空表单；数值字段用 `null`（NInputNumber 不接受空字符串） */
export function createEmptyForm(fields: readonly FieldConfig[]): FormValues {
  const form: FormValues = {}
  for (const field of fields) form[field.key] = fieldDefault(field)
  return form
}

/**
 * 用实体字段灌满表单（编辑模式预填）。
 *
 * 缺失字段按「空」处理，避免残留上一次编辑的值；`0` 是合法数值，不能被当成空值丢掉。
 */
export function fillForm(fields: readonly FieldConfig[], entity: object): FormValues {
  const source = entity as Record<string, unknown>
  const form: FormValues = {}
  for (const field of fields) {
    const value = source[field.key]
    form[field.key] =
      value === null || value === undefined || value === ''
        ? fieldDefault(field)
        : (value as string | number)
  }
  return form
}

/** 第一个空着的必填字段；全部填好时返回 `undefined` */
export function findMissingRequired(
  fields: readonly FieldConfig[],
  form: FormValues,
): FieldConfig | undefined {
  return fields.find((field) => {
    if (!field.required) return false
    const value = form[field.key]
    return value === null || value === undefined || value === ''
  })
}

/**
 * 构造请求体。
 *
 * `PUT` 是全量替换，因此**每个**字段都要出现在载荷里：可选项留空时必须显式发 `null`
 * （后端可选项均为 `*T`，`null` 与省略语义一致，但省略非指针字段会被解析成零值）。
 * 必填项留空由 `findMissingRequired` 提前拦下，不会带进载荷。
 */
export function buildPayload(fields: readonly FieldConfig[], form: FormValues): EntityPayload {
  const payload: EntityPayload = {}
  for (const field of fields) {
    const value = form[field.key]
    const isEmpty = value === null || value === undefined || value === ''
    if (isEmpty) {
      if (!field.required) payload[field.key] = null
      continue
    }
    payload[field.key] = value
  }
  return payload
}

/**
 * 表单载荷 → 具体接口的入参类型。
 *
 * 载荷键名由 `fields` 声明保证，而各资源 API 只接受自己的 `*Input`；
 * 这里集中做一次受控断言，避免每个资源配置里各写一处 `as`，
 * 也避免把通用的 `ResourceConfig.create/update` 收窄成某个资源的类型。
 */
export function toApiInput<T>(payload: EntityPayload): T {
  return payload as unknown as T
}
