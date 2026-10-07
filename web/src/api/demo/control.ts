import type { ErrorCode } from '../contract'
export const demoControl = {
  addOns: true,
  injectCitation: false,
  embeddingMismatch: false,
  failPatch: false,
  notReady: false,
  providerDown: false,
  provider: 'Groq',
  error: null as ErrorCode | null,
  speed: 1,
  screenState: 'normal' as 'normal' | 'loading' | 'empty' | 'error',
  publicMode: false,
}
const listeners = new Set<() => void>()
export const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export const changed = () => {
  listeners.forEach(fn => fn())
}
