import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AsyncState from './AsyncState.vue'

function mountState(props: Record<string, unknown>) {
  return mount(AsyncState, {
    props,
    slots: { default: '<p data-test="content">内容</p>' },
  })
}

describe('AsyncState', () => {
  it('renders the default slot in the success state', () => {
    const wrapper = mountState({})

    expect(wrapper.find('[data-test="content"]').exists()).toBe(true)
    expect(wrapper.attributes('data-state')).toBe('success')
  })

  it('renders the loading state while loading', () => {
    const wrapper = mountState({ loading: true })

    expect(wrapper.attributes('data-state')).toBe('loading')
    expect(wrapper.find('.async-state__loading').exists()).toBe(true)
    expect(wrapper.find('[data-test="content"]').exists()).toBe(false)
  })

  it('renders the empty state with the configured text', () => {
    const wrapper = mountState({ empty: true, emptyText: '暂无数据' })

    expect(wrapper.attributes('data-state')).toBe('empty')
    expect(wrapper.text()).toContain('暂无数据')
  })

  it('shows the error, its trace id and a retry entry', async () => {
    const wrapper = mountState({ error: '请求失败 (500)', errorTraceId: 'trace-abc' })

    expect(wrapper.attributes('data-state')).toBe('error')
    expect(wrapper.text()).toContain('请求失败 (500)')
    expect(wrapper.text()).toContain('trace-abc')

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('prioritises error over loading and empty', () => {
    const wrapper = mountState({ loading: true, empty: true, error: '服务不可用' })

    expect(wrapper.attributes('data-state')).toBe('error')
    expect(wrapper.text()).toContain('服务不可用')
  })

  it('omits the trace id row when no trace id is given', () => {
    const wrapper = mountState({ error: '请求失败 (500)' })

    expect(wrapper.find('.async-state__trace').exists()).toBe(false)
  })
})
