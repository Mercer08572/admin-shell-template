<script setup lang="ts">
import { useBreakpoints } from '@vueuse/core'
import {
  Building2,
  ChevronDown,
  CircleGauge,
  KeyRound,
  Layers3,
  LogOut,
  Menu,
  Users,
} from '@lucide/vue'
import { NIcon, type DropdownOption, type MenuOption, useMessage } from 'naive-ui'
import { computed, h, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getErrorMessage } from '@/api/error'
import {
  closeTab,
  openTab,
  toTab,
  WORKBENCH_TAB,
  type ShellTab,
} from '@/components/layout/shell-tabs'
import { useAuthStore } from '@/features/auth/auth.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const message = useMessage()
const breakpoints = useBreakpoints({ mobile: 768 })
const isMobile = breakpoints.smaller('mobile')
const mobileMenuOpen = ref(false)
const loggingOut = ref(false)

const icon = (component: Component) => () => h(NIcon, null, { default: () => h(component) })

/**
 * 菜单项就是路由路径：`activeMenu` 靠路径前缀匹配，因此新增页面时
 * 这里补一项、路由表补一条即可，不需要额外的映射层。
 * `children` 是分组写法（这里用「业务示例」演示），分组本身不是路由。
 */
const menuOptions: MenuOption[] = [
  { label: '工作台', key: '/', icon: icon(CircleGauge) },
  {
    label: '业务示例',
    key: 'demo',
    icon: icon(Layers3),
    children: [{ label: '客户', key: '/customers', icon: icon(Users) }],
  },
]

const userOptions: DropdownOption[] = [
  { label: '修改密码', key: 'password', icon: icon(KeyRound) },
  { type: 'divider', key: 'divider' },
  { label: '退出登录', key: 'logout', icon: icon(LogOut) },
]

/**
 * 菜单按路径前缀匹配，取命中最长的那一项。
 *
 * 不能直接用 `route.path`：详情页（`/customers/101`）与列表页路径不同，
 * 精确匹配会让左侧菜单失去高亮。菜单项本身就是路由路径，因此直接复用 `menuOptions`。
 */
function collectMenuKeys(options: MenuOption[]): string[] {
  return options.flatMap((option) =>
    option.children ? collectMenuKeys(option.children) : [String(option.key)],
  )
}

const activeMenu = computed(() => {
  const path = route.path
  return (
    collectMenuKeys(menuOptions)
      .filter((key) => path === key || path.startsWith(`${key}/`))
      .sort((left, right) => right.length - left.length)[0] ?? path
  )
})

/**
 * 展开的分组。
 *
 * Naive UI 只在**挂载时**自动展开当前项的祖先分组，会话内导航（快捷入口、标签、详情跳转）
 * 进入分组内的页面时分组仍是收起的，左侧菜单看起来「什么都没选中」。
 * 因此这里自己控制展开态：路由变化时把当前页面所在的分组补进展开列表；
 * 用户手动折叠当前分组不会被强行拉开（只有再次切换分组才会重新展开）。
 */
const expandedKeys = ref<string[]>([])

const activeGroupKey = computed(() => {
  const active = activeMenu.value
  const group = menuOptions.find((option) =>
    option.children?.some((child) => String(child.key) === active),
  )
  return group ? String(group.key) : null
})

watch(
  activeGroupKey,
  (group) => {
    if (group && !expandedKeys.value.includes(group)) {
      expandedKeys.value = [...expandedKeys.value, group]
    }
  },
  { immediate: true },
)

function onExpandedKeys(keys: Array<string | number>) {
  expandedKeys.value = keys.map(String)
}

const pageTitle = computed(() => route.meta.title || 'Admin Shell')

/**
 * 右侧内容区的多标签工作台。
 *
 * 路由是唯一事实来源：菜单点击、详情跳转、浏览器前进/后退、深链都会走到这个 `watch`，
 * 因此标签集合永远等于「工作台 + 访问过的路由」。标签状态放在本组件内即可——
 * 登录后的路由之间 AdminShell 不会卸载，退出登录跳登录页时整体卸载，标签随之清空。
 *
 * `watch` 只在路由真正落地后登记：两次导航压进同一个 tick 时（中间那次页面还没渲染就被顶掉）
 * 只登记最终路由，不给一闪而过的中间路由留下标签。
 */
const tabs = ref<ShellTab[]>([WORKBENCH_TAB])
const activeTab = computed(() => route.path)

watch(
  () => route.path,
  () => {
    tabs.value = openTab(tabs.value, toTab({ path: route.path, meta: route.meta }))
  },
  { immediate: true },
)

function onTabSelect(key: string | number) {
  const path = String(key)
  if (path !== route.path) void router.push(path)
}

function onTabClose(key: string | number) {
  const result = closeTab(tabs.value, String(key), route.path)
  tabs.value = result.tabs
  // 关闭的是当前页时跳到左邻标签；关闭其他标签不打扰当前页面
  if (result.nextActive) void router.push(result.nextActive)
}

async function navigate(key: string | number) {
  mobileMenuOpen.value = false
  await router.push(String(key))
}

async function onUserAction(key: string | number) {
  if (key === 'password') {
    await router.push({ name: 'change-password' })
    return
  }
  if (key !== 'logout') return

  loggingOut.value = true
  try {
    await auth.logout()
    await router.replace({ name: 'login' })
  } catch (error) {
    message.error(getErrorMessage(error))
  } finally {
    loggingOut.value = false
  }
}
</script>

<template>
  <NLayout class="app-shell" has-sider>
    <NLayoutSider
      v-if="!isMobile"
      bordered
      class="app-sidebar"
      :width="232"
      :native-scrollbar="false"
    >
      <div class="brand">
        <span class="brand__mark"><Building2 :size="20" /></span>
        <span>Admin Shell</span>
      </div>
      <NMenu
        :value="activeMenu"
        :options="menuOptions"
        :indent="20"
        :expanded-keys="expandedKeys"
        inverted
        @update:value="navigate"
        @update:expanded-keys="onExpandedKeys"
      />
    </NLayoutSider>

    <NDrawer v-model:show="mobileMenuOpen" placement="left" :width="280">
      <NDrawerContent body-content-style="padding: 0; background: #18211f" closable>
        <template #header>
          <span class="drawer-title">Admin Shell</span>
        </template>
        <NMenu
          :value="activeMenu"
          :options="menuOptions"
          :indent="20"
          :expanded-keys="expandedKeys"
          inverted
          @update:value="navigate"
          @update:expanded-keys="onExpandedKeys"
        />
      </NDrawerContent>
    </NDrawer>

    <div class="shell-main">
      <header class="topbar">
        <NButton
          v-if="isMobile"
          quaternary
          circle
          aria-label="打开导航"
          @click="mobileMenuOpen = true"
        >
          <template #icon><Menu :size="20" /></template>
        </NButton>
        <h2>{{ pageTitle }}</h2>
        <NDropdown :options="userOptions" trigger="click" @select="onUserAction">
          <NButton quaternary class="user-button" :loading="loggingOut">
            <span class="user-avatar">{{ auth.admin?.username.slice(0, 1).toUpperCase() }}</span>
            <span class="user-name">{{ auth.admin?.username }}</span>
            <ChevronDown :size="15" />
          </NButton>
        </NDropdown>
      </header>

      <div class="tabbar">
        <NTabs
          :value="activeTab"
          type="card"
          size="small"
          :tabs-padding="12"
          @update:value="onTabSelect"
          @close="onTabClose"
        >
          <NTab
            v-for="tab in tabs"
            :key="tab.key"
            :name="tab.key"
            :label="tab.title"
            :closable="tab.closable"
          />
        </NTabs>
      </div>

      <div class="app-content">
        <RouterView />
      </div>
    </div>
  </NLayout>
</template>

<style scoped>
/*
 * 固定外壳：顶栏与标签条常驻，内容区自己滚动。
 *
 * 为什么不用 `position: sticky`：naive 的 `NLayout` 会额外渲染一层
 * `.n-layout-scroll-container`（`overflow-x: hidden`，按 CSS 规则计算成 `overflow-y: auto`），
 * 于是 sticky 的吸附基准落在那一层而不是视口，`top: 64px` 会把标签条整体下移 64 px，
 * 正好盖住页面头部的操作按钮（实测「新增」「编辑」都点不到，e2e 直接超时）。
 * 因此这里改成「外层固定高度 + 中间层不滚动 + 内容区是唯一滚动容器」。
 */
.app-shell {
  height: 100vh;
  /* 移动端地址栏收放时 vh 偏大，dvh 更贴近真实可视高度 */
  height: 100dvh;
  overflow: hidden;
}

/* naive 自动生成的外层滚动容器：必须关掉它的滚动，否则它会是第二个滚动区 */
.app-shell > :deep(.n-layout-scroll-container) {
  overflow: hidden;
}

.shell-main {
  display: flex;
  height: 100%;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

/* 两个 band 不参与伸缩：矮屏下绝不能被内容挤扁 */
.topbar,
.tabbar {
  flex: none;
}

.app-sidebar {
  background: var(--color-sidebar);
}

/* 矮屏（不含移动端，移动端用抽屉）保证菜单自身可滚，不被裁掉 */
.app-sidebar :deep(.n-layout-sider-scroll-container) {
  overflow-y: auto;
}

.brand {
  display: flex;
  height: 64px;
  align-items: center;
  gap: 11px;
  padding: 0 20px;
  color: #f5faf8;
  font-size: 16px;
  font-weight: 700;
}

.brand__mark {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 7px;
  color: #10201b;
  background: #64d4ae;
}

.topbar {
  display: flex;
  height: var(--shell-topbar-height);
  align-items: center;
  gap: 12px;
  padding: 0 22px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.topbar h2 {
  min-width: 0;
  flex: 1;
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-button {
  height: 38px;
}

.user-avatar {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  color: #0e5948;
  background: var(--color-primary-soft);
  font-size: 12px;
  font-weight: 700;
}

.user-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * 内容区是全应用唯一的滚动容器。
 * 高度由 flex 决定，因此必须 `min-height: 0`，否则内容会把容器顶高、滚不起来。
 */
.app-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--color-bg);
}

/*
 * 标签条高度固定在这个变量上：`--shell-tabbar-height` 同时被
 * `styles/main.css`（页面高度契约）和 `DataTable`（表格高度算式）引用。
 * 窄屏不换行、由 NTabs 内部横向滚动，因此这里必须裁剪溢出，否则 320 px 会撑破页面。
 */
.tabbar {
  height: var(--shell-tabbar-height);
  overflow: hidden;
  padding: 6px 0 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.tabbar :deep(.n-tabs-nav) {
  padding-left: 12px;
}

.drawer-title {
  color: #fff;
  font-weight: 700;
}

.tabbar :deep(.n-tabs-nav) {
  padding-left: 12px;
}

.drawer-title {
  color: #fff;
  font-weight: 700;
}

@media (max-width: 767px) {
  .topbar {
    padding: 0 12px;
  }

  .user-name {
    display: none;
  }
}
</style>
