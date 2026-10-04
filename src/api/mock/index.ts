/**
 * mock 层的对外入口，只被 `src/api/client.ts` 动态导入：
 *
 * ```ts
 * const { mockRespond } = await import('./mock')
 * ```
 *
 * 动态导入是关键——`VITE_USE_MOCK=false` 的构建里这个模块不会被打进产物，
 * 因此生产包里不会带演示数据。除 `client.ts` 外，业务代码不要直接 import 本目录。
 */
export { mockRespond, MockApiError } from './handlers'
