/**
 * 列表页的共享状态机：加载 / 错误、（新增|编辑）抽屉开关、删除二次确认、保存后重载。
 *
 * 每个资源页只保留自己的模板与配置，下面这套流程完全一致，且含三条不变量：
 * - 删除必须先二次确认（只给 ID 不足以避免误删，确认框里要给出编码与名称）；
 * - 同一时刻只允许一个写请求，避免重复提交；
 * - `PUT` 的全量替换载荷只由 `EntityFormDrawer` 构造。
 * 复制多份必然漂移，因此集中在这里。
 */

import { ref } from 'vue'
import { useDialog, useMessage } from 'naive-ui'

import { getErrorDetail, getErrorMessage, type ErrorDetail } from '@/api/error'

import type { Ref } from 'vue'
import type { BaseEntity } from '@/types/api'

export interface UseEntityListOptions<T extends BaseEntity> {
  /** 资源名，用于提示文案（如「客户已删除」） */
  title: string
  /**
   * 加载当前列表。
   *
   * 分页与筛选条件由调用方的闭包捕获（列表页持有 `offset` 与筛选值），
   * 状态机只关心「加载 → 结果 / 错误」这一段，因此不感知查询参数的形状。
   */
  load: () => Promise<{ items: T[] }>
  remove: (id: number) => Promise<unknown>
}

/** 列表页的共享状态机；返回的 ref 可直接在 `<script setup>` 模板中使用 */
export function useEntityList<T extends BaseEntity>(options: UseEntityListOptions<T>) {
  /**
   * 列表行。
   *
   * 断言成 `Ref<T[]>`：`ref<T[]>` 推断出的是 `Ref<UnwrapRef<T[]>>`，
   * 泛型参数 `T` 无法从 `UnwrapRef<T>` 还原，赋值与读取都要靠这里的收敛。
   */
  const rows = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const errorDetail = ref<ErrorDetail | null>(null)
  const busyId = ref<number | null>(null)
  const drawerOpen = ref(false)
  const drawerMode = ref<'create' | 'edit'>('create')
  const editingId = ref<number | null>(null)
  const message = useMessage()
  const dialog = useDialog()

  /** 加载当前条件下的列表；失败时必须保留错误详情（含 `traceId`）供页面展示与排障 */
  async function reload() {
    loading.value = true
    errorDetail.value = null
    try {
      const result = await options.load()
      rows.value = result.items
    } catch (error) {
      rows.value = []
      errorDetail.value = getErrorDetail(error)
    } finally {
      loading.value = false
    }
  }

  function openCreate() {
    drawerMode.value = 'create'
    editingId.value = null
    drawerOpen.value = true
  }

  function openEdit(row: T) {
    drawerMode.value = 'edit'
    editingId.value = row.id
    drawerOpen.value = true
  }

  /** 抽屉保存成功：收起抽屉并重新加载当前页（列表要能看到自己的改动） */
  async function onSaved() {
    drawerOpen.value = false
    await reload()
  }

  /** 二次确认：只显示 ID 不足以避免误删，确认框里必须给出编码与名称 */
  function confirmDelete(row: T) {
    dialog.warning({
      title: `删除${options.title}`,
      content: `确认删除「${rowLabel(row)}」吗？删除后不可恢复。`,
      positiveText: '确认删除',
      negativeText: '取消',
      onPositiveClick: () => deleteRow(row),
    })
  }

  async function deleteRow(row: T) {
    // 同一时刻只允许一个写请求
    if (busyId.value !== null) return

    busyId.value = row.id
    try {
      await options.remove(row.id)
      message.success(`${options.title}已删除`)
      await reload()
    } catch (error) {
      // 服务端拒绝（如「该客户下还有联系人」）也要给出可读文案，而不是静默失败
      message.error(getErrorMessage(error))
    } finally {
      busyId.value = null
    }
  }

  return {
    rows,
    loading,
    errorDetail,
    busyId,
    drawerOpen,
    drawerMode,
    editingId,
    reload,
    openCreate,
    openEdit,
    onSaved,
    confirmDelete,
  }
}

/**
 * 契约没有总数（见 `ListResult`），只能用「本页是否满页」推断是否还有下一页。
 *
 * 满页时可能恰好是最后一页，点「下一页」会得到空列表——这是已知近似，
 * 好过为了显示总页数去额外发一次请求或让后端改契约。
 */
export function hasNextPage(itemCount: number, pageSize: number): boolean {
  return itemCount >= pageSize
}

function rowLabel(row: BaseEntity) {
  return `${row.code ?? ''} ${row.name ?? ''}`.trim()
}
