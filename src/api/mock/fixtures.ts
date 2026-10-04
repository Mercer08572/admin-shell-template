import { DEMO_ACCOUNTS } from '@/config/demo'

import type { AdminIdentity, Contact, Customer } from '@/types/api'

/**
 * mock 的种子数据与内存数据库。
 *
 * 规则：
 * - 数据只存在内存里，页面刷新即回到初始状态（演示用不到持久化）；
 * - 写操作（新增/编辑/删除）真的会改这份数据，因此列表页刷新后能看到自己的改动；
 * - 会话是**例外**：它记在 `sessionStorage`（只存用户名，不存口令、更不是 token），
 *   这样刷新页面不会把演示者踢回登录页；关闭标签页即失效。
 */

export interface MockAdminAccount {
  username: string
  password: string
  identity: AdminIdentity
}

/** 演示账号来自 `src/config/demo.ts`（登录页提示框用同一份来源，避免文案漂移） */
export const ADMIN_ACCOUNTS: readonly MockAdminAccount[] = DEMO_ACCOUNTS.map((account) => ({
  username: account.username,
  password: account.password,
  identity: {
    id: account.id,
    username: account.username,
    // 第二个账号固定要求改密：用来演示「强制改密」守卫分支
    must_change_password: account.username === 'starter',
  },
}))

const SEED_CUSTOMERS: readonly Customer[] = [
  customer(101, 'C-001', '华南贸易', 'important', 'active', '13800000001', '合作 3 年'),
  customer(102, 'C-002', '北方机械', 'vip', 'active', '13800000002', null),
  customer(103, 'C-003', '东海物流', 'normal', 'active', '13800000003', null),
  customer(104, 'C-004', '西湖电子', 'important', 'active', '13800000004', '账期 60 天'),
  customer(105, 'C-005', '长江建材', 'normal', 'inactive', '13800000005', '已停止合作'),
  customer(106, 'C-006', '黄河化工', 'vip', 'active', '13800000006', null),
  customer(107, 'C-007', '岭南食品', 'normal', 'active', '13800000007', null),
  customer(108, 'C-008', '云贵矿冶', 'important', 'active', '13800000008', null),
  customer(109, 'C-009', '齐鲁纺织', 'normal', 'inactive', '13800000009', null),
  customer(110, 'C-010', '三晋能源', 'vip', 'active', '13800000010', '战略客户'),
  customer(111, 'C-011', '巴蜀汽车', 'normal', 'active', '13800000011', null),
  customer(112, 'C-012', '关东重工', 'important', 'active', '13800000012', null),
]

const SEED_CONTACTS: readonly Contact[] = [
  contact(201, 101, 'CT-001', '王经理', 'decision_maker', '13900000001'),
  contact(202, 101, 'CT-002', '李助理', 'user', '13900000002'),
  contact(203, 103, 'CT-003', '赵主管', 'user', '13900000003'),
]

function customer(
  id: number,
  code: string,
  name: string,
  level: Customer['level'],
  status: Customer['status'],
  phone: string,
  remark: string | null,
): Customer {
  return {
    id,
    code,
    name,
    level,
    status,
    phone,
    remark,
    created_at: '2026-01-05T09:30:00Z',
    updated_at: '2026-01-05T09:30:00Z',
  }
}

function contact(
  id: number,
  customerId: number,
  code: string,
  name: string,
  role: Contact['role'],
  phone: string,
): Contact {
  return {
    id,
    customer_id: customerId,
    code,
    name,
    role,
    phone,
    remark: null,
    status: 'active',
    created_at: '2026-01-06T10:00:00Z',
    updated_at: '2026-01-06T10:00:00Z',
  }
}

export interface MockDb {
  customers: Customer[]
  contacts: Contact[]
  /** 下一个可用 id：与后端自增主键的行为对齐，避免前端伪造 id */
  nextId: number
}

/** 每个页面加载一份全新数据：刷新即回到种子状态 */
export function createDb(): MockDb {
  const maxId = [...SEED_CUSTOMERS, ...SEED_CONTACTS].reduce((max, row) => Math.max(max, row.id), 0)
  return {
    customers: SEED_CUSTOMERS.map((row) => ({ ...row })),
    contacts: SEED_CONTACTS.map((row) => ({ ...row })),
    nextId: maxId + 1,
  }
}

const SESSION_KEY = 'admin-shell-template:mock-session'

/** mock 会话：只存用户名。真实项目里会话是 HttpOnly Cookie，前端碰不到。 */
export function readSessionUsername(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export function writeSessionUsername(username: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, username)
  } catch {
    // 隐私模式下 sessionStorage 可能不可写：mock 会话退化为「刷新即登出」，不影响功能
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // 同上
  }
}
