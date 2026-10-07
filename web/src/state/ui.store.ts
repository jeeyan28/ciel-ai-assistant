import { create } from 'zustand'
export type ToastItem = {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string; run: () => void }
}
interface UiState {
  theme: 'light' | 'dark'
  density: 'comfortable' | 'compact'
  reducedMotion: boolean
  collapsed: boolean
  mobileMenu: boolean
  devLens: boolean
  palette: boolean
  shortcuts: boolean
  tour: boolean
  explored: string[]
  flow: string | null
  typingPrompt: string | null
  noteId: string | null
  noteSection: string | null
  capture: string | null
  captureMeta: { origin: 'model'; private: boolean; session_id?: string } | null
  toasts: ToastItem[]
  set: (patch: Partial<UiState>) => void
  toast: (message: string, tone?: ToastItem['tone'], action?: ToastItem['action']) => void
  completeFlow: (id: string) => void
}
export const useUi = create<UiState>((set, get) => ({
  theme:
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  density: 'comfortable',
  reducedMotion: false,
  collapsed: false,
  mobileMenu: false,
  devLens: false,
  palette: false,
  shortcuts: false,
  tour: false,
  explored: [],
  flow: null,
  typingPrompt: null,
  noteId: null,
  noteSection: null,
  capture: null,
  captureMeta: null,
  toasts: [],
  set: patch =>
    set({
      ...patch,
      ...('capture' in patch && !('captureMeta' in patch) ? { captureMeta: null } : {}),
    }),
  toast: (message, tone = 'info', action) => {
    const id = crypto.randomUUID()
    set(s => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4000)
  },
  completeFlow: id => {
    if (!get().explored.includes(id)) set(s => ({ explored: [...s.explored, id] }))
  },
}))
export const toast = (
  message: string,
  tone: ToastItem['tone'] = 'info',
  action?: ToastItem['action']
) => useUi.getState().toast(message, tone, action)
