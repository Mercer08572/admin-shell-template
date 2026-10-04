import { defineStore } from 'pinia'

import { authApi, type ChangePasswordInput, type LoginInput } from '@/api/auth'
import { ApiError } from '@/api/error'

import type { AdminIdentity } from '@/types/api'

type SessionState = 'unknown' | 'loading' | 'authenticated' | 'anonymous'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    admin: null as AdminIdentity | null,
    sessionState: 'unknown' as SessionState,
    sessionExpiresAt: null as string | null,
  }),
  getters: {
    isAuthenticated: (state) => state.sessionState === 'authenticated',
  },
  actions: {
    async bootstrap() {
      if (this.sessionState !== 'unknown') return

      this.sessionState = 'loading'
      try {
        this.admin = await authApi.me()
        this.sessionState = 'authenticated'
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error
        this.clearSession()
      }
    },
    async login(input: LoginInput) {
      this.sessionState = 'loading'
      try {
        const result = await authApi.login(input)
        this.admin = result.admin
        this.sessionExpiresAt = result.expires_at
        this.sessionState = 'authenticated'
      } catch (error) {
        this.clearSession()
        throw error
      }
    },
    async changePassword(input: ChangePasswordInput) {
      const result = await authApi.changePassword(input)
      this.admin = result.admin
      this.sessionExpiresAt = result.expires_at
      this.sessionState = 'authenticated'
    },
    async logout() {
      try {
        await authApi.logout()
      } finally {
        this.clearSession()
      }
    },
    clearSession() {
      this.admin = null
      this.sessionExpiresAt = null
      this.sessionState = 'anonymous'
    },
  },
})
