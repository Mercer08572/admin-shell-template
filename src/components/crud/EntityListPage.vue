<script setup lang="ts" generic="T extends BaseEntity">
/**
 * 通用列表页模板：一份 `ResourceConfig` 进来，筛选栏 / 表格 / 分页 / 表单抽屉全部配置驱动。
 *
 * 资源页（见 `src/features/customers/CustomerListView.vue`）只需要提供配置，不写模板细节；
 * 状态机在 `@/lib/crud/entity-list.ts`，表单求值逻辑在 `@/lib/crud/entity-form.ts`。
 */

import { Plus, RefreshCw } from '@lucide/vue'
import { computed, ref } from 'vue'
import { NButton, NForm, NFormItem, NInput, NSelect } from 'naive-ui'
import { useRouter } from 'vue-router'

import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EntityFormDrawer from '@/components/crud/EntityFormDrawer.vue'
import { hasNextPage, useEntityList } from '@/lib/crud/entity-list'
import { DEFAULT_PAGE_SIZE, type ListQuery, type ResourceConfig } from '@/lib/crud/list-config'
import { actionColumn } from '@/lib/crud/row-actions'

import type { DataTableColumn } from '@/components/common/data-table'
import type { BaseEntity } from '@/types/api'

const props = defineProps<{ config: ResourceConfig<T> }>()

const router = useRouter()

/** 筛选控件里的当前值；`null` / 空串都表示「不限」，不会进入请求 */
const filterValues = ref<Record<string, string | number | null>>({})
const offset = ref(0)

const filters = computed(() => props.config.filters ?? [])

/** 组装本次查询：分页参数恒定，筛选值只带有值的那部分 */
function currentQuery(): ListQuery {
  const selected: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(filterValues.value)) {
    if (value !== null && value !== '') selected[key] = value
  }
  return { limit: DEFAULT_PAGE_SIZE, offset: offset.value, filters: selected }
}

const {
  rows,
  loading,
  errorDetail,
  drawerOpen,
  drawerMode,
  editingId,
  reload,
  openCreate,
  openEdit,
  onSaved,
  confirmDelete,
} = useEntityList<T>({
  title: props.config.title,
  load: () => props.config.load(currentQuery()),
  remove: (id) => props.config.remove(id),
})

// 首屏加载：进入页面时拉一次当前条件下的第一页
void reload()

const columns = computed<DataTableColumn<T>[]>(() => [
  ...(props.config.columns ?? []),
  actionColumn<T>({
    onEdit: openEdit,
    onDelete: confirmDelete,
    ...(props.config.detailRoute ? { onDetail: openDetail } : {}),
  }),
])

/** 有详情页的资源：整行可点击 + 操作列「详情」按钮 */
const detailRoute = computed(() => props.config.detailRoute)

function openDetail(row: T) {
  const route = props.config.detailRoute?.(row)
  if (route) void router.push(route)
}

/** 表格的行点击回调签名是 `(row: unknown)`，这里收窄回本资源的行类型 */
function onRowClick(row: unknown) {
  openDetail(row as T)
}

const canGoPrev = computed(() => offset.value > 0)
const canGoNext = computed(() => hasNextPage(rows.value.length, DEFAULT_PAGE_SIZE))
const pageNumber = computed(() => Math.floor(offset.value / DEFAULT_PAGE_SIZE) + 1)
const pageDescription = computed(
  () => `第 ${pageNumber.value} 页 · 当前结果 ${rows.value.length} 条`,
)

/** 条件变化必须回到第一页，否则会拿着旧 offset 查新条件 */
async function search() {
  offset.value = 0
  await reload()
}

async function reset() {
  filterValues.value = {}
  await search()
}

async function goPrev() {
  if (!canGoPrev.value) return
  offset.value = Math.max(0, offset.value - DEFAULT_PAGE_SIZE)
  await reload()
}

async function goNext() {
  if (!canGoNext.value) return
  offset.value += DEFAULT_PAGE_SIZE
  await reload()
}

// 控件的值类型各不相同，统一走 setFilterValue，模板里不做类型断言
function textFilterValue(key: string): string {
  const value = filterValues.value[key]
  return typeof value === 'string' ? value : ''
}

function selectFilterValue(key: string): string | number | null {
  return filterValues.value[key] ?? null
}

function setFilterValue(key: string, value: unknown) {
  filterValues.value = {
    ...filterValues.value,
    [key]: typeof value === 'string' || typeof value === 'number' ? value : null,
  }
}
</script>

<template>
  <main class="page">
    <PageHeader :title="config.title" :description="pageDescription">
      <template #actions>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel">
      <NForm
        v-if="filters.length > 0"
        inline
        :show-feedback="false"
        class="filters"
        @submit.prevent="search"
      >
        <NFormItem v-for="filter in filters" :key="filter.key" :label="filter.label">
          <NInput
            v-if="filter.type === 'text'"
            class="filters__input"
            clearable
            :value="textFilterValue(filter.key)"
            :placeholder="filter.placeholder ?? ''"
            @update:value="(value: unknown) => setFilterValue(filter.key, value)"
          />
          <NSelect
            v-else
            class="filters__select"
            clearable
            filterable
            :value="selectFilterValue(filter.key)"
            :options="[...(filter.options ?? [])]"
            :placeholder="filter.placeholder ?? `全部${filter.label}`"
            @update:value="(value: unknown) => setFilterValue(filter.key, value)"
          />
        </NFormItem>
        <div class="filters__actions">
          <NButton attr-type="submit" type="primary" :loading="loading">查询</NButton>
          <NButton @click="reset">重置</NButton>
        </div>
      </NForm>

      <DataTable
        :columns="columns"
        :rows="rows"
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        :export-file-name="config.title"
        :row-clickable="Boolean(detailRoute)"
        @row-click="onRowClick"
        @retry="reload"
      />

      <footer class="pager">
        <span class="pager__hint">契约没有总数，仅支持前后翻页</span>
        <div class="pager__actions">
          <NButton size="small" :disabled="!canGoPrev || loading" @click="goPrev">上一页</NButton>
          <NButton size="small" :disabled="!canGoNext || loading" @click="goNext">下一页</NButton>
        </div>
      </footer>
    </section>

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="config.fields"
      :title="config.title"
      :mode="drawerMode"
      :entity-id="editingId"
      :load="config.get"
      :create="config.create"
      :update="config.update"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.filters {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.filters__input,
.filters__select {
  width: 200px;
}

.filters__actions {
  display: flex;
  gap: 8px;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
}

.pager__hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.pager__actions {
  display: flex;
  gap: 8px;
}

:deep(.row-actions) {
  display: inline-flex;
  justify-content: flex-end;
  gap: 2px;
}

@media (max-width: 680px) {
  .filters {
    align-items: stretch;
    flex-direction: column;
  }

  .filters :deep(.n-form-item),
  .filters__input,
  .filters__select {
    width: 100%;
  }

  .filters__actions > * {
    flex: 1;
  }

  .pager {
    align-items: stretch;
    flex-direction: column;
  }

  .pager__actions > * {
    flex: 1;
  }
}
</style>
