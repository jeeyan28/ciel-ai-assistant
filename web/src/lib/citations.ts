import type { Citation, Retrieved } from '../api/contract'
export const citationKey = (c: Retrieved) => `${c.note_id}#${c.chunk_id}`
export function verifyCitations(citations: Citation[], retrieved: Retrieved[]) {
  const set = new Set(retrieved.map(citationKey))
  return citations.filter(c => set.has(citationKey(c)))
}
export function stripUnverified(
  text: string,
  verified: Citation[]
): { text: string; removed: boolean } {
  const set = new Set(verified.map(citationKey))
  let removed = false
  return {
    text: text.replace(
      /\[\[n:([^\]#]+)#([^\]]+)\]\]/g,
      (marker: string, note_id: string, chunk_id: string) => {
        if (set.has(citationKey({ note_id, chunk_id }))) return marker
        removed = true
        return ''
      }
    ),
    get removed() {
      return removed
    },
  }
}
