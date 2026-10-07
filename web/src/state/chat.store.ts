import { create } from 'zustand'
import type { SessionDetail, Message, ToolCall, Args, SseEvent } from '../api/contract'
import { api } from '../api'
import { useUi, toast } from './ui.store'
import { WRITE_TOOLS } from '../lib/limits'
import { hashArgs, byteLength } from '../lib/hash'
let controller: AbortController | null = null
let operation = 0
let loadGeneration = 0
interface ChatState {
  current: SessionDetail | null
  busy: boolean
  loading: boolean
  error: string | null
  confirmOpen: boolean
  set: (patch: Partial<ChatState>) => void
  load: (id: string) => Promise<void>
  send: (text: string, id?: string) => Promise<string | undefined>
  stop: () => void
  decide: (decision: 'approve' | 'deny') => Promise<void>
}
const fresh = (sid: string, role: Message['role'], content = ''): Message => ({
  id: crypto.randomUUID(),
  session_id: sid,
  role,
  content,
  thinking: '',
  tool_calls: [],
  citations: [],
  retrieved: [],
  status: 'streaming',
  created_at: '2026-10-04T01:30:00Z',
})
const isCurrent = (id: number, signal: AbortSignal) => operation === id && !signal.aborted
export const useChat = create<ChatState>((set, get) => ({
  current: null,
  busy: false,
  loading: false,
  error: null,
  confirmOpen: false,
  set,
  load: async id => {
    const generation = ++loadGeneration
    set({ loading: true, error: null })
    try {
      const detail = await api.getSession(id)
      if (generation !== loadGeneration) return
      set({ current: detail, confirmOpen: detail.pending?.state === 'pending' })
      if (detail.pending?.state === 'pending') {
        for await (const event of api.streamSession(id)) {
          if (generation !== loadGeneration || event.event === 'done') break
        }
      }
    } catch (e) {
      if (generation === loadGeneration)
        set({ error: e instanceof Error ? e.message : 'Could not open conversation.' })
    } finally {
      if (generation === loadGeneration) set({ loading: false })
    }
  },
  stop: () => {
    operation++
    loadGeneration++
    controller?.abort()
    controller = null
    set(s => ({
      busy: false,
      loading: false,
      confirmOpen: false,
      current: s.current
        ? {
            ...s.current,
            messages: s.current.messages.map(m =>
              m.status === 'streaming' ? { ...m, status: 'stopped' } : m
            ),
          }
        : null,
    }))
  },
  send: async (text, id) => {
    if (get().busy) return
    const run = ++operation
    loadGeneration++
    controller = new AbortController()
    const signal = controller.signal
    set({ busy: true, error: null, loading: false })
    try {
      let current = get().current
      if (!id || current?.id !== id)
        current = id
          ? await api.getSession(id)
          : { ...(await api.createSession({ title: text.slice(0, 48) })), messages: [] }
      if (!isCurrent(run, signal) || !current) return
      const sid = current.id
      const user = fresh(sid, 'user', text)
      user.status = 'done'
      const assistant = fresh(sid, 'assistant')
      set({ current: { ...current, messages: [...current.messages, user, assistant] } })
      for await (const event of api.chat({ session_id: sid, message: text }, signal)) {
        if (!isCurrent(run, signal)) break
        await consume(event, set, get, run, signal, sid)
      }
      if (!isCurrent(run, signal)) return
      const detail = await api.getSession(sid)
      if (!isCurrent(run, signal)) return
      set({ current: detail, confirmOpen: detail.pending?.state === 'pending' })
      if (detail.messages.at(-1)?.status === 'done' || detail.messages.at(-1)?.status === 'error') {
        const flow = useUi.getState().flow
        if (flow) useUi.getState().completeFlow(flow)
      }
      return sid
    } catch (e) {
      if (isCurrent(run, signal) && !(e instanceof DOMException && e.name === 'AbortError')) {
        toast(e instanceof Error ? e.message : 'Request failed.', 'error')
        set({ error: e instanceof Error ? e.message : 'Request failed.' })
      }
    } finally {
      if (operation === run) set({ busy: false })
    }
  },
  decide: async decision => {
    const c = get().current,
      p = c?.pending
    if (!c || !p || get().busy) return
    const run = ++operation
    controller = new AbortController()
    const signal = controller.signal
    set({ busy: true, confirmOpen: false })
    try {
      await api.confirm(c.id, { tool_call_id: p.id, decision })
      if (!isCurrent(run, signal)) return
      for await (const event of api.chat({ session_id: c.id, continue: true }, signal)) {
        if (!isCurrent(run, signal)) break
        await consume(event, set, get, run, signal, c.id)
      }
      if (!isCurrent(run, signal)) return
      const detail = await api.getSession(c.id)
      if (!isCurrent(run, signal)) return
      set({ current: detail })
      const flow = useUi.getState().flow
      if (flow) useUi.getState().completeFlow(flow)
    } catch (e) {
      if (isCurrent(run, signal)) {
        toast(e instanceof Error ? e.message : 'Confirmation failed.', 'error')
        try {
          const detail = await api.getSession(c.id)
          if (isCurrent(run, signal)) set({ current: detail })
        } catch {
          if (isCurrent(run, signal))
            set({ error: 'Could not reload the confirmation. Reopen this conversation.' })
        }
      }
    } finally {
      if (operation === run) set({ busy: false })
    }
  },
}))
async function consume(
  event: SseEvent,
  set: (patch: Partial<ChatState> | ((s: ChatState) => Partial<ChatState>)) => void,
  get: () => ChatState,
  run: number,
  signal: AbortSignal,
  sessionId: string
) {
  const c = get().current
  if (!c || c.id !== sessionId || !isCurrent(run, signal)) return
  const messages = [...c.messages]
  if (!messages.length) return
  const m = { ...messages[messages.length - 1] }
  let local = c.local_only
  switch (event.event) {
    case 'thinking':
      m.thinking += event.data.text
      if (event.data.text.includes('keep this session on the local provider')) local = true
      break
    case 'token':
      m.content += event.data.text
      break
    case 'tool_call': {
      const { id, tool, args } = event.data
      const meta = local || WRITE_TOOLS.has(tool)
      const safe: Args = meta
        ? { length: byteLength(JSON.stringify(args)), sha256: await hashArgs(args) }
        : args
      const t: ToolCall = {
        id,
        tool,
        args: safe,
        metadata_only: meta,
        private: local,
        session_id: c.id,
        turn_id: m.id,
        ok: null,
        summary: 'Running…',
        duration_ms: 0,
        created_at: m.created_at,
      }
      m.tool_calls = [...m.tool_calls, t]
      break
    }
    case 'tool_result':
      m.tool_calls = m.tool_calls.map(t => (t.id === event.data.id ? { ...t, ...event.data } : t))
      break
    case 'tool_confirm':
      m.confirmation_id = event.data.id
      m.status = 'awaiting_confirm'
      break
    case 'citations':
      m.citations = event.data.citations
      break
    case 'done':
      m.status = event.data.status ?? 'done'
      break
    case 'error':
      m.error = event.data.error
      m.status = 'error'
      break
  }
  if (!isCurrent(run, signal) || get().current?.id !== sessionId) return
  messages[messages.length - 1] = m
  set({ current: { ...c, local_only: local, messages } })
}
