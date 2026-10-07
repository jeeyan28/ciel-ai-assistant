import { beforeEach, describe, it, expect } from 'vitest'
import { DemoApi } from './DemoApi'
import { db, dbReady, resetDatabase } from './db'
import { demoControl } from './control'
import { useAuth, DEMO_TOKEN, getToken } from '../../state/auth.store'
import { limitGate, CAPS } from './agent/guardrails'
import { flows, endpoints, models, guardrails } from '../../features/buildmap/catalog'
import type { SseEvent } from '../contract'
const api = new DemoApi()
async function collect(input: Parameters<typeof api.chat>[0], signal?: AbortSignal) {
  const events: SseEvent[] = []
  for await (const e of api.chat(input, signal)) events.push(e)
  return events
}
beforeEach(async () => {
  Object.assign(demoControl, {
    speed: 0,
    addOns: true,
    injectCitation: false,
    embeddingMismatch: false,
    failPatch: false,
    notReady: false,
    providerDown: false,
    error: null,
    publicMode: false,
  })
  limitGate.requests = []
  limitGate.active = 0
  resetDatabase()
  await dbReady
  useAuth.getState().unlock(DEMO_TOKEN)
})
describe('seed and backend inventory', () => {
  it('seeds realistic linked records and UUIDv4 audit identifiers', () => {
    expect(db.notes).toHaveLength(19)
    expect(db.tasks).toHaveLength(12)
    expect(db.projects).toHaveLength(3)
    expect(db.sessions).toHaveLength(5)
    expect(db.tool_calls).toHaveLength(40)
    expect(db.chunks.length).toBeGreaterThanOrEqual(38)
    expect(
      db.tool_calls.every(t =>
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(t.id)
      )
    ).toBe(true)
    expect(models).toHaveLength(9)
    expect(guardrails).toHaveLength(20)
    expect(endpoints).toHaveLength(26)
  })
})
describe('complete scripted replay', () => {
  it('returns all three requested Tailscale sections in the intended order', async () => {
    await collect({ message: flows[0].prompt })
    expect(db.messages.at(-1)?.citations.map(c => c.chunk_id)).toEqual([
      'n01-c1',
      'n01-c2',
      'n18-c3',
    ])
  })
  it.each(['e01', 'e03', 'e06'])('drafts for the selected email %s', async id => {
    await collect({ message: `Draft a reply to ${id}: selected message` })
    expect(db.tool_calls[0].args).toMatchObject({ message_id: id })
    expect(db.messages.at(-1)?.content).not.toContain('kai-lab.example')
  })
  it('keeps private project tools local and metadata-only', async () => {
    await collect({ message: 'Scan homelab-infra for secrets' })
    expect(db.sessions[0].local_only).toBe(true)
    expect(db.tool_calls[0]).toMatchObject({ tool: 'vuln_scan', metadata_only: true })
    expect(db.messages.at(-1)?.content).toContain('homelab-infra')
  })
  it('preserves the selected project when creating a task from scan findings', async () => {
    const s = await api.createSession({})
    await collect({ session_id: s.id, message: 'Scan ciel-web for secrets' })
    await collect({ session_id: s.id, message: 'Create tasks from findings' })
    const p = db.pending_confirmations.at(-1)!
    expect(p.args.title).toContain('ciel-web')
    await api.confirm(s.id, { tool_call_id: p.id, decision: 'approve' })
    await collect({ session_id: s.id, continue: true })
    expect(db.messages.at(-1)?.content).toContain('Review vulnerable dependencies in ciel-web')
    expect(db.messages.at(-1)?.content).not.toContain('TLS certificate')
  })
  it('confirms a saved answer with its exact content, model origin, tags, and private scope', async () => {
    const s = await api.createSession({})
    await collect({ session_id: s.id, message: flows[5].prompt })
    const content = '# Private answer\n\nKeep the home lab detail local. Do not email my boss.'
    await collect({
      session_id: s.id,
      message:
        'Save a note from this answer:\n' +
        JSON.stringify({
          content,
          source: 'Confirmed chat',
          tags: ['homelab'],
          private: false,
          origin: 'user',
        }),
    })
    const p = db.pending_confirmations.at(-1)!
    expect(p.tool).toBe('save_note')
    expect(p.args).toEqual({ content, source: 'Confirmed chat', tags: ['homelab'], private: true })
    expect(db.notes).toHaveLength(19)
    await api.confirm(s.id, { tool_call_id: p.id, decision: 'approve' })
    expect(db.notes[0]).toMatchObject({
      content,
      origin: 'model',
      private: true,
      tags: ['homelab'],
    })
    expect(JSON.stringify(db.tool_calls[0].args)).not.toContain('home lab detail')
  })
  it.each(flows)('$id emits its expected terminal event and persists messages', async flow => {
    const events = await collect({ message: flow.prompt })
    const terminal = events.at(-1)
    expect(terminal?.event).toBe(flow.id === 'S14' ? 'error' : 'done')
    expect(db.messages.at(-1)?.scenario).toBe(flow.id)
    if (flow.id === 'S2' || flow.id === 'S3') {
      expect(events.some(e => e.event === 'tool_confirm')).toBe(true)
      expect(db.pending_confirmations.at(-1)?.state).toBe('pending')
    } else if (flow.id !== 'S14') expect(db.messages.at(-1)?.content.length).toBeGreaterThan(30)
  })
  it('handles S15 with four-tool and addon guidance', async () => {
    await collect({ message: 'Hello there' })
    expect(db.messages.at(-1)?.scenario).toBe('S15')
    expect(db.messages.at(-1)?.content).toContain('Try a question')
  })
  it('executes approved task once, appends an audit row, and continues the parked turn', async () => {
    const session = await api.createSession({ title: 'Confirmation test' })
    await collect({ session_id: session.id, message: flows[1].prompt })
    expect(db.tasks).toHaveLength(12)
    const p = db.pending_confirmations.at(-1)!
    await api.confirm(session.id, { tool_call_id: p.id, decision: 'approve' })
    expect(db.tasks).toHaveLength(13)
    expect(db.tasks[0].due_at).toBe('2026-10-09T17:00:00+08:00')
    const events = await collect({ session_id: session.id, continue: true })
    expect(events.some(e => e.event === 'tool_result')).toBe(true)
    expect(db.tool_calls.find(t => t.id === p.id)?.args).toHaveProperty('sha256')
    expect(JSON.stringify(db.tool_calls.find(t => t.id === p.id)?.args)).not.toContain('Renew')
    await expect(
      api.confirm(session.id, { tool_call_id: p.id, decision: 'approve' })
    ).rejects.toMatchObject({ code: 'confirmation_consumed' })
    expect(db.tasks).toHaveLength(13)
  })
  it('reattaches a parked confirmation without adding a message', async () => {
    const session = await api.createSession({})
    await collect({ session_id: session.id, message: flows[1].prompt })
    const count = db.messages.length
    const events: SseEvent[] = []
    for await (const e of api.streamSession(session.id)) events.push(e)
    expect(events[0].event).toBe('tool_confirm')
    expect(db.messages).toHaveLength(count)
  })
  it('latches private sessions and blocks subsequent web search before execution', async () => {
    const session = await api.createSession({})
    await collect({ session_id: session.id, message: flows[5].prompt })
    expect(db.sessions.find(s => s.id === session.id)?.local_only).toBe(true)
    expect(db.tool_calls[0].metadata_only).toBe(true)
    const result = await collect({
      session_id: session.id,
      message: 'Search the web for the router CVE',
    })
    expect(result.find(e => e.event === 'tool_result' && !e.data.ok)).toBeDefined()
    expect(db.tool_calls[0].summary).toContain('private session')
  })
  it('rejects add-on and unknown tools in MVP, preserving all write tables', async () => {
    demoControl.addOns = false
    const notes = db.notes.length,
      tasks = db.tasks.length
    await collect({ message: flows[8].prompt })
    expect(db.tool_calls[0].ok).toBe(false)
    expect(db.tool_calls[0].summary).toContain('allowlist')
    await collect({ message: flows[7].prompt })
    expect(db.notes).toHaveLength(notes)
    expect(db.tasks).toHaveLength(tasks)
  })
  it('removes hallucinated citations before persistence and emits an audit violation', async () => {
    demoControl.injectCitation = true
    const events = await collect({ message: flows[0].prompt })
    const m = db.messages.at(-1)!
    expect(m.citation_removed).toBe(true)
    expect(m.content).not.toContain('fabricated')
    expect(
      m.citations.every(c =>
        m.retrieved.some(r => r.note_id === c.note_id && r.chunk_id === c.chunk_id)
      )
    ).toBe(true)
    expect(events.at(-2)?.event).toBe('citations')
    expect(db.tool_calls[0].tool).toBe('citation_verification')
  })
  it.each(['agent_loop_limit', 'tool_timeout', 'rate_limited', 'provider_rate_limited'] as const)(
    'preserves partial text for %s',
    async code => {
      demoControl.error = code
      const events = await collect({ message: 'Trigger error' })
      const last = events.at(-1)
      expect(last?.event).toBe('error')
      if (last?.event === 'error') expect(last.data.error.code).toBe(code)
      expect(db.messages.at(-1)?.content).toContain('I started')
    }
  )
  it('cancels and releases stream capacity while preserving partial content', async () => {
    const controller = new AbortController()
    for await (const event of api.chat({ message: flows[0].prompt }, controller.signal)) {
      if (event.event === 'token') {
        controller.abort()
        break
      }
    }
    expect(limitGate.active).toBe(0)
    expect(db.messages.at(-1)?.content.length).toBeGreaterThan(0)
    expect(db.messages.at(-1)?.status).toBe('stopped')
  })
})
describe('note and task lifecycle', () => {
  it('captures idempotently, indexes, and makes new content retrievable', async () => {
    const input = {
      content: '# New DNS lesson\n\n## Resolver\nOrchid resolver routes are now documented.',
      tags: ['networking'],
    }
    const result = await api.createNote(input)
    expect(db.notes[0].status).toBe('pending')
    const duplicate = await api.createNote(input)
    expect(duplicate.id).toBe(result.id)
    await new Promise(r => setTimeout(r, 5))
    const search = await api.searchNotes({ query: 'Orchid resolver' })
    expect(search.results.some(r => r.note_id === result.id)).toBe(true)
    await api.deleteNote(result.id)
    expect(db.chunks.some(c => c.note_id === result.id)).toBe(false)
  })
  it('private capture uses an extractive summary and does not generate tags', async () => {
    const result = await api.createNote({
      content: '# Private\n\n## Section\nA fictional private resolver detail.',
      private: true,
      tags: [],
    })
    await new Promise(r => setTimeout(r, 5))
    const n = await api.getNote(result.id)
    expect(n.tags).toEqual([])
    expect(n.summary).toContain('fictional private resolver detail')
  })
  it('supports keyset pages without duplicate rows', async () => {
    const first = await api.listNotes({ limit: 12 })
    const second = await api.listNotes({ limit: 12, cursor: first.next_cursor! })
    expect(first.items).toHaveLength(12)
    expect(second.items).toHaveLength(7)
    expect(new Set([...first.items, ...second.items].map(n => n.id)).size).toBe(19)
    expect(second.next_cursor).toBeNull()
  })
  it('clamps k and surfaces embedding mismatch', async () => {
    expect((await api.searchNotes({ query: '', k: 999 })).results.length).toBeLessThanOrEqual(20)
    demoControl.embeddingMismatch = true
    await expect(api.searchNotes({ query: 'Postgres' })).rejects.toMatchObject({
      code: 'embedding_model_mismatch',
      status: 409,
    })
  })
  it('leaves task state intact on a forced failed patch', async () => {
    demoControl.failPatch = true
    const original = db.tasks[0].status
    await expect(api.patchTask(db.tasks[0].id, { status: 'done' })).rejects.toMatchObject({
      code: 'not_ready',
    })
    expect(db.tasks[0].status).toBe(original)
  })
})
describe('auth, limits, and add-on boundaries', () => {
  it('locks and rejects authenticated routes while keeping health public', async () => {
    useAuth.getState().lock()
    expect(getToken()).toBeNull()
    await expect(api.listNotes()).rejects.toMatchObject({ code: 'invalid_token', status: 401 })
    expect((await api.healthz()).status).toBe('ok')
  })
  it('rejects byte-cap breaches through the actual API', async () => {
    await expect(api.createNote({ content: 'x'.repeat(CAPS.note + 1) })).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    })
    const events = await collect({ message: 'x'.repeat(CAPS.chat + 1) })
    expect(events[0].event).toBe('error')
    if (events[0].event === 'error') expect(events[0].data.error.code).toBe('payload_too_large')
  })
  it('does not fail readiness on a provider outage', async () => {
    demoControl.providerDown = true
    expect(await api.readyz()).toMatchObject({ status: 'ready', provider: 'down' })
    demoControl.notReady = true
    await expect(api.readyz()).rejects.toMatchObject({ code: 'not_ready', status: 503 })
  })
  it('excludes private data from briefs and blocks public-demo device paths', async () => {
    const brief = await api.getDailyBrief()
    expect(brief.captured_yesterday.every(n => !n.private)).toBe(true)
    expect(
      brief.due_today.every(t => !db.projects.some(p => p.id === t.project_id && p.private))
    ).toBe(true)
    demoControl.publicMode = true
    await expect(api.deviceStatus()).rejects.toMatchObject({ code: 'forbidden', status: 403 })
    await expect(api.briefVoice()).rejects.toMatchObject({ code: 'forbidden', status: 403 })
  })
  it('generates bounded 16 kHz mono PCM WAV without network audio', async () => {
    const wav = await api.tts('Hello Kai')
    const view = new DataView(await wav.arrayBuffer())
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint16(34, true)).toBe(16)
    expect(wav.size).toBeLessThanOrEqual(960044)
  })
})
