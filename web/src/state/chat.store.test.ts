import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import type { Session, SessionDetail, SseEvent } from '../api/contract'
import { useChat } from './chat.store'
import { useUi } from './ui.store'

const session = (id: string): Session => ({
  id,
  title: id,
  started_at: '2026-10-04T01:30:00Z',
  last_message_at: '2026-10-04T01:30:00Z',
  local_only: false,
})
const detail = (id: string): SessionDetail => ({ ...session(id), messages: [] })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}
beforeEach(() => {
  useChat.getState().stop()
  useChat.setState({ current: null, error: null, confirmOpen: false })
})
afterEach(() => {
  vi.restoreAllMocks()
  useChat.getState().stop()
})

describe('chat navigation and cancellation', () => {
  it('does not restore a conversation when cancelled during session creation', async () => {
    const pending = deferred<Session>()
    vi.spyOn(api, 'createSession').mockReturnValue(pending.promise)
    const chat = vi.spyOn(api, 'chat')
    const send = useChat.getState().send('Hello')
    useChat.getState().stop()
    useChat.setState({ current: detail('next') })
    pending.resolve(session('cancelled'))
    expect(await send).toBeUndefined()
    expect(useChat.getState().current?.id).toBe('next')
    expect(chat).not.toHaveBeenCalled()
    expect(useChat.getState().busy).toBe(false)
  })
  it('keeps the newest conversation when session loads finish out of order', async () => {
    const older = deferred<SessionDetail>(),
      newer = deferred<SessionDetail>()
    vi.spyOn(api, 'getSession').mockImplementation(id =>
      id === 'older' ? older.promise : newer.promise
    )
    const first = useChat.getState().load('older'),
      second = useChat.getState().load('newer')
    newer.resolve(detail('newer'))
    await second
    older.resolve(detail('older'))
    await first
    expect(useChat.getState().current?.id).toBe('newer')
    expect(useChat.getState().loading).toBe(false)
  })
  it('ignores late stream events and cannot navigate back after stopping', async () => {
    const gate = deferred<void>()
    useChat.setState({ current: detail('old') })
    vi.spyOn(api, 'chat').mockImplementation(async function* (): AsyncGenerator<SseEvent> {
      await gate.promise
      yield { event: 'token', data: { text: 'late result' } }
    })
    const send = useChat.getState().send('Hello', 'old')
    useChat.getState().stop()
    useChat.setState({ current: detail('new') })
    gate.resolve()
    expect(await send).toBeUndefined()
    expect(useChat.getState().current).toEqual(detail('new'))
    expect(useChat.getState().busy).toBe(false)
  })
  it('resets answer provenance when opening a manual capture', () => {
    useUi.getState().set({
      capture: 'Private answer',
      captureMeta: { origin: 'model', private: true, session_id: 's' },
    })
    expect(useUi.getState().captureMeta?.private).toBe(true)
    useUi.getState().set({ capture: '' })
    expect(useUi.getState().captureMeta).toBeNull()
  })
})
