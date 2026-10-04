<script setup lang="ts">
import { NConfigProvider, NDialogProvider, NLoadingBarProvider, NMessageProvider } from 'naive-ui'

import { naiveThemeOverrides } from '@/app/theme'
</script>

<template>
  <NConfigProvider :theme-overrides="naiveThemeOverrides">
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider>
          <RouterView />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
