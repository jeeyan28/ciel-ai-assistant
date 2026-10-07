import type { CielApi } from '../client'
import type {
  NoteInput,
  Note,
  NoteListQuery,
  SearchQuery,
  TaskInput,
  TaskPatch,
  TaskStatus,
  ProjectInput,
  ChatRequest,
  Args,
  SseEvent,
} from '../contract'
import { db, dbReady, chunkNote, backgroundTimers } from './db'
import { changed, demoControl } from './control'
import { getToken } from '../../state/auth.store'
import { delay } from './latency'
import {
  ApiError,
  CAPS,
  enforceBytes,
  validateTags,
  resolveConfirmation,
  limitGate,
} from './agent/guardrails'
import { streamTurn } from './agent/stream'
import { searchInDb } from './retrieval'
import { sha256 } from '../../lib/hash'
import { DEMO_NOW, formatDate } from '../../lib/time'

export const SAMPLE_TRANSCRIPT =
  'Naayos na ang DNS. The resolver was pointing to the old gateway address. Add a healthcheck and test it from the IoT VLAN.'
const copy = <T>(v: T): T => structuredClone(v)
async function gate(body?: unknown, device = false) {
  if (!getToken()) throw new ApiError('invalid_token', 'Unlock Ciel to continue.', 401)
  if (device && demoControl.publicMode)
    throw new ApiError(
      'forbidden',
      'Device endpoints are disabled in public demo mode (GR-16).',
      403
    )
  if (body) enforceBytes(JSON.stringify(body), CAPS.json, 'JSON body')
  limitGate.request()
  await dbReady
  await delay(150)
}
function required<T>(value: T | undefined, name: string): T {
  if (!value) throw new ApiError('forbidden', `${name} no longer exists.`, 403)
  return value
}
async function insertNote(body: NoteInput, origin: 'user' | 'model' = 'user', key?: string) {
  enforceBytes(body.content, CAPS.note, 'Note')
  validateTags(body.tags ?? [])
  if (!body.content.trim())
    throw new ApiError('forbidden', 'Add some note content before saving.', 403)
  const fingerprint = key ?? (await sha256(`${body.private ?? false}:${body.content}`))
  const duplicate =
    db.idempotency.get(fingerprint) ??
    db.notes.find(n => n.content === body.content && n.private === !!body.private)?.id
  if (duplicate) return { id: duplicate, status: 'pending' as const }
  const title = body.content.match(/^#\s+(.+)/)?.[1] ?? body.content.split('\n')[0].slice(0, 68)
  const note: Note = {
    id: crypto.randomUUID(),
    title,
    content: body.content,
    summary: 'Preparing your note…',
    tags: body.tags ?? [],
    source: body.source ?? 'Manual capture',
    private: !!body.private,
    origin,
    confirmed: true,
    status: 'pending',
    created_at: DEMO_NOW,
    updated_at: DEMO_NOW,
    domain: body.tags?.[0] ?? 'notes',
  }
  db.notes.unshift(note)
  db.idempotency.set(fingerprint, note.id)
  changed()
  const timer = setTimeout(() => {
    backgroundTimers.delete(timer)
    if (!db.notes.includes(note)) return
    note.status = body.content.includes('[demo:ingestion-failed]') ? 'failed' : 'ready'
    note.summary = body.content
      .replace(/^#{1,6}\s+.*$/gm, '')
      .trim()
      .replace(/\n/g, ' ')
      .slice(0, 190)
    if (!note.private) {
      const generated = /dns|network|router/i.test(body.content)
        ? ['networking', 'reference']
        : /postgres|database/i.test(body.content)
          ? ['postgres', 'ops']
          : ['notes', 'reference']
      note.tags = Array.from(new Set([...note.tags, ...generated])).slice(0, 5)
    }
    db.chunks.push(...chunkNote(note))
    changed()
  }, 1800 * demoControl.speed)
  backgroundTimers.add(timer)
  return { id: note.id, status: 'pending' as const }
}
function insertTask(body: TaskInput, source: 'manual' | 'ciel' = 'manual') {
  if (!body.title.trim()) throw new ApiError('forbidden', 'A task needs a title.', 403)
  const task = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description ?? '',
    due_at: body.due_at ?? null,
    project_id: body.project_id ?? null,
    project: body.project ?? db.projects.find(p => p.id === body.project_id)?.name ?? '',
    status: 'todo' as const,
    source,
    created_at: DEMO_NOW,
  }
  db.tasks.unshift(task)
  changed()
  return copy(task)
}
async function execute(tool: string, args: Args) {
  if (tool === 'save_note') {
    const result = await insertNote(
      {
        content: String(args.content),
        source: String(args.source ?? 'Confirmed chat'),
        tags: args.tags as string[] | undefined,
        private: args.private === true,
      },
      'model'
    )
    return `Note ${result.id} captured · processing`
  }
  if (tool === 'add_task') {
    const t = insertTask(
      {
        title: String(args.title),
        description: args.description ? String(args.description) : undefined,
        due_at: args.due_at ? String(args.due_at) : null,
        project: String(args.project ?? ''),
      },
      'ciel'
    )
    return `Task created: ${t.title}`
  }
  if (tool === 'update_task') {
    const t = required(
      db.tasks.find(t => t.id === args.task_id),
      'Task'
    )
    if (args.status && ['todo', 'doing', 'done'].includes(String(args.status)))
      t.status = args.status as TaskStatus
    changed()
    return `Updated ${t.title}`
  }
  throw new ApiError('forbidden', 'No registered write handler.', 403)
}
export function demoWave(text: string) {
  const rate = 16000,
    duration = Math.min(30, Math.max(3, text.length / 22)),
    samples = Math.round(rate * duration)
  const buffer = new ArrayBuffer(44 + samples * 2),
    view = new DataView(buffer)
  const put = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  put(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  put(8, 'WAVE')
  put(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  put(36, 'data')
  view.setUint32(40, samples * 2, true)
  for (let i = 0; i < samples; i++) {
    const t = i / rate,
      envelope =
        Math.max(0, Math.sin((t * Math.PI * 2) / 3)) * 0.04 * Math.min(1, t * 4, (duration - t) * 4)
    view.setInt16(44 + i * 2, Math.sin(t * 2 * Math.PI * 220) * envelope * 32767, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
export class DemoApi implements CielApi {
  async *chat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<SseEvent> {
    let opened = false
    try {
      await gate(request)
      enforceBytes(request.message ?? '', CAPS.chat, 'Chat message')
      limitGate.open()
      opened = true
      yield* streamTurn(request, signal)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      const err =
        e instanceof ApiError ? e : new ApiError('not_ready', 'The demo request failed.', 503)
      yield {
        event: 'error',
        data: { error: { code: err.code, message: err.message, retry_after: err.retry_after } },
      }
    } finally {
      if (opened) limitGate.close()
    }
  }
  async listSessions() {
    await gate()
    return copy([...db.sessions].sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)))
  }
  async createSession(body: { title?: string }) {
    await gate(body)
    const session = {
      id: crypto.randomUUID(),
      title: body.title ?? 'New conversation',
      started_at: DEMO_NOW,
      last_message_at: DEMO_NOW,
      local_only: false,
    }
    db.sessions.unshift(session)
    changed()
    return copy(session)
  }
  async getSession(id: string) {
    await gate()
    const s = required(
      db.sessions.find(s => s.id === id),
      'Conversation'
    )
    return copy({
      ...s,
      messages: db.messages.filter(m => m.session_id === id),
      pending: [...db.pending_confirmations].reverse().find(p => p.session_id === id),
    })
  }
  async *streamSession(id: string, signal?: AbortSignal): AsyncIterable<SseEvent> {
    await gate()
    const pending = [...db.pending_confirmations]
      .reverse()
      .find(p => p.session_id === id && p.state === 'pending')
    if (pending) {
      yield* this.chat({ session_id: id, continue: true }, signal)
    } else {
      yield { event: 'done', data: { session_id: id } }
    }
  }
  async confirm(sessionId: string, body: { tool_call_id: string; decision: 'approve' | 'deny' }) {
    await gate(body)
    const p = required(
      db.pending_confirmations.find(p => p.id === body.tool_call_id && p.session_id === sessionId),
      'Confirmation'
    )
    const status = await resolveConfirmation(p, body.decision, args => execute(p.tool, args))
    const row = db.tool_calls.find(t => t.id === p.id)
    if (row) {
      row.ok = status === 'executed'
      row.summary = p.result ?? status
    }
    changed()
    return { status }
  }
  async createNote(body: NoteInput, key?: string) {
    await gate(body)
    return insertNote(body, 'user', key)
  }
  async getNote(id: string) {
    await gate()
    return copy(
      required(
        db.notes.find(n => n.id === id),
        'Note'
      )
    )
  }
  async deleteNote(id: string) {
    await gate()
    db.notes = db.notes.filter(n => n.id !== id)
    db.chunks = db.chunks.filter(c => c.note_id !== id)
    for (const [key, value] of db.idempotency) if (value === id) db.idempotency.delete(key)
    changed()
  }
  async listNotes(query: NoteListQuery = {}) {
    await gate()
    let notes = [...db.notes].sort(
      (a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id)
    )
    if (query.q)
      notes = notes.filter(n =>
        `${n.title} ${n.content}`.toLowerCase().includes(query.q!.toLowerCase())
      )
    if (query.tag) notes = notes.filter(n => n.tags.includes(query.tag!))
    if (query.cursor) {
      const i = notes.findIndex(n => n.id === query.cursor)
      notes = i < 0 ? [] : notes.slice(i + 1)
    }
    const items = notes.slice(0, Math.max(1, Math.min(100, query.limit ?? 20)))
    return copy({
      items,
      next_cursor: notes.length > items.length ? (items.at(-1)?.id ?? null) : null,
    })
  }
  async searchNotes(query: SearchQuery) {
    await gate(query)
    return copy(searchInDb(query))
  }
  async listTasks(query: { status?: TaskStatus; project_id?: string } = {}) {
    await gate()
    return copy(
      db.tasks.filter(
        t =>
          (!query.status || t.status === query.status) &&
          (!query.project_id || t.project_id === query.project_id)
      )
    )
  }
  async createTask(body: TaskInput) {
    await gate(body)
    return insertTask(body)
  }
  async patchTask(id: string, body: TaskPatch) {
    await gate(body)
    if (demoControl.failPatch) {
      demoControl.failPatch = false
      throw new ApiError(
        'not_ready',
        'Task update failed. The previous state has been restored.',
        503
      )
    }
    const task = required(
      db.tasks.find(t => t.id === id),
      'Task'
    )
    Object.assign(task, body)
    changed()
    return copy(task)
  }
  async listProjects() {
    await gate()
    return copy(db.projects)
  }
  async registerProject(body: ProjectInput) {
    await gate(body)
    const roots = [
      '/data/projects/ciel-backend',
      '/data/projects/ciel-web',
      '/data/projects/homelab-infra',
      '/data/projects/sandbox',
    ]
    if (!roots.includes(body.path) || body.path.includes('..'))
      throw new ApiError(
        'forbidden',
        'Choose an existing demo directory under /data/projects/: ciel-backend, ciel-web, homelab-infra, or sandbox.',
        403
      )
    if (db.projects.some(p => p.path === body.path))
      throw new ApiError('forbidden', 'That directory is already registered.', 403)
    const p = {
      ...body,
      private: !!body.private,
      id: crypto.randomUUID(),
      last_scan: 'Not scanned yet',
      created_at: DEMO_NOW,
    }
    db.projects.push(p)
    changed()
    return copy(p)
  }
  async deleteProject(id: string) {
    await gate()
    db.projects = db.projects.filter(p => p.id !== id)
    changed()
  }
  async getDailyBrief() {
    await gate()
    return copy({
      captured_yesterday: db.notes.filter(
        n =>
          !n.private &&
          n.status === 'ready' &&
          formatDate(n.created_at, 'yyyy-MM-dd') === '2026-10-03'
      ),
      due_today: db.tasks.filter(
        t =>
          t.status !== 'done' &&
          t.due_at &&
          formatDate(t.due_at, 'yyyy-MM-dd') === '2026-10-04' &&
          !db.projects.some(p => p.private && p.id === t.project_id)
      ),
      reflection:
        'A little maintenance creates a lot of breathing room. Check the nightly backup, make space for your weekly review, and leave the restore rehearsal for Tuesday. Your knowledge is taking shape, one useful note at a time.',
      generated_at: DEMO_NOW,
    })
  }
  async transcribe(_audio: Blob, options: { save_as_note: boolean }) {
    await gate()
    await delay(1000)
    if (options.save_as_note) {
      const note = await insertNote({
        content: `# Voice capture\n\n${SAMPLE_TRANSCRIPT}`,
        source: 'Voice · demo',
      })
      return { transcript: SAMPLE_TRANSCRIPT, note_id: note.id }
    }
    return { transcript: SAMPLE_TRANSCRIPT }
  }
  async tts(text: string) {
    await gate()
    if (text.length > CAPS.tts)
      throw new ApiError('payload_too_large', 'TTS text is capped at 1,000 characters.', 413)
    return demoWave(text)
  }
  async briefVoice() {
    await gate(undefined, true)
    return demoWave('Daily brief. '.repeat(55))
  }
  async deviceHeartbeat(body: { device_id: string }) {
    await gate(body, true)
    db.device.device_id = body.device_id
    db.device.last_heartbeat = DEMO_NOW
    db.device.online = true
    changed()
    return { last_heartbeat: DEMO_NOW }
  }
  async deviceStatus() {
    await gate(undefined, true)
    return copy(db.device)
  }
  async auditToolCalls(query: { from?: string; to?: string; tool?: string } = {}) {
    await gate()
    return copy(
      db.tool_calls.filter(
        t =>
          (!query.tool || t.tool === query.tool) &&
          (!query.from || formatDate(t.created_at, 'yyyy-MM-dd') >= query.from) &&
          (!query.to || formatDate(t.created_at, 'yyyy-MM-dd') <= query.to)
      )
    )
  }
  async healthz() {
    await delay(120)
    return { status: 'ok' as const }
  }
  async readyz() {
    await delay(160)
    if (demoControl.notReady)
      throw new ApiError(
        'not_ready',
        'Postgres is unavailable. Provider status does not gate readiness.',
        503
      )
    return {
      status: 'ready' as const,
      postgres: true,
      embedder: true,
      embedding_model: 'nomic-embed-text-v1.5',
      provider: demoControl.providerDown ? ('down' as const) : ('up' as const),
    }
  }
}
