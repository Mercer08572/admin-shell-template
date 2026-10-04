import { api } from './client'

import type { HealthStatus } from '@/types/api'

/**
 * 服务健康检查。
 *
 * 工作台用它显示「服务是否可用」，同时充当**最小可用接口**的示例：
 * 类型在 `src/types/api.ts`，路径与方法只出现在这里，页面不拼 URL。
 * 自己的后端如果没有这个接口，删掉本文件与工作台上的服务条即可。
 */
export const healthApi = {
  get: () => api.get<HealthStatus>('/health'),
}
