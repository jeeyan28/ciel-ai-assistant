import type { SearchQuery, SearchResponse } from '../contract'
import { db } from './db'
import { formatDate } from '../../lib/time'
import { demoControl } from './control'
import { ApiError, CAPS } from './agent/guardrails'
export function searchInDb(query: SearchQuery): SearchResponse {
  if (demoControl.embeddingMismatch)
    throw new ApiError(
      'embedding_model_mismatch',
      'Query model differs from nomic-embed-text-v1.5. Re-embed with the pinned model.',
      409
    )
  const k = Math.max(1, Math.min(CAPS.k, Math.floor(query.k ?? 5)))
  const terms = query.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      t =>
        t.length > 2 &&
        ![
          'what',
          'did',
          'about',
          'the',
          'for',
          'and',
          'note',
          'notes',
          'search',
          'capture',
          'yesterday',
        ].includes(t)
    )
  const ranked = db.chunks
    .flatMap(chunk => {
      const note = db.notes.find(n => n.id === chunk.note_id)
      if (!note || note.status !== 'ready') return []
      const date = formatDate(note.created_at, 'yyyy-MM-dd')
      if (
        (query.after && date < query.after) ||
        (query.before && date >= query.before) ||
        (query.tags?.length && !query.tags.every(t => note.tags.includes(t)))
      )
        return []
      const haystack =
        `${note.title} ${chunk.heading} ${chunk.content} ${note.tags.join(' ')}`.toLowerCase()
      let matches = terms.reduce((sum, t) => sum + (haystack.includes(t) ? 1 : 0), 0)
      if (!terms.length) matches = 1
      if (!matches) return []
      let score = Math.min(
        0.96,
        0.48 + (matches / Math.max(terms.length, 1)) * 0.36 + (chunk.position === 0 ? 0.03 : 0)
      )
      if (/tailscale|subnet/.test(query.query.toLowerCase())) {
        if (chunk.id === 'n01-c1') score = 0.96
        if (chunk.id === 'n01-c2') score = 0.92
        if (chunk.id === 'n18-c3') score = 0.89
      }
      return [
        {
          note_id: note.id,
          chunk_id: chunk.id,
          heading: chunk.heading,
          score,
          title: note.title,
          summary: note.summary,
          chunk_text: chunk.content,
          origin: note.origin,
        },
      ]
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
  return {
    results: ranked,
    retrieved: ranked.map(({ note_id, chunk_id }) => ({ note_id, chunk_id })),
  }
}
