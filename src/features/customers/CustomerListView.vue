<script setup lang="ts">
/**
 * 客户列表页：只有这两行——列表页的全部差异都在 `customerConfig` 里。
 *
 * 分页、筛选栏、表格、抽屉表单都由 `EntityListPage` 按配置渲染，
 * 新增资源页时照抄这里即可（配置写法见 `./customer.ts`）。
 */
import EntityListPage from '@/components/crud/EntityListPage.vue'
import { customerConfig } from '@/features/customers/customer'
</script>

<template>
  <EntityListPage :config="customerConfig" />
</template>
