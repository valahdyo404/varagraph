import { create } from 'zustand'
import { apiClient } from '../lib/cloud/apiClient'

type ShareState = {
  token: string | null
  visibility: 'public' | 'private'
  loading: boolean
  error: string | null
  diagramId: string | null
  ensureToken: (diagramId: string) => Promise<void>
  setVisibility: (diagramId: string, visibility: 'public' | 'private') => Promise<void>
  reset: () => void
}

export const useShareStore = create<ShareState>((set) => ({
  token: null,
  visibility: 'private',
  loading: false,
  error: null,
  diagramId: null,

  ensureToken: async (diagramId) => {
    set({ loading: true, error: null, diagramId })
    try {
      const result = await apiClient.ensureShareToken(diagramId)
      set({
        token: result.share_token,
        visibility: (result.visibility as 'public' | 'private') ?? 'private',
        loading: false,
      })
    } catch (err: any) {
      set({ loading: false, error: err?.error?.message ?? 'Failed to create share link' })
    }
  },

  setVisibility: async (diagramId, visibility) => {
    set({ loading: true, error: null })
    try {
      const result = await apiClient.setVisibility(diagramId, visibility)
      set({
        visibility: (result.visibility as 'public' | 'private') ?? visibility,
        token: result.share_token ?? null,
        loading: false,
      })
    } catch (err: any) {
      set({ loading: false, error: err?.error?.message ?? 'Failed to update visibility' })
    }
  },

  reset: () => set({ token: null, visibility: 'private', loading: false, error: null, diagramId: null }),
}))
