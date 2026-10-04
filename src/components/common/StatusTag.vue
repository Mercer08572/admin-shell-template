<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status?: string }>()

const state = computed(() => {
  const active = ['active', 'ok'].includes(props.status ?? '')
  return {
    label: active ? '正常' : props.status === 'inactive' ? '停用' : (props.status ?? '-'),
    type: active ? 'success' : 'default',
  } as const
})
</script>

<template>
  <NTag :type="state.type" size="small" :bordered="false">{{ state.label }}</NTag>
</template>
