/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 接口前缀；开发时 Vite 会把该前缀代理到 VITE_API_PROXY_TARGET */
  readonly VITE_API_BASE_URL?: string
  /** VITE_USE_MOCK=false 时代理目标（自己的后端地址） */
  readonly VITE_API_PROXY_TARGET?: string
  /** 'true' 时所有接口走进程内 mock（见 src/api/mock），不需要后端 */
  readonly VITE_USE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
