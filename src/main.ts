import {
  create,
  NAlert,
  NButton,
  NConfigProvider,
  NDialogProvider,
  NDrawer,
  NDrawerContent,
  NDropdown,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NLayout,
  NLayoutSider,
  NLoadingBarProvider,
  NMenu,
  NMessageProvider,
  NSelect,
  NTab,
  NTabs,
  NTag,
} from 'naive-ui'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import { router } from '@/router'
import { pinia } from '@/stores'
import '@/styles/main.css'

const naive = create({
  components: [
    NAlert,
    NButton,
    NConfigProvider,
    NDialogProvider,
    NDrawer,
    NDrawerContent,
    NDropdown,
    NForm,
    NFormItem,
    NIcon,
    NInput,
    NInputNumber,
    NLayout,
    NLayoutSider,
    NLoadingBarProvider,
    NMenu,
    NMessageProvider,
    NSelect,
    NTab,
    NTabs,
    NTag,
  ],
})

createApp(App).use(naive).use(pinia).use(router).mount('#app')
