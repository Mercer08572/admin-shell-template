/**
 * 业务错误码 → 中文文案。
 *
 * key 是后端返回的 `error_code`，是本文件与后端之间**唯一的契约**：
 * 后端可以自由修改英文 message，只要不改错误码，这里的文案就继续生效。
 * 未命中的码回退到后端 message（见 `getErrorMessage`），不会吞掉信息。
 *
 * 新增错误码时在这里补一条即可；不补也能正常展示（回退后端原文）。
 * 模板自带的 mock（src/api/mock/handlers.ts）用的就是下面这些码，
 * 因此演示数据下也能看到中文文案——正好验证这条映射链是通的。
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // 认证与会话
  AUTH_INVALID_CREDENTIALS: '用户名或密码错误',
  AUTH_REQUIRED: '登录已过期，请重新登录',
  AUTH_SESSION_EXPIRED: '登录已过期，请重新登录',
  AUTH_CURRENT_PASSWORD_MISMATCH: '当前密码不正确',
  AUTH_PASSWORD_CHANGE_REQUIRED: '请先修改初始密码后再继续',
  AUTH_RATE_LIMITED: '登录尝试过于频繁，请稍后再试',

  // 客户（演示模块）
  CUSTOMER_NOT_FOUND: '客户不存在',
  CUSTOMER_CODE_DUPLICATE: '编码已存在，请更换后重试',
  CUSTOMER_HAS_CONTACTS: '该客户下还有联系人，请先删除',

  // 联系人（演示模块）
  CONTACT_NOT_FOUND: '联系人不存在',
  CONTACT_CODE_DUPLICATE: '编码已存在，请更换后重试',

  // 通用
  VALIDATION_FAILED: '提交的数据不合法，请检查后重试',
  MOCK_ROUTE_NOT_FOUND: 'mock 未实现该接口，请检查路径与方法',
}
