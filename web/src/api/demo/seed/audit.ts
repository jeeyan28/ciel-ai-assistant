import type { ToolCall, Args } from '../../contract'
import { hashArgs, byteLength } from '../../../lib/hash'
export async function seedAudit(): Promise<ToolCall[]> {
  return Promise.all(
    Array.from({ length: 40 }, async (_, i) => {
      const tool = [
        'search_notes',
        'list_tasks',
        'save_note',
        'git_context',
        'add_task',
        'dependency_scan',
        'search_notes',
        'code_review',
      ][i % 8]
      const privateCall = i % 13 === 0
      const meta = privateCall || tool === 'save_note' || tool === 'add_task'
      const args: Args =
        tool === 'search_notes'
          ? { query: privateCall ? 'Synthetic private query' : 'Tailscale setup', k: 5 }
          : tool === 'save_note'
            ? { content: 'Fictional approved maintenance note' }
            : tool === 'add_task'
              ? { title: 'Review backup result' }
              : { project: 'ciel-backend' }
      return {
        id: crypto.randomUUID(),
        session_id: `s0${(i % 5) + 1}`,
        turn_id: crypto.randomUUID(),
        tool,
        args: meta
          ? { length: byteLength(JSON.stringify(args)), sha256: await hashArgs(args) }
          : args,
        ok: i !== 11 && i !== 27,
        error_code: i === 11 || i === 27 ? 'tool_timeout' : undefined,
        duration_ms: 230 + ((i * 137) % 1870),
        summary:
          i === 11 || i === 27
            ? 'Tool exceeded the time limit'
            : tool === 'search_notes'
              ? '3 notes found'
              : 'Completed',
        created_at: new Date(Date.parse('2026-10-04T01:15:00Z') - i * 8 * 3600000).toISOString(),
        private: privateCall,
        metadata_only: meta,
      }
    })
  )
}
