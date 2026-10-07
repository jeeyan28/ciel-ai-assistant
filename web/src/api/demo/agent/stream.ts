import type {
  ChatRequest,
  SseEvent,
  Message,
  ToolCall,
  Args,
  Citation,
  Session,
} from '../../contract'
import type { ScenarioId } from './matcher'
import { db } from '../db'
import { changed, demoControl } from '../control'
import { delay } from '../latency'
import { searchInDb } from '../retrieval'
import { matchScenario } from './matcher'
import { projectFromPrompt, scenarioPlan, type ToolPlan } from './scenarios'
import {
  ApiError,
  CAPS,
  createConfirmation,
  toolAllowed,
  WRITE_TOOLS,
  truncateUtf8,
} from './guardrails'
import { hashArgs, byteLength } from '../../../lib/hash'
import { verifyCitations, stripUnverified } from '../../../lib/citations'
import { DEMO_NOW, formatDate } from '../../../lib/time'

export function newMessage(session_id: string, role: Message['role'], content = ''): Message {
  return {
    id: crypto.randomUUID(),
    session_id,
    role,
    content,
    thinking: '',
    tool_calls: [],
    citations: [],
    retrieved: [],
    status: role === 'user' ? 'done' : 'streaming',
    created_at: new Date(DEMO_NOW).toISOString(),
  }
}

function createdTaskReply(args: Args) {
  const title = typeof args.title === 'string' ? args.title : 'Your task'
  const due =
    typeof args.due_at === 'string'
      ? ` It is due **${formatDate(args.due_at, "EEEE, d MMMM 'at' h:mm a")} (Asia/Manila)**.`
      : ''
  return `The task is created: **${title}**.${due} You can find it in Tasks.`
}

export async function recordTool(
  session: Session,
  turn_id: string,
  tool: string,
  args: Args
): Promise<ToolCall> {
  const metadata_only = session.local_only || WRITE_TOOLS.has(tool) || args.private === true
  const row: ToolCall = {
    id: crypto.randomUUID(),
    session_id: session.id,
    turn_id,
    tool,
    args: metadata_only
      ? { length: byteLength(JSON.stringify(args)), sha256: await hashArgs(args) }
      : structuredClone(args),
    ok: null,
    duration_ms: 0,
    summary: 'Running…',
    created_at: new Date(DEMO_NOW).toISOString(),
    private: session.local_only,
    metadata_only,
  }
  db.tool_calls.unshift(row)
  return row
}

/** Build the tool_result data object to avoid repetition. */
function toolResultData(row: ToolCall) {
  return { id: row.id, ok: !!row.ok, summary: row.summary, duration_ms: row.duration_ms }
}

/** Resolve the scenario ID from the incoming message text. */
function resolveScenario(text: string): ScenarioId {
  if (demoControl.error) return 'S14'
  if (/^(?:save|capture)\s+(?:a\s+)?note(?:\s+from\s+this\s+answer)?\s*:/i.test(text)) return 'S3'
  if (/^draft\s+(?:a\s+)?reply\s+to\s+(?:e\d+|#\d+)\b/i.test(text)) return 'S11'
  return matchScenario(text)
}

interface PendingConfirmationLike {
  id: string
  state: 'pending' | 'executed' | 'denied' | 'expired'
  tool: string
  args: Args
  result?: string
}

/** Map a confirmation state to the assistant reply text. */
function replyForConfirmation(p: PendingConfirmationLike): string {
  if (p.state === 'expired')
    return 'Notice · Confirmation expired. Nothing was written. Submit the request again when you’re ready.'
  if (p.state === 'denied') return 'Understood — I did not make the change.'
  if (p.tool === 'add_task') return createdTaskReply(p.args)
  if (p.tool === 'save_note')
    return 'Your note has been captured and is being indexed locally. It is labeled **model-written** and will appear in Notes.'
  return p.result ?? 'The approved change is complete.'
}

/** Emit the S14 error code from the message or demo control. */
function resolveErrorCode(text: string) {
  if (demoControl.error) return demoControl.error
  if (/agent_loop_limit/.test(text)) return 'agent_loop_limit' as const
  if (/tool_timeout/.test(text)) return 'tool_timeout' as const
  if (/^rate_limited/.test(text)) return 'rate_limited' as const
  return 'provider_rate_limited' as const
}

/** Build the error message and optional retry_after for each S14 code. */
function errorPath(code: ReturnType<typeof resolveErrorCode>): {
  message: string
  retry_after?: number
} {
  if (code === 'agent_loop_limit') return { message: 'Stopped after 4 tool iterations.' }
  if (code === 'tool_timeout') return { message: 'The tool exceeded its 10-second limit.' }
  if (code === 'rate_limited')
    return { message: 'Request limit reached. Try again shortly.', retry_after: 5 }
  return {
    message: 'The sample provider paused this response. Partial text is preserved.',
    retry_after: 12,
  }
}

/** Stream the assistant answer token-by-token with a timeout guard. */
async function* tokens(
  text: string,
  message: Message,
  signal: AbortSignal | undefined,
  start: number
): AsyncGenerator<SseEvent> {
  for (const token of text.match(/\S+\s*|\s+/g) ?? []) {
    if (Date.now() - start > CAPS.streamMs)
      throw new ApiError('agent_loop_limit', 'The stream reached its 120-second limit.')
    await delay(/[.!?:]\s*$/.test(token) ? 75 : 24, signal)
    message.content += token
    yield { event: 'token', data: { text: token } }
  }
}

/** Emit the S14 agent-loop-limit simulation with four search iterations. */
async function* simulateAgentLoopLimit(
  message: Message,
  session: Session,
  signal: AbortSignal | undefined
): AsyncGenerator<SseEvent> {
  for (let i = 0; i < 4; i++) {
    const row = await recordTool(session, message.id, 'search_notes', {
      query: `sample iteration ${i + 1}`,
      k: 1,
    })
    message.tool_calls.push(row)
    yield { event: 'tool_call', data: { id: row.id, tool: row.tool, args: row.args } }
    await delay(400, signal)
    row.ok = true
    row.summary = 'No new evidence'
    row.duration_ms = 400
    yield { event: 'tool_result', data: toolResultData(row) }
  }
}

/** Emit the S14 tool-timeout simulation. */
async function* simulateToolTimeout(
  message: Message,
  session: Session,
  signal: AbortSignal | undefined
): AsyncGenerator<SseEvent> {
  const row = await recordTool(session, message.id, 'search_notes', {
    query: 'timeout fixture',
    k: 5,
  })
  message.tool_calls.push(row)
  yield { event: 'tool_call', data: { id: row.id, tool: row.tool, args: row.args } }
  await delay(CAPS.toolMs, signal)
  row.ok = false
  row.error_code = 'tool_timeout'
  row.summary = 'Tool exceeded 10 seconds'
  row.duration_ms = 10000
  yield { event: 'tool_result', data: toolResultData(row) }
}

/** Extract citations from search results into the shared array. */
function collectCitations(
  results: ReturnType<typeof searchInDb> | undefined,
  citations: Citation[]
) {
  if (!results) return
  citations.push(
    ...results.results.map(({ note_id, chunk_id, heading, score }) => ({
      note_id,
      chunk_id,
      heading,
      score,
    }))
  )
}

/** Run one tool step, returning the row, search results, and blocked flag. */
async function runToolStep(
  step: ToolPlan,
  message: Message,
  session: Session,
  text: string,
  signal?: AbortSignal
): Promise<{
  row: ToolCall
  results: ReturnType<typeof searchInDb> | undefined
  blocked: boolean
}> {
  let results: ReturnType<typeof searchInDb> | undefined
  const rejection = toolAllowed(step.tool, demoControl.addOns, session.local_only)
  if (!rejection && step.tool === 'search_notes') {
    results = searchInDb({
      query: String(step.args.query),
      k: typeof step.args.k === 'number' ? step.args.k : 5,
      after: step.args.after ? String(step.args.after) : undefined,
      before: step.args.before ? String(step.args.before) : undefined,
      tags: Array.isArray(step.args.tags) ? step.args.tags.map(String) : undefined,
    })
    // Tailored citation slicing for the Tailscale search scenario.
    if (message.scenario === 'S1' && /tailscale|subnet/i.test(text)) {
      const found = results.results
      const selected = ['n01-c1', 'n01-c2', 'n18-c3'].flatMap(chunk =>
        found.filter(result => result.chunk_id === chunk)
      )
      results = {
        results: selected,
        retrieved: selected.map(({ note_id, chunk_id }) => ({ note_id, chunk_id })),
      }
    }
    if (results.results.some(c => db.notes.find(n => n.id === c.note_id)?.private))
      session.local_only = true
  }
  const row = await recordTool(session, message.id, step.tool, step.args)
  message.tool_calls.push(row)
  if (rejection) {
    row.ok = false
    row.error_code = 'forbidden'
    row.summary = rejection
    row.duration_ms = 420
    return { row, results, blocked: true }
  }
  if (step.write) {
    const p = await createConfirmation(row.id, session.id, step.tool, step.args)
    db.pending_confirmations.push(p)
    message.confirmation_id = p.id
    message.status = 'awaiting_confirm'
    row.summary = 'Awaiting confirmation'
    changed()
    return { row, results, blocked: false }
  }
  const ms = step.duration ?? 640
  await delay(ms, signal)
  row.ok = true
  row.duration_ms = ms
  if (results) {
    message.retrieved.push(...results.retrieved)
  }
  row.summary = truncateUtf8(
    step.summary ??
      (results
        ? `${results.results.length} sections found${step.args.after ? ' · Sat 3 Oct (Asia/Manila)' : ''}`
        : step.tool === 'list_tasks'
          ? `${db.tasks.filter(t => t.status !== 'done').length} open tasks`
          : 'Completed')
  )
  return { row, results, blocked: false }
}

/** Run the full tool step loop for a normal (non-continue) turn. */
async function* runToolSteps(
  plan: { tools: ToolPlan[] },
  message: Message,
  session: Session,
  context: { text: string; signal?: AbortSignal },
  citations: Citation[]
): AsyncGenerator<SseEvent> {
  const { text, signal } = context
  let blocked = false
  for (const step of plan.tools) {
    const {
      row,
      results,
      blocked: stepBlocked,
    } = await runToolStep(step, message, session, text, signal)
    yield { event: 'tool_call', data: { id: row.id, tool: row.tool, args: step.args } }
    if (stepBlocked) {
      blocked = true
      await delay(420, signal)
      yield { event: 'tool_result', data: toolResultData(row) }
      continue
    }
    if (step.write) {
      const p = db.pending_confirmations.find(c => c.id === row.id && c.state === 'pending')
      if (p) {
        yield {
          event: 'tool_confirm',
          data: {
            id: p.id,
            tool: p.tool,
            preview: p.preview,
            decision_endpoint: `/sessions/${session.id}/confirm`,
          },
        }
        yield {
          event: 'done',
          data: { session_id: session.id, status: 'awaiting_confirm', tool_call_id: p.id },
        }
      }
      return
    }
    collectCitations(results, citations)
    yield { event: 'tool_result', data: toolResultData(row) }
  }
  return blocked
}

export async function* streamTurn(
  request: ChatRequest,
  signal?: AbortSignal
): AsyncGenerator<SseEvent> {
  const start = Date.now()
  let session = db.sessions.find(s => s.id === request.session_id)
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      title: (request.message ?? 'New conversation').slice(0, 54),
      started_at: DEMO_NOW,
      last_message_at: DEMO_NOW,
      local_only: false,
    }
    db.sessions.unshift(session)
  }
  const s = session

  if (request.continue) {
    yield* resumeParkedTurn(s, start, signal)
    return
  }

  if (db.pending_confirmations.some(p => p.session_id === s.id && p.state === 'pending'))
    throw new ApiError(
      'forbidden',
      'Resolve the pending confirmation before sending another message.',
      403
    )

  const text = request.message ?? ''
  db.messages.push(newMessage(s.id, 'user', text))
  const message = newMessage(s.id, 'assistant')
  db.messages.push(message)
  s.last_message_at = DEMO_NOW

  const id = resolveScenario(text)
  message.scenario = id

  // Private projects or certain S6 prompts force local-only sessions.
  if ((id === 'S6' && !/search the web|web search/i.test(text)) || projectFromPrompt(text)?.private)
    s.local_only = true

  const plan = scenarioPlan(id, text, s)
  const citations: Citation[] = []

  // Mark session local-only if any planned tool touches private content.
  if (
    plan.tools.some(
      step =>
        step.args.private === true ||
        db.projects.some(project => project.name === step.args.project && project.private)
    )
  )
    s.local_only = true

  try {
    await delay(380, signal)
    message.thinking = plan.thinking
    yield { event: 'thinking', data: { text: plan.thinking } }

    if (id === 'S14') {
      const code = resolveErrorCode(text)
      demoControl.error = null
      yield* tokens('I started checking the requested information. ', message, signal, start)
      if (code === 'agent_loop_limit') yield* simulateAgentLoopLimit(message, s, signal)
      if (code === 'tool_timeout') yield* simulateToolTimeout(message, s, signal)
      const { message: msg, retry_after } = errorPath(code)
      throw new ApiError(code, msg, 429, retry_after)
    }

    const blocked = yield* runToolSteps(plan, message, s, { text, signal }, citations)

    await delay(200, signal)
    let answer =
      blocked && id !== 'S8' && !(id === 'S6' && /web/i.test(text))
        ? 'Notice · This tool is not available in MVP mode. Enable All add-ons in Settings to explore this scenario. Nothing was executed.'
        : plan.answer(citations)
    if (demoControl.injectCitation) {
      answer += ' This additional claim has no verified source. [[n:nonexistent#fabricated]]'
    }
    const verified = verifyCitations(citations, message.retrieved)
    const clean = stripUnverified(answer, verified)
    message.citation_removed = clean.removed
    if (clean.removed) {
      const violation = await recordTool(s, message.id, 'citation_verification', { removed: 1 })
      violation.ok = false
      violation.summary = 'Unverified citation removed (GR-19)'
      violation.error_code = 'unverified_citation'
    }
    // Never persist unverified markers. The UI waits for the citations event before numbering chips.
    yield* tokens(clean.text, message, signal, start)
    message.citations = verified
    yield { event: 'citations', data: { citations: verified } }
    message.status = 'done'
    changed()
    yield {
      event: 'done',
      data: {
        session_id: s.id,
        usage: {
          prompt_tokens: Math.ceil(text.length / 4),
          completion_tokens: Math.ceil(message.content.length / 4),
        },
        tool_calls: plan.tools.length,
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      message.status = 'stopped'
      return
    }
    const e =
      error instanceof ApiError
        ? error
        : new ApiError('not_ready', 'The demo could not finish the request.', 503)
    message.status = 'error'
    message.error = { code: e.code, message: e.message, retry_after: e.retry_after }
    yield { event: 'error', data: { error: message.error } }
  } finally {
    if (message.status === 'streaming') message.status = 'stopped'
    changed()
  }
}

/** Resume a turn whose write tool was parked awaiting confirmation. */
async function* resumeParkedTurn(
  s: Session,
  start: number,
  signal?: AbortSignal
): AsyncGenerator<SseEvent> {
  const p = [...db.pending_confirmations].reverse().find(x => x.session_id === s.id)
  const previous = [...db.messages]
    .reverse()
    .find(m => m.session_id === s.id && m.confirmation_id === p?.id)
  if (!p || !previous) throw new ApiError('forbidden', 'There is no parked turn to continue.', 403)
  const message = previous
  if (p.state === 'pending') {
    yield {
      event: 'tool_confirm',
      data: {
        id: p.id,
        tool: p.tool,
        preview: p.preview,
        decision_endpoint: `/sessions/${s.id}/confirm`,
      },
    }
    yield {
      event: 'done',
      data: { session_id: s.id, status: 'awaiting_confirm', tool_call_id: p.id },
    }
    return
  }
  message.status = 'streaming'
  const row = db.tool_calls.find(t => t.id === p.id)
  if (row) {
    row.ok = p.state === 'executed'
    row.summary = p.result ?? p.state
    row.duration_ms = 430
    yield { event: 'tool_result', data: toolResultData(row) }
  }
  const answer = replyForConfirmation(p)
  yield* tokens(answer, message, signal, start)
  message.status = 'done'
  changed()
  yield { event: 'done', data: { session_id: s.id, tool_calls: 1 } }
}
