import { create } from 'zustand'
let bearerToken: string | null = null
export const DEMO_TOKEN = 'ciel_demo_only_2026_not_a_real_secret_token'
export const getToken = () => bearerToken
export const useAuth = create<{
  unlocked: boolean
  unlock: (token: string) => boolean
  lock: () => void
}>(set => ({
  unlocked: false,
  unlock: token => {
    if (token.length < 32 || token === 'change-me') return false
    bearerToken = token
    set({ unlocked: true })
    return true
  },
  lock: () => {
    bearerToken = null
    set({ unlocked: false })
  },
}))
