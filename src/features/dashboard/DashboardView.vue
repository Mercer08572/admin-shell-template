<script setup lang="ts">
import { ContactRound, KeyRound, RefreshCw, Users } from '@lucide/vue'
import { onMounted, ref, type Component } from 'vue'

import { getErrorDetail, type ErrorDetail } from '@/api/error'
import { healthApi } from '@/api/health'
import AsyncState from '@/components/common/AsyncState.vue'
import PageHeader from '@/components/common/PageHeader.vue'

import type { HealthStatus } from '@/types/api'

interface QuickLink {
  label: string
  to: string
  icon: Component
  tone: 'green' | 'blue' | 'amber'
}

/**
 * 快捷入口：三个链接正好演示三种页面形态——列表页、详情页深链、表单页。
 * 换成自己的模块时，把这里的 `to` 指向真实路由即可。
 */
const quickLinks: QuickLink[] = [
  { label: '客户列表', to: '/customers', icon: Users, tone: 'green' },
  { label: '客户详情示例', to: '/customers/101', icon: ContactRound, tone: 'blue' },
  { label: '修改密码', to: '/account/password', icon: KeyRound, tone: 'amber' },
]

const health = ref<HealthStatus | null>(null)
const errorDetail = ref<ErrorDetail | null>(null)
const checkingHealth = ref(false)

async function checkHealth() {
  checkingHealth.value = true
  errorDetail.value = null
  try {
    health.value = await healthApi.get()
  } catch (error) {
    health.value = null
    errorDetail.value = getErrorDetail(error)
  } finally {
    checkingHealth.value = false
  }
}

onMounted(checkHealth)
</script>

<template>
  <main class="page dashboard">
    <PageHeader title="工作台" description="Admin Shell 管理入口">
      <template #actions>
        <NButton :loading="checkingHealth" @click="checkHealth">
          <template #icon><RefreshCw :size="16" /></template>
          检查服务
        </NButton>
      </template>
    </PageHeader>

    <AsyncState
      :loading="checkingHealth"
      :error="errorDetail?.message ?? ''"
      :error-trace-id="errorDetail?.traceId ?? ''"
      @retry="checkHealth"
    >
      <section class="service-strip">
        <span class="service-strip__dot" />
        <div>
          <strong>API 服务正常</strong>
          <p>{{ health?.service || 'admin-shell-template' }}</p>
        </div>
        <span v-if="health" class="service-strip__status">{{ health.status }}</span>
      </section>
    </AsyncState>

    <section aria-labelledby="quick-entry-heading">
      <h2 id="quick-entry-heading" class="section-title">快捷入口</h2>
      <div class="quick-grid">
        <RouterLink v-for="item in quickLinks" :key="item.to" :to="item.to" class="quick-link">
          <span class="quick-link__icon" :class="`quick-link__icon--${item.tone}`">
            <component :is="item.icon" :size="20" />
          </span>
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 1180px;
}

.service-strip {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid #cfe5de;
  border-radius: 8px;
  background: #f0f8f5;
}

.service-strip__dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #25a57f;
  box-shadow: 0 0 0 5px rgba(37, 165, 127, 0.13);
}

.service-strip div {
  min-width: 0;
  flex: 1;
}

.service-strip strong {
  display: block;
  font-size: 14px;
}

.service-strip p {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-strip__status {
  color: #1d775f;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.section-title {
  margin: 6px 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.quick-link {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  background: #fff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.quick-link:hover {
  border-color: #aabbb5;
  box-shadow: 0 3px 10px rgba(30, 48, 42, 0.06);
}

.quick-link__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 7px;
}

.quick-link__icon--green {
  color: #147d64;
  background: #e6f3ef;
}

.quick-link__icon--blue {
  color: #286f9d;
  background: #e7f1f7;
}

.quick-link__icon--amber {
  color: #9a6b10;
  background: #f8f0dd;
}

@media (max-width: 800px) {
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
