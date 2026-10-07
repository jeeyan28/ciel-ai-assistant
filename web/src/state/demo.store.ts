import { create } from 'zustand'
import { demoControl, changed } from '../api/demo/control'
import { db, resetDatabase } from '../api/demo/db'
import { useUi } from './ui.store'
import { limitGate } from '../api/demo/agent/guardrails'
type Config = typeof demoControl
export const useDemo = create<
  Config & { set: (patch: Partial<Config>) => void; reset: () => void }
>(set => ({
  ...demoControl,
  set: patch => {
    Object.assign(demoControl, patch)
    set(patch)
    changed()
  },
  reset: () => {
    resetDatabase()
    limitGate.requests = []
    Object.assign(demoControl, {
      error: null,
      injectCitation: false,
      embeddingMismatch: false,
      failPatch: false,
      notReady: false,
      providerDown: false,
      screenState: 'normal',
      publicMode: false,
    })
    set({ ...demoControl })
    useUi.getState().set({ explored: [], flow: null, noteId: null })
  },
}))
// These two presentation-only controls reveal API gaps, documented in the Build Map.
export const demoActions = {
  renameSession: (id: string, title: string) => {
    const s = db.sessions.find(s => s.id === id)
    if (s && title.trim()) {
      s.title = title.trim()
      changed()
    }
  },
  editTags: (id: string, tags: string[]) => {
    const n = db.notes.find(n => n.id === id)
    if (n) {
      n.tags = tags
      changed()
    }
  },
  expire: (id: string) => {
    const p = db.pending_confirmations.find(p => p.id === id)
    if (p) p.expires_at = 0
    changed()
  },
  modify: (id: string) => {
    const p = db.pending_confirmations.find(p => p.id === id)
    if (p) p.args = { ...p.args, content: 'Modified demo argument' }
    changed()
  },
  offline: () => {
    db.device.online = !db.device.online
    changed()
  },
}
