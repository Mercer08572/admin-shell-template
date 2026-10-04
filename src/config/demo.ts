/**
 * 演示账号 —— 模板自带的 mock 登录用它，登录页的提示框也用它，保持单一来源。
 *
 * 真实项目接上自己的后端后，删掉这个文件和登录页的提示框即可；
 * mock 层（src/api/mock）会随之失去登录依据，正好提醒你去接真接口。
 */
export const DEMO_ACCOUNTS = [
  { id: 1, username: 'admin', password: 'admin123', label: '普通管理员' },
  { id: 2, username: 'starter', password: 'starter123', label: '首次登录强制改密' },
] as const

export type DemoAccount = (typeof DEMO_ACCOUNTS)[number]
