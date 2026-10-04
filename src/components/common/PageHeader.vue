<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="page-header">
    <div class="page-header__copy">
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header__copy {
  min-width: 0;
}

.page-header h1 {
  margin: 0;
  color: var(--color-text);
  font-size: 22px;
  font-weight: 680;
  letter-spacing: 0;
  line-height: 1.35;
}

.page-header p {
  margin: 5px 0 0;
  color: var(--color-text-muted);
  font-size: 13px;
}

.page-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

@media (max-width: 640px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .page-header__actions > :deep(*) {
    flex: 1;
  }
}
</style>
