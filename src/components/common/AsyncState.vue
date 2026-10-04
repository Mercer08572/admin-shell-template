<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { NAlert, NButton, NSpin } from 'naive-ui'
import { computed } from 'vue'

/**
 * 异步区域的四态容器：加载 / 空 / 错误+重试 / 成功。
 *
 * 优先级：error > loading > empty > success。
 * 错误态统一展示后端响应封装里的 `trace_id`，它此前只被 `ApiError` 捕获却从未呈现给用户。
 */
const props = withDefaults(
  defineProps<{
    loading?: boolean
    /** 有值即渲染错误态，并覆盖 loading / empty */
    error?: string
    /** 后端响应封装中的 trace_id，仅在错误态展示 */
    errorTraceId?: string
    /** 成功但无数据 */
    empty?: boolean
    emptyText?: string
  }>(),
  {
    loading: false,
    error: '',
    errorTraceId: '',
    empty: false,
    emptyText: '暂无数据',
  },
)

const emit = defineEmits<{ retry: [] }>()

const state = computed<'error' | 'loading' | 'empty' | 'success'>(() => {
  if (props.error) return 'error'
  if (props.loading) return 'loading'
  if (props.empty) return 'empty'
  return 'success'
})
</script>

<template>
  <div class="async-state" :data-state="state">
    <template v-if="state === 'error'">
      <slot name="error" :error="error" :trace-id="errorTraceId" :retry="() => emit('retry')">
        <NAlert type="error" :show-icon="true" class="async-state__error">
          <div class="async-state__error-body">
            <div class="async-state__error-copy">
              <span>{{ error }}</span>
              <span v-if="errorTraceId" class="async-state__trace">
                追踪 ID：<code>{{ errorTraceId }}</code>
              </span>
            </div>
            <NButton size="tiny" @click="emit('retry')">
              <template #icon><RotateCcw :size="14" /></template>
              重试
            </NButton>
          </div>
        </NAlert>
      </slot>
    </template>

    <div v-else-if="state === 'loading'" class="async-state__loading">
      <slot name="loading">
        <NSpin size="small" />
      </slot>
    </div>

    <slot v-else-if="state === 'empty'" name="empty">
      <div class="async-state__empty">{{ emptyText }}</div>
    </slot>

    <slot v-else />
  </div>
</template>

<style scoped>
.async-state__error-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.async-state__error-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.async-state__trace {
  color: var(--color-text-muted, #5c6b66);
  font-size: 12px;
}

.async-state__trace code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.async-state__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.async-state__empty {
  padding: 24px;
  color: var(--color-text-muted, #5c6b66);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 680px) {
  .async-state__error-body {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
