import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api/error'
import EntityListPage from '@/components/crud/EntityListPage.vue'
import { statusOptions, type FieldConfig } from '@/lib/crud/entity-form'
import { DEFAULT_PAGE_SIZE, type ResourceConfig } from '@/lib/crud/list-config'
import { naiveTestPlugin } from '@/test/naive'

import type { Customer } from '@/types/api'

/**
 * 页面级测试：列表加载、筛选 / 分页、抽屉表单、删除二次确认。
 *
 * Naive UI 的 `useMessage` / `useDialog` 在这里被替换成可断言的桩（应用里由
 * `main.ts` 的 Provider 提供）；抽屉会 teleport 到 body，所以断言走 DOM 查询。
 */
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  dialog: { warning: vi.fn() },
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return { ...actual, useMessage: () => mocks.message, useDialog: () => mocks.dialog }
})

enableAutoUnmount(afterEach)

const CUSTOMER: Customer = {
  id: 101,
  code: 'C-001',
  name: '华南贸易',
  level: 'important',
  status: 'active',
  phone: '13800000001',
  remark: null,
  created_at: '2026-01-05T09:30:00Z',
  updated_at: '2026-01-05T09:30:00Z',
}

const CUSTOMER_FIELDS: FieldConfig[] = [
  { key: 'code', label: '编码', type: 'text', required: true, placeholder: '请输入编码' },
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '请输入名称' },
  {
    key: 'level',
    label: '等级',
    type: 'select',
    required: true,
    options: [
      { label: '普通', value: 'normal' },
      { label: '重要', value: 'important' },
      { label: 'VIP', value: 'vip' },
    ],
  },
  { key: 'status', label: '状态', type: 'status', required: true },
  { key: 'phone', label: '电话', type: 'text' },
  { key: 'remark', label: '备注', type: 'textarea' },
]

/** 每个测试用一份全新的配置，接口绑定都是 spy，便于断言请求形状 */
function setupConfig(items: Customer[] = [CUSTOMER], fields: FieldConfig[] = CUSTOMER_FIELDS) {
  const load = vi.fn(() => Promise.resolve({ items, limit: DEFAULT_PAGE_SIZE, offset: 0 }))
  const create = vi.fn(() => Promise.resolve(CUSTOMER))
  const get = vi.fn(() => Promise.resolve(CUSTOMER))
  const update = vi.fn(() => Promise.resolve(CUSTOMER))
  const remove = vi.fn(() => Promise.resolve())

  const config: ResourceConfig<Customer> = {
    title: '客户',
    load,
    columns: [
      { key: 'code', title: '编码', width: 140 },
      { key: 'name', title: '名称', width: 180 },
    ],
    fields,
    filters: [
      { key: 'keyword', label: '关键词', type: 'text' },
      { key: 'status', label: '状态', type: 'select', options: statusOptions },
    ],
    create,
    get,
    update,
    remove,
    detailRoute: (row) => `/customers/${row.id}`,
  }

  return { config, load, create, get, update, remove }
}

async function mountPage(items?: Customer[], fields?: FieldConfig[]) {
  const spies = setupConfig(items, fields)
  const wrapper = mount(NConfigProvider, {
    global: { plugins: [naiveTestPlugin] },
    attachTo: document.body,
    slots: { default: () => h(EntityListPage, { config: spies.config }) },
  })

  await vi.waitFor(() => expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(0))
  return { wrapper, ...spies }
}

/** 页面内的按钮（表格行操作按钮也在页面模板里，只有抽屉是 teleport 的） */
function pageButton(wrapper: ReturnType<typeof mount>, name: string) {
  const target = wrapper.findAll('button').find((button) => button.text().trim() === name)
  if (!target) throw new Error(`未找到按钮：${name}`)
  return target
}

function drawerElement(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.n-drawer')
  if (!element) throw new Error('抽屉未渲染')
  return element
}

function drawerButton(name: string) {
  const target = [...drawerElement().querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === name,
  )
  if (!target) throw new Error(`未找到抽屉按钮：${name}`)
  return new DOMWrapper(target)
}

/** 按 `NFormItem` 的标签文本定位输入框（Naive UI 的 label 与 input 没有 for/id 关联） */
function drawerInput(label: string) {
  const item = [...drawerElement().querySelectorAll<HTMLElement>('.n-form-item')].find(
    (candidate) => candidate.querySelector('.n-form-item-label')?.textContent?.trim() === label,
  )
  const input = item?.querySelector('input')
  if (!input) throw new Error(`未找到抽屉输入框：${label}`)
  return new DOMWrapper(input)
}

function manyCustomers(count: number): Customer[] {
  return Array.from({ length: count }, (_, index) => ({
    ...CUSTOMER,
    id: 100 + index,
    code: `C-${String(index + 1).padStart(3, '0')}`,
  }))
}

describe('EntityListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads the first page through the config', async () => {
    const { wrapper, load } = await mountPage()

    expect(load).toHaveBeenCalledWith({ limit: DEFAULT_PAGE_SIZE, offset: 0, filters: {} })
    expect(wrapper.text()).toContain('C-001')
    expect(wrapper.text()).toContain('华南贸易')
  })

  it('submits a numeric field as a number and keeps a zero value', async () => {
    // 客户 / 联系人示例里没有数值字段，但通用字段类型支持 number，这里单独覆盖渲染与取值
    const numberFields: FieldConfig[] = [
      { key: 'code', label: '编码', type: 'text', required: true },
      { key: 'name', label: '名称', type: 'text', required: true },
      { key: 'status', label: '状态', type: 'status', required: true },
      { key: 'sort', label: '排序', type: 'number', required: true, min: 0, max: 999 },
    ]

    const { wrapper, create } = await mountPage([CUSTOMER], numberFields)

    await pageButton(wrapper, '新增').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('.n-drawer')).not.toBeNull())

    await drawerInput('编码').setValue('C-200')
    await drawerInput('名称').setValue('新客户')
    await drawerInput('排序').setValue('0')
    await drawerButton('保存').trigger('click')

    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    // 0 是合法数值：不能被当成空值丢掉，也不能变成字符串
    expect(create).toHaveBeenCalledWith({
      code: 'C-200',
      name: '新客户',
      status: 'active',
      sort: 0,
    })
  })

  it('warns about the first missing required field instead of submitting', async () => {
    const { wrapper, create } = await mountPage()

    await pageButton(wrapper, '新增').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('.n-drawer')).not.toBeNull())
    expect(drawerElement().textContent).toContain('新增客户')

    await drawerButton('保存').trigger('click')
    await flushPromises()

    expect(mocks.message.warning).toHaveBeenCalledWith('请填写编码')
    expect(create).not.toHaveBeenCalled()
  })

  it('prefills the edit drawer and submits every field, then reloads the list', async () => {
    const { wrapper, load, get, update } = await mountPage()

    await pageButton(wrapper, '编辑').trigger('click')

    // 预填：必须来自 GET /customers/:id，而不是空表单
    await vi.waitFor(() => expect(drawerInput('编码').element.value).toBe('C-001'))
    expect(get).toHaveBeenCalledWith(101)
    expect(drawerInput('名称').element.value).toBe('华南贸易')

    await drawerInput('名称').setValue('华南贸易（改）')
    await drawerButton('保存').trigger('click')

    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    // PUT 是全量替换：可选项留空必须显式发 null，漏发会被后端写成零值
    expect(update).toHaveBeenCalledWith(101, {
      code: 'C-001',
      name: '华南贸易（改）',
      level: 'important',
      status: 'active',
      phone: '13800000001',
      remark: null,
    })

    // 保存后回调：抽屉收起并重新加载列表
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(document.querySelector('.n-drawer--open')).toBeNull())
  })

  it('asks for confirmation before deleting and reloads after the server accepts', async () => {
    const { wrapper, load, remove } = await mountPage()

    await pageButton(wrapper, '删除').trigger('click')

    expect(mocks.dialog.warning).toHaveBeenCalledTimes(1)
    const dialogOptions = mocks.dialog.warning.mock.calls[0]![0]
    // 只显示 ID 不足以避免误删：确认框里要有编码与名称
    expect(dialogOptions.content).toContain('C-001')
    expect(dialogOptions.content).toContain('华南贸易')
    expect(remove).not.toHaveBeenCalled()

    await dialogOptions.onPositiveClick()

    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith(101))
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(mocks.message.success).toHaveBeenCalledWith('客户已删除')
  })

  it('shows the mapped Chinese message when the server rejects the delete', async () => {
    const { wrapper, load, remove } = await mountPage()

    remove.mockRejectedValue(
      new ApiError('customer still has contacts', {
        status: 409,
        code: 409,
        errorCode: 'CUSTOMER_HAS_CONTACTS',
        traceId: 'trace-1',
      }),
    )

    await pageButton(wrapper, '删除').trigger('click')
    await mocks.dialog.warning.mock.calls[0]![0].onPositiveClick()

    await vi.waitFor(() =>
      expect(mocks.message.error).toHaveBeenCalledWith('该客户下还有联系人，请先删除'),
    )
    // 服务端拒绝后不应重新加载列表
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('maps the filters into the query and returns to the first page', async () => {
    const { wrapper, load } = await mountPage(manyCustomers(DEFAULT_PAGE_SIZE))

    await pageButton(wrapper, '下一页').trigger('click')
    await vi.waitFor(() =>
      expect(load).toHaveBeenLastCalledWith({
        limit: DEFAULT_PAGE_SIZE,
        offset: DEFAULT_PAGE_SIZE,
        filters: {},
      }),
    )

    // 条件变化必须回到第一页，否则会拿着旧 offset 查新条件
    await wrapper.find('.filters input').setValue('华南')
    await wrapper.find('form.filters').trigger('submit')
    await vi.waitFor(() =>
      expect(load).toHaveBeenLastCalledWith({
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
        filters: { keyword: '华南' },
      }),
    )

    // 重置：清空条件并回到第一页
    await pageButton(wrapper, '重置').trigger('click')
    await vi.waitFor(() =>
      expect(load).toHaveBeenLastCalledWith({ limit: DEFAULT_PAGE_SIZE, offset: 0, filters: {} }),
    )
  })

  it('opens the detail page from the row but not from a row action button', async () => {
    const { wrapper } = await mountPage()

    await wrapper.find('tbody tr td').trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/customers/101')

    mocks.push.mockClear()
    // 点「编辑」必须打开抽屉，而不是被行点击带去详情页
    await pageButton(wrapper, '编辑').trigger('click')
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
