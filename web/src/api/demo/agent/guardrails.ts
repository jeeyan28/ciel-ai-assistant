import type { Args, PendingConfirmation } from '../../contract'
import { byteLength, hashArgs, canonicalize } from '../../../lib/hash'
import { ApiError, CAPS, validateTags, WRITE_TOOLS } from '../../../lib/limits'
export { ApiError, CAPS, validateTags, WRITE_TOOLS }
export const MVP_TOOLS = new Set(['save_note', 'search_notes', 'add_task', 'list_tasks'])
export const ADDON_TOOLS = new Set([
  'git_context',
  'code_review',
  'commit_message',
  'dependency_scan',
  'project_status',
  'update_task',
  'vuln_scan',
  'threat_lookup',
  'web_search',
  'email_unread_summary',
  'email_draft',
  'device_status',
  'daily_brief',
  'register_project',
])
export function enforceBytes(value: string, cap: number, label = 'Content') {
  if (byteLength(value) > cap)
    throw new ApiError('payload_too_large', `${label} exceeds ${cap / 1024} KB.`, 413)
}
export function toolAllowed(tool: string, addOns: boolean, local: boolean) {
  if (tool === 'web_search' && local) return 'Blocked: private session (D8)'
  if (!MVP_TOOLS.has(tool) && !(addOns && ADDON_TOOLS.has(tool)))
    return 'Rejected: not on allowlist (GR-1). Tool not available in MVP.'
  return null
}
export async function createConfirmation(
  id: string,
  session_id: string,
  tool: string,
  args: Args,
  time = Date.now()
): Promise<PendingConfirmation> {
  return {
    id,
    session_id,
    tool,
    args: structuredClone(args),
    args_hash: await hashArgs(args),
    args_length: byteLength(JSON.stringify(args)),
    expires_at: time + 300000,
    state: 'pending',
    preview: JSON.stringify(args, null, 2),
  }
}
export async function resolveConfirmation(
  p: PendingConfirmation,
  decision: 'approve' | 'deny',
  execute: (args: Args) => Promise<string>,
  time = Date.now()
) {
  if (p.state !== 'pending')
    throw new ApiError('confirmation_consumed', 'This confirmation has already been consumed.', 409)
  if (time >= p.expires_at) {
    p.state = 'expired'
    p.result = 'confirmation expired'
    return 'expired' as const
  }
  const snapshot = structuredClone(p.args)
  if ((await hashArgs(snapshot)) !== p.args_hash || canonicalize(p.args) !== canonicalize(snapshot))
    throw new ApiError('confirmation_modified', 'The arguments changed. Nothing was executed.', 409)
  if (p.state !== 'pending')
    throw new ApiError('confirmation_consumed', 'This confirmation has already been consumed.', 409)
  // Reserve before the first execution await: parallel approval attempts cannot duplicate a write.
  p.state = decision === 'deny' ? 'denied' : 'executed'
  if (decision === 'deny') {
    p.result = 'user denied'
    return 'denied' as const
  }
  try {
    p.result = await execute(snapshot)
  } catch (error) {
    p.state = 'denied'
    p.result = 'Execution failed; confirmation consumed.'
    throw error
  }
  return 'executed' as const
}
export function truncateUtf8(text: string, limit = CAPS.toolResult) {
  const bytes = new TextEncoder().encode(text)
  if (bytes.length <= limit) return text
  return (
    new TextDecoder('utf-8', { fatal: false })
      .decode(bytes.slice(0, limit - 40))
      .replace(/\uFFFD$/, '') + '\n[Truncated to tool output limit]'
  )
}
export class LimitGate {
  requests: number[] = []
  active = 0
  request(time = Date.now()) {
    this.requests = this.requests.filter(t => time - t < 60000)
    if (this.requests.length >= CAPS.requests)
      throw new ApiError(
        'rate_limited',
        '60 requests per minute reached. Try again shortly.',
        429,
        Math.max(1, Math.ceil((60000 - (time - this.requests[0])) / 1000))
      )
    this.requests.push(time)
  }
  open() {
    if (this.active >= CAPS.streams)
      throw new ApiError('rate_limited', '3 concurrent streams are already open.', 429, 2)
    this.active++
  }
  close() {
    this.active = Math.max(0, this.active - 1)
  }
}
export const limitGate = new LimitGate()
