/**
 * 页面 → 外壳的「标签标题回写」通道。
 *
 * 标签文案默认取 `route.meta.title`，但详情页的 meta 是静态的（如「客户详情」），
 * 同一路由打开多个标签后在标签条上无法区分。页面拿到数据后通过 `useShellTabTitle`
 * 把真实标题回写给外壳，外壳按 `route.path`（标签键）写进该标签的 `customTitle`。
 *
 * 为什么用 provide/inject 而不是 Pinia：标题只是外壳的展示状态，生命周期与外壳一致；
 * 页面也不需要知道标签集合，只需要一个「上报」入口。
 */

import { inject, toValue, watchEffect, type InjectionKey, type MaybeRefOrGetter } from 'vue'
import { useRoute } from 'vue-router'

/** 外壳提供的回写函数：按标签键更新标题 */
export type ShellTabTitleSetter = (key: string, title: string) => void

export const SHELL_TAB_TITLE_KEY: InjectionKey<ShellTabTitleSetter> = Symbol('shell-tab-title')

/**
 * 页面把「数据到达后的标题」回写给外壳。
 *
 * - 标签键在 setup 时取 `route.path`：标签键就是 path，且内容视图已按 path 重建，
 *   因此这个实例只会改到自己那个标签，数据晚到也不会写到别的标签上；
 * - 传 `null` / `undefined` / 空串表示「数据还没到」，保持 meta 标题不动；
 * - 外面没有外壳提供 setter 时（页面被单独挂载，如组件测试）静默跳过。
 */
export function useShellTabTitle(title: MaybeRefOrGetter<string | null | undefined>): void {
  const setTitle = inject(SHELL_TAB_TITLE_KEY, null)
  if (!setTitle) return

  const key = useRoute().path

  watchEffect(() => {
    const value = toValue(title)
    if (value) setTitle(key, value)
  })
}
