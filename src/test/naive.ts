import {
  create,
  NAlert,
  NButton,
  NCheckbox,
  NCheckboxGroup,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NPopover,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui'

/**
 * 只在测试里注册视图用到的 Naive UI 组件。
 *
 * 应用里由 `src/main.ts` 全局注册，测试环境没有那次注册，
 * 因此这里按需给出一份集合（不含 NMessageProvider / NDialogProvider：
 * 测试直接 mock `useMessage` / `useDialog`）。
 */
export const naiveTestPlugin = create({
  components: [
    NAlert,
    NButton,
    NCheckbox,
    NCheckboxGroup,
    NDataTable,
    NDrawer,
    NDrawerContent,
    NEmpty,
    NForm,
    NFormItem,
    NInput,
    NInputNumber,
    NPopover,
    NSelect,
    NSpin,
    NTag,
  ],
})
