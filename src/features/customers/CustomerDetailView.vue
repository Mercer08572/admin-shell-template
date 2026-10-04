<script setup lang="ts">
/**
 * 客户详情页：客户基础信息 + 该客户下的联系人子表。
 *
 * 两条关键约定：
 * 1. 子表只按 `customer_id` 取数（`GET /contacts?customer_id=`），不做跨客户查询；
 * 2. 就地新增/编辑联系人复用 `EntityFormDrawer` 与 `contact.ts` 的字段定义，
 *    其中「所属客户」锁定为当前客户——既保证 `customer_id` 一定出现在载荷里
 *    （`PUT` 是全量替换，漏发等于清空归属），也避免把联系人挪到别的客户。
 *
 * 基础信息与联系人两块各自有加载 / 空 / 错误 / 重试（`AsyncState` 四态）。
 */

import { ChevronLeft, Pencil, Plus, RefreshCw } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton } from 'naive-ui'

import { contactsApi } from '@/api/contacts'
import { customersApi } from '@/api/customers'
import { getErrorDetail, type ErrorDetail } from '@/api/error'
import AsyncState from '@/components/common/AsyncState.vue'
import DataTable from '@/components/common/DataTable.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusTag from '@/components/common/StatusTag.vue'
import EntityFormDrawer from '@/components/crud/EntityFormDrawer.vue'
import { contactColumns, contactFieldsForCustomer } from '@/features/customers/contact'
import { customerConfig, customerFields, customerLevelLabel } from '@/features/customers/customer'
import { toApiInput } from '@/lib/crud/entity-form'
import { useEntityList } from '@/lib/crud/entity-list'
import { actionColumn } from '@/lib/crud/row-actions'

import type { Contact, ContactInput, Customer } from '@/types/api'

/** 子表一次取满（后端 `MaxListLimit` = 100）；更多联系人应去独立的联系人列表查 */
const CONTACT_PAGE_SIZE = 100

const route = useRoute()
const router = useRouter()
const customerId = Number(route.params.id)

const customer = ref<Customer | null>(null)
const customerLoading = ref(false)
const customerError = ref<ErrorDetail | null>(null)
const customerDrawerOpen = ref(false)

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
} = useEntityList<Contact>({
  title: '联系人',
  load: () => contactsApi.list({ customer_id: customerId, limit: CONTACT_PAGE_SIZE, offset: 0 }),
  remove: contactsApi.remove,
})

const columns = computed(() => [
  ...contactColumns,
  actionColumn<Contact>({ onEdit: onEditContact, onDelete: confirmDelete }),
])

/** 联系人表单：`customer_id` 锁定为当前客户 */
const contactFields = computed(() => contactFieldsForCustomer(customerId))

/**
 * 编辑时用来预填的那一行。
 *
 * 契约里没有 `GET /contacts/:id`（联系人只作为子表存在），而子表已经拿到了整行数据，
 * 因此直接把该行交给抽屉预填，不额外发一次请求。
 */
const editingContact = ref<Contact | null>(null)

function onEditContact(row: Contact) {
  editingContact.value = row
  openEdit(row)
}

function loadContact(): Promise<object> {
  return Promise.resolve(editingContact.value ?? {})
}

function createContact(body: Record<string, unknown>): Promise<Contact> {
  return contactsApi.create(toApiInput<ContactInput>(body))
}

function updateContact(id: number, body: Record<string, unknown>): Promise<Contact> {
  return contactsApi.update(id, toApiInput<ContactInput>(body))
}

const pageTitle = computed(() =>
  customer.value ? `客户 ${customer.value.code} - ${customer.value.name}` : '客户详情',
)

async function loadCustomer() {
  customerLoading.value = true
  customerError.value = null
  try {
    customer.value = await customersApi.get(customerId)
  } catch (error) {
    customer.value = null
    customerError.value = getErrorDetail(error)
  } finally {
    customerLoading.value = false
  }
}

function backToList() {
  void router.push('/customers')
}

onMounted(() => {
  void loadCustomer()
  void reload()
})
</script>

<template>
  <main class="page">
    <PageHeader :title="pageTitle" description="该客户下的联系人">
      <template #actions>
        <NButton @click="backToList">
          <template #icon><ChevronLeft :size="16" /></template>
          返回列表
        </NButton>
        <NButton :disabled="!customer" @click="customerDrawerOpen = true">
          <template #icon><Pencil :size="16" /></template>
          编辑客户
        </NButton>
        <NButton type="primary" @click="openCreate">
          <template #icon><Plus :size="16" /></template>
          新增联系人
        </NButton>
        <NButton :loading="loading" @click="reload">
          <template #icon><RefreshCw :size="16" /></template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <section class="panel" aria-labelledby="customer-facts-heading">
      <div class="panel-head">
        <h2 id="customer-facts-heading">基础信息</h2>
      </div>
      <AsyncState
        :loading="customerLoading"
        :error="customerError?.message ?? ''"
        :error-trace-id="customerError?.traceId ?? ''"
        @retry="loadCustomer"
      >
        <dl v-if="customer" class="customer-facts">
          <div class="customer-fact">
            <dt>编码</dt>
            <dd>{{ customer.code }}</dd>
          </div>
          <div class="customer-fact">
            <dt>名称</dt>
            <dd>{{ customer.name }}</dd>
          </div>
          <div class="customer-fact">
            <dt>等级</dt>
            <dd>{{ customerLevelLabel(customer.level) }}</dd>
          </div>
          <div class="customer-fact">
            <dt>状态</dt>
            <dd><StatusTag :status="customer.status" /></dd>
          </div>
          <div class="customer-fact">
            <dt>电话</dt>
            <dd>{{ customer.phone || '-' }}</dd>
          </div>
          <div class="customer-fact customer-fact--wide">
            <dt>备注</dt>
            <dd>{{ customer.remark || '-' }}</dd>
          </div>
        </dl>
      </AsyncState>
    </section>

    <section class="panel" aria-labelledby="contacts-heading">
      <div class="panel-head">
        <h2 id="contacts-heading">联系人（{{ rows.length }}）</h2>
        <p>只显示当前客户下的联系人；新增或编辑时「所属客户」固定为当前客户。</p>
      </div>
      <AsyncState
        :loading="loading"
        :error="errorDetail?.message ?? ''"
        :error-trace-id="errorDetail?.traceId ?? ''"
        :empty="rows.length === 0"
        empty-text="该客户暂无联系人"
        @retry="reload"
      >
        <DataTable :columns="columns" :rows="rows" export-file-name="联系人" />
      </AsyncState>
    </section>

    <EntityFormDrawer
      v-model:show="customerDrawerOpen"
      :fields="customerFields"
      :title="customerConfig.title"
      mode="edit"
      :entity-id="customerId"
      :load="customerConfig.get"
      :update="customerConfig.update"
      @saved="loadCustomer"
    />

    <EntityFormDrawer
      v-model:show="drawerOpen"
      :fields="contactFields"
      title="联系人"
      :mode="drawerMode"
      :entity-id="editingId"
      :load="loadContact"
      :create="createContact"
      :update="updateContact"
      @saved="onSaved"
    />
  </main>
</template>

<style scoped>
.panel-head {
  padding: 14px 16px 10px;
}

.panel-head h2 {
  margin: 0;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
}

.panel-head p {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

/**
 * 基础信息用「标签 / 取值」成对展示。
 *
 * 标签与取值是两个独立元素，窄屏时按 `minmax` 自动回落成单列，
 * 不需要为 320 px 单独写一套布局。
 */
.customer-facts {
  display: grid;
  gap: 14px 24px;
  margin: 0;
  padding: 6px 16px 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}

.customer-fact {
  min-width: 0;
}

.customer-fact--wide {
  grid-column: 1 / -1;
}

.customer-fact dt {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.customer-fact dd {
  margin: 2px 0 0;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .customer-facts {
    gap: 12px;
    padding: 4px 16px 14px;
  }
}
</style>
