import { api } from './client'

import type { AdminIdentity, LoginResponse } from '@/types/api'

export interface LoginInput {
  username: string
  password: string
}

export interface ChangePasswordInput {
  current_password: string
  new_password: string
}

export const authApi = {
  login(input: LoginInput) {
    return api.post<LoginResponse>('/auth/admin/login', input)
  },
  me() {
    return api.get<AdminIdentity>('/auth/admin/me')
  },
  logout() {
    return api.post<void>('/auth/admin/logout')
  },
  changePassword(input: ChangePasswordInput) {
    return api.put<LoginResponse>('/auth/admin/password', input)
  },
}
