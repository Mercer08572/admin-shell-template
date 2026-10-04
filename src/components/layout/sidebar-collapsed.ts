/**
 * 侧栏折叠状态。
 *
 * 只存一个 UI 偏好布尔值（`'1'` / `'0'`），**不涉及任何凭据**：
 * 会话仍然是后端下发的 HttpOnly Cookie，前端不碰。
 *
 * 单独成模块的原因：读写落在浏览器存储上，而「存储不可用」（隐私模式、被策略禁用）
 * 这条分支必须吞掉异常、退化成默认值——这种分支值得单独测，不该埋在外壳组件里。
 */

/** 存储键：前缀与项目名一致，避免与同域其它应用冲突 */
export const SIDEBAR_COLLAPSED_KEY = 'admin-shell-template:sidebar-collapsed'

/** 读折叠状态；读不到或存储不可用一律当作「展开」（与改造前的界面一致） */
export function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** 写折叠状态；存储不可用时静默放弃（表现为「刷新后回到展开」，不影响使用） */
export function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // 故意吞掉：存储是可选能力，不能因为写不进去就让侧栏折叠失败
  }
}
