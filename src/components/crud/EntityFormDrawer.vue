<script setup lang="ts">
/**
 * 通用实体表单抽屉：列表页与详情页（子表就地新增/编辑）共用的表单容器。
 *
 * 它只负责**「表单怎么渲染、怎么提交」**，不持有列表状态：
 * 收起抽屉由父组件在 `saved` 里决定（父组件还要刷新列表）。
 *
 * 之所以必须共用：`PUT /xxx/:id` 是**全量替换**，漏发字段会被后端写成零值，
 * 这条规则由 `@/lib/crud/entity-form.ts` 单份实现，任何页面都不该再写第二遍。
 */

import { computed, ref, watch } from 'vue'
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  useMessage,
} from 'naive-ui'

import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import {
  buildPayload,
  createEmptyForm,
  fieldOptions,
  fillForm,
  findMissingRequired,
  type FieldConfig,
  type FormValues,
} from '@/lib/crud/entity-form'

const props = withDefaults(
  defineProps<{
    /** 抽屉是否打开 */
    show: boolean
    fields: readonly FieldConfig[]
    /** 资源名，用于「新增客户 / 编辑客户」标题与提示文案 */
    title: string
    /** 新增：直接调 create；编辑：先按 `load` 预填，再调 update */
    mode: 'create' | 'edit'
    /** 编辑模式下的实体 ID */
    entityId?: number | null
    /** 编辑模式下拉取实体用于预填；返回任何实体对象即可（字段由 `fields` 声明） */
    load: (id: number) => Promise<object>
    /** 缺省为空实现：只读使用（如详情页展示）无需绑定写接口 */
    create?: ((body: Record<string, unknown>) => Promise<unknown>) | undefined
    update?: ((id: number, body: Record<string, unknown>) => Promise<unknown>) | undefined
  }>(),
  {
    entityId: null,
    create: () => Promise.resolve(),
    update: () => Promise.resolve(),
  },
)

const emit = defineEmits<{
  'update:show': [show: boolean]
  /** 保存成功；父组件据此收起抽屉并刷新列表 */
  saved: []
}>()

const message = useMessage()
const form = ref<FormValues>({})
const loadingDetail = ref(false)
const detailError = ref<ErrorDetail | null>(null)
const saving = ref(false)
const drawerTitle = ref('')

/** 当前要提交的字段：锁定字段的固定值也来自这里（`fields` 是唯一来源） */
const fields = computed(() => props.fields)

/**
 * 每次打开都重置：`GET /:id` 期间不能显示上一次编辑的残留值。
 *
 * 新增模式先铺一份空表单（`status` 默认 `active`）；编辑模式等实体到位后再预填，
 * 不能再拿空实体覆盖一次，否则新增模式的默认值会被清掉。
 */
watch(
  () => [props.show, props.mode, props.entityId, props.fields] as const,
  () => {
    if (!props.show) return

    detailError.value = null
    form.value = createEmptyForm(props.fields)
    drawerTitle.value = `${props.mode === 'edit' ? '编辑' : '新增'}${props.title}`

    if (props.mode === 'edit' && props.entityId !== null) void loadEntity(props.entityId)
  },
  { immediate: true, deep: false },
)

async function loadEntity(id: number) {
  loadingDetail.value = true
  detailError.value = null
  try {
    form.value = fillForm(props.fields, await props.load(id))
  } catch (error) {
    detailError.value = getErrorDetail(error)
  } finally {
    loadingDetail.value = false
  }
}

function retry() {
  if (props.mode === 'edit' && props.entityId !== null) void loadEntity(props.entityId)
}

function close() {
  if (!saving.value) emit('update:show', false)
}

/** 文本控件只接受字符串：`0` 之类的合法数值也要显示出来，不能变成空白 */
function textValue(key: string): string {
  const value = form.value[key]
  if (value === null || value === undefined) return ''
  return String(value)
}

/** 数字控件只接受数字：数值型字符串照样显示，其余回退为空 */
function numberValue(key: string): number | null {
  const value = form.value[key]
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

function selectValue(key: string): string | number | null {
  return form.value[key] ?? null
}

/**
 * 数值范围只在字段声明了 `min` / `max` 时才传给控件。
 *
 * `exactOptionalPropertyTypes` 下不允许把显式 `undefined` 传给可选属性，
 * 因此这里按需组装，而不是 `:min="field.min"` 直接透传。
 */
function numberBounds(field: FieldConfig): { min?: number; max?: number } {
  return {
    ...(field.min === undefined ? {} : { min: field.min }),
    ...(field.max === undefined ? {} : { max: field.max }),
  }
}

/**
 * 统一的写入入口：控件的值类型各不相同（文本是字符串、下拉是字符串或数字），
 * 统一收成 `FormValues`，避免在模板里散落类型断言。
 */
function setFormValue(key: string, value: unknown) {
  form.value[key] = typeof value === 'string' || typeof value === 'number' ? value : null
}

function onSelectChange(field: FieldConfig, value: unknown) {
  setFormValue(field.key, value)
  field.onChange?.(value)
}

async function submit() {
  const target = [...fields.value]
  const missing = findMissingRequired(target, form.value)
  if (missing) {
    message.warning(`请填写${missing.label}`)
    return
  }

  const payload = buildPayload(target, form.value)
  const targetId = props.entityId

  saving.value = true
  try {
    if (props.mode === 'edit' && targetId !== null) {
      await props.update?.(targetId, payload)
      message.success(`${props.title}已更新`)
    } else {
      await props.create?.(payload)
      message.success(`${props.title}已新增`)
    }
    emit('saved')
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <NDrawer :show="show" :width="460" placement="right" @update:show="emit('update:show', $event)">
    <NDrawerContent :title="drawerTitle" closable>
      <AsyncState
        :loading="loadingDetail"
        :error="detailError?.message ?? ''"
        :error-trace-id="detailError?.traceId ?? ''"
        @retry="retry"
      >
        <NForm :show-label="true" label-placement="top" :show-feedback="false">
          <NFormItem v-for="field in fields" :key="field.key" :label="field.label">
            <NInput
              v-if="field.type === 'text'"
              :value="textValue(field.key)"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder ?? ''"
              @update:value="(value: unknown) => setFormValue(field.key, value)"
            />
            <NInputNumber
              v-else-if="field.type === 'number'"
              v-bind="numberBounds(field)"
              :value="numberValue(field.key)"
              class="form-control"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder ?? ''"
              @update:value="(value: unknown) => setFormValue(field.key, value)"
            />
            <NSelect
              v-else-if="field.type === 'select' || field.type === 'status'"
              :value="selectValue(field.key)"
              :options="fieldOptions(field)"
              :disabled="field.disabled === true"
              :placeholder="`请选择${field.label}`"
              filterable
              @update:value="(value: unknown) => onSelectChange(field, value)"
            />
            <NInput
              v-else
              :value="textValue(field.key)"
              type="textarea"
              :disabled="field.disabled === true"
              :placeholder="field.placeholder ?? ''"
              :autosize="{ minRows: 3, maxRows: 6 }"
              @update:value="(value: unknown) => setFormValue(field.key, value)"
            />
          </NFormItem>
        </NForm>
      </AsyncState>
      <template #footer>
        <div class="drawer-footer">
          <NButton :disabled="saving" @click="close">取消</NButton>
          <NButton
            type="primary"
            :loading="saving"
            :disabled="loadingDetail || Boolean(detailError)"
            @click="submit"
          >
            保存
          </NButton>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.form-control {
  width: 100%;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
