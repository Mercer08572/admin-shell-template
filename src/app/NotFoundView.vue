<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
</script>

<template>
  <main class="not-found">
    <div>
      <p class="not-found__code">404</p>
      <h1>页面不存在</h1>
      <RouterLink to="/" class="not-found__link">
        <ArrowLeft :size="17" />
        返回工作台
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.not-found {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  text-align: center;
}

.not-found__code {
  margin: 0;
  color: var(--color-primary);
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
}

.not-found h1 {
  margin: 16px 0 28px;
  font-size: 22px;
}

.not-found__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
}
</style>
