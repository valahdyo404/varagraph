import { create } from 'zustand'
import { apiClient } from '../lib/cloud/apiClient'

type AuthStore = {
  user: { id: string; email: string } | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.login(email, password)
      if (!data || !data.user) {
        set({ isLoading: false, error: 'Invalid credentials' })
        return false
      }
      set({ user: data.user, isLoading: false, error: null })
      return true
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Login failed'
      set({ isLoading: false, error: msg })
      return false
    }
  },

  register: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const data = await apiClient.register(email, password)
      if (!data || !data.user) {
        set({ isLoading: false, error: 'Registration failed' })
        return false
      }
      set({ user: data.user, isLoading: false, error: null })
      return true
    } catch (err: any) {
      const msg = err?.error?.message || err?.message || 'Registration failed'
      set({ isLoading: false, error: msg })
      return false
    }
  },

  logout: async () => {
    await apiClient.logout()
    set({ user: null, error: null })
  },

  isAuthenticated: () => {
    return get().user !== null
  },

  checkAuth: async () => {
    try {
      const data = await apiClient.me()
      if (!data || !data.user) {
        set({ user: null })
        return false
      }
      set({ user: data.user, error: null })
      return true
    } catch {
      set({ user: null })
      return false
    }
  },
}))