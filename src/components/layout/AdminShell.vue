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
  PanelLeftClose,
  PanelLeftOpen,
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
import { readSidebarCollapsed, writeSidebarCollapsed } from '@/components/layout/sidebar-collapsed'
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
 * 侧栏折叠：折叠后只剩图标（232 → 64），悬浮图标显示菜单名。
 *
 * 悬浮显示名称是 Naive 内建行为，不需要自己写 tooltip：
 * - 叶子项由 `MenuOption` 的 `NTooltip` 承担，其 `disabled: !dropdownEnabled`，
 *   而 `dropdownEnabled = root && collapsed` —— 只在折叠态启用；
 * - 有子项的分组由 `Submenu` 的 `NDropdown`（trigger: hover）承担，条件相同。
 * 因此这里只要把 `collapsed` 传给 `NLayoutSider` 与 `NMenu` 即可。
 *
 * 状态持久化（localStorage）：刷新或下次进入仍保持用户选择。
 * 移动端不适用——那里侧栏整体由抽屉代替，抽屉内始终显示名称。
 */
const sidebarCollapsed = ref(readSidebarCollapsed())

watch(sidebarCollapsed, (collapsed) => writeSidebarCollapsed(collapsed))

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

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
      :collapsed-width="64"
      collapse-mode="width"
      :collapsed="sidebarCollapsed"
      @update:collapsed="sidebarCollapsed = $event"
    >
      <div class="brand" :class="{ 'brand--collapsed': sidebarCollapsed }">
        <span class="brand__mark"><Building2 :size="20" /></span>
        <span class="brand__title">Admin Shell</span>
      </div>
      <NMenu
        :value="activeMenu"
        :options="menuOptions"
        :indent="20"
        :expanded-keys="expandedKeys"
        :collapsed="sidebarCollapsed"
        :collapsed-width="64"
        inverted
        @update:value="navigate"
        @update:expanded-keys="onExpandedKeys"
      />

      <div class="sider-footer">
        <button
          type="button"
          class="sider-toggle"
          :class="{ 'sider-toggle--collapsed': sidebarCollapsed }"
          :aria-label="sidebarCollapsed ? '展开导航' : '收起导航'"
          @click="toggleSidebar"
        >
          <span class="sider-toggle__icon">
            <PanelLeftOpen v-if="sidebarCollapsed" :size="24" />
            <PanelLeftClose v-else :size="20" />
          </span>
          <span class="sider-toggle__label">收起导航</span>
        </button>
      </div>
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

  /*
   * 侧栏折叠过渡时长——**本文件里唯一的时长定义**，四条与折叠相关的过渡都引用它。
   *
   * 必须与 Naive 侧栏自身的宽度过渡一致：它内部写的是 `min/max-width .3s var(--n-bezier)`，
   * 且没有导出任何时长变量（`--n-*duration*` 为空），所以只能在这里写同一个字面量。
   * 缓动则直接复用 Naive 的 `--n-bezier`（它内联在侧栏根上，自定义属性会继承下来）。
   * 一旦两边时长不同，收起/展开时就会出现「栏宽还在动、标记已经走完」的错位感；
   * `tests/sidebar.spec.ts` 的「宽度过渡期间」用例会逐帧比对两者的进度，改错即失败。
   */
  --shell-collapse-duration: 0.3s;
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
/*
 * 侧栏内部是「品牌 + 可滚动菜单 + 常驻底部开关」三段：
 * 让 naive 的内容容器变成 flex 列、滚动交给菜单那一块，底部开关才能钉住。
 *
 * 注意容器是 `.n-layout-sider-scroll-container`：这要求 sider 使用**原生滚动条**
 * （`native-scrollbar` 保持默认 true）。若改成 `:native-scrollbar="false"`，
 * 内容会被包进 `.n-scrollbar`，这条规则就成了死规则，底部开关会跟着菜单一起被顶走。
 *
 * 另外**不要**指望在这里写 `overflow: hidden` 挡住动画期间的横向滚动条：
 * Naive 给这个容器打了**内联**的 `overflow: auto`，内联样式优先于样式表规则，
 * 它照样能滚。真正要解决的是「别让内容溢出」，见下面各段的 `min-width: 0` 说明。
 */
.app-sidebar :deep(.n-layout-sider-scroll-container) {
  display: flex;
  height: 100%;
  flex-direction: column;
  /* 兜底：万一将来 Naive 不再内联 overflow，这一条也能挡住滚动条 */
  overflow: hidden;
}

/*
 * 宽度动画期间不出现横向滚动条的**根因修法**：
 * 这里的 flex 列容器（sider 内容区）在内联 `overflow: auto` 下，只要子项比容器宽就会
 * 立刻渲染出横向滚动条。而列方向 flex 子项的 `min-width` 默认是 `auto`（= min-content），
 * 它会拒绝被压到比「图标 + 文字」更窄 —— 展开动画的头几帧容器还只有 64~90px，
 * 子项却要 88~130px，于是溢出、滚动条一闪而过（收起方向不会：collapsed 类立刻生效，
 * 菜单项自己先收成 64px，min-content 也跟着变小）。
 * 因此：给每个子项 `min-width: 0` 让它们能被压窄，并各自 `overflow: hidden` 把内容裁掉。
 */
.app-sidebar :deep(.n-menu) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  /* 显式写成 `hidden auto`：只给 `overflow-y` 会让 `overflow-x` 被算成 auto */
  overflow: hidden auto;
}

/*
 * 品牌区与折叠开关同一套原则：**过渡期间不能有瞬时翻转的布局**。
 *
 * 这里只改一个连续变化的量 `padding-left`（展开 20 / 折叠 15），
 * 并让它与 sider 的宽度过渡（0.3s、`cubic-bezier(.4, 0, .2, 1)`）同参，
 * 于是标记从「与菜单图标左对齐」平滑滑到「栏内居中」，而不是瞬间跳过去。
 *
 * 不要用 `justify-content: center` 之类的写法：那是瞬时生效的布局切换，
 * 折叠时标记会先跳到当前宽度的中间、再随宽度缩回左边。
 */
.brand {
  display: flex;
  height: 64px;
  min-width: 0; /* 见上面侧栏内容区的说明：允许被压窄，避免撑出横向滚动条 */
  align-items: center;
  gap: 11px;
  overflow: hidden;
  padding: 0 20px;
  color: #f5faf8;
  font-size: 16px;
  font-weight: 700;
  transition: padding-left var(--shell-collapse-duration)
    var(--n-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

/* 折叠后栏内 64px：标记 34px，(64-34)/2 = 15，正好与菜单图标同一条中轴（x=32） */
.brand--collapsed {
  padding-left: 15px;
}

/* 文字常驻 DOM 并淡出：用 `display: none` 会在过渡中途把文字抽走，表现为突然跳动 */
.brand__title {
  overflow: hidden;
  white-space: nowrap;
  transition: opacity var(--shell-collapse-duration) var(--n-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

.brand--collapsed .brand__title {
  opacity: 0;
}

/*
 * 折叠开关钉在侧栏底部（三段式：品牌固定 / 菜单滚动 / 开关固定）。
 *
 * 用**原生 button** 而不是 NButton：按钮内部有「`1em` 图标尺寸 + 内容层居中 +
 * 图标层固定宽度」三层规则，外部很难精确对齐到菜单图标那一列。
 *
 * 动画期间的三条不变量（sider 只做宽度过渡，任何「瞬时翻转的布局」都会表现为抖动）：
 * 1. 图标位置恒定——图标盒固定 24px、左边距固定 20px，图标中心恒在 x=32（与菜单图标同列），
 *    折叠前后都不改 padding/对齐方式，宽度过渡时图标才不会先跳到中间再缩回去；
 * 2. 文字不换行——固定裁掉溢出，动画期间宽度不足时不会逐字竖排；
 * 3. 不出现滚动条——菜单与底部区都显式 `overflow-x: hidden`（`overflow-y: auto` 会让
 *    `overflow-x` 被计算成 auto，宽度收缩时立刻长出横向滚动条）。
 */
.sider-footer {
  flex: none;
  min-width: 0; /* 同上：折叠动画期间允许被压窄到栏宽以内 */
  overflow: hidden;
  padding: 6px 0 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.sider-toggle {
  display: flex;
  width: 100%;
  height: 42px;
  align-items: center;
  gap: 8px;
  padding: 0 0 0 20px;
  border: 0;
  border-radius: 6px;
  color: #bbb;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  transition: color var(--shell-collapse-duration) var(--n-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

/* 24px 图标盒：展开态放 20px、折叠态放 24px 图标，两者都居中，盒子位置不动 */
.sider-toggle__icon {
  display: flex;
  width: 24px;
  height: 24px;
  flex: none;
  align-items: center;
  justify-content: center;
}

.sider-toggle__label {
  overflow: hidden;
  white-space: nowrap;
  transition: opacity var(--shell-collapse-duration) var(--n-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

/* 折叠态：文字淡出（仍在 DOM 里，不会被 v-if 打断过渡），布局保持不变 */
.sider-toggle--collapsed .sider-toggle__label {
  opacity: 0;
}

/* 默认与悬浮和相邻菜单项完全一致：文字/图标变白，背景保持透明 */
.sider-toggle:hover,
.sider-toggle:focus {
  color: #fff;
}

/* 键盘焦点必须看得见；`:focus-visible` 保证鼠标点击不会留下焦点环 */
.sider-toggle:focus-visible {
  outline: 2px solid #64d4ae;
  outline-offset: -2px;
}

.brand__mark {
  display: grid;
  width: 34px;
  height: 34px;
  /*
   * 必须禁止收缩：折叠后栏内只有 64px，而这一行需要 `15 + 34 + 11 + 文字 + 20`，
   * flex 会先把它压到内部图标的最小宽度（实测 34×34 → 20×34，正方形被压扁变形）。
   * 尺寸不该变的元素（logo / 图标盒）一律 `flex: none`；
   * 该被压缩的（文字层）则保留 `overflow: hidden`，让它的自动最小尺寸降为 0。
   */
  flex: none;
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
