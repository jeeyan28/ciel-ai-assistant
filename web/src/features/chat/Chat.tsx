import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useOutletContext } from 'react-router-dom'
import {
  Search,
  ArrowUp,
  Plus,
  ChevronDown,
  ChevronRight,
  Mic,
  StopCircle,
  BookmarkPlus,
  ListChecks,
  ShieldCheck,
  Mail,
  ArrowUpRight,
  History,
  MessageSquare,
  PanelRight,
  Copy,
  RotateCcw,
  ThumbsUp,
  Volume2,
  LockKeyhole,
  Check,
  AlertCircle,
  FileText,
  ArrowRight,
  Clock,
  Command,
} from 'lucide-react'
import type { Session, ToolCall, Message } from '../../api/contract'
import { useChat } from '../../state/chat.store'
import { useUi, toast } from '../../state/ui.store'
import { useDemo, demoActions } from '../../state/demo.store'
import {
  Button,
  IconButton,
  Badge,
  Dialog,
  Drawer,
  Lens,
  Skeleton,
  ErrorState,
  Kbd,
  Input,
  Notice,
} from '../../design/primitives'
import { SageCore, type CoreState } from '../../design/SageCore'
import { SafeMarkdown } from '../../lib/markdown'
import { byteLength } from '../../lib/hash'
import { CAPS } from '../../lib/limits'
import { flows } from '../buildmap/catalog'
import { ConfirmCard } from './ConfirmCard'
import { ToolDetail } from './ToolDetail'
import { api } from '../../api'
const starters = [
  {
    title: 'Find something I noted',
    prompt: 'What did I note about Tailscale subnet routers?',
    icon: Search,
    sub: 'Tailscale, subnet routes, and that one fix.',
  },
  {
    title: 'Make a little room for later',
    prompt: 'Remind me to renew the TLS cert on Friday at 5pm',
    icon: Clock,
    sub: 'A reminder, with the details taken care of.',
  },
  {
    title: 'Keep a useful thought',
    prompt: "Save a note about today's DNS fix",
    icon: BookmarkPlus,
    sub: 'Turn today’s DNS fix into tomorrow’s reference.',
  },
  {
    title: 'Get a view of the week',
    prompt: "What's due this week?",
    icon: ListChecks,
    sub: 'See what needs your attention next.',
  },
  {
    title: 'Check on my code',
    prompt: 'Scan ciel-backend for secrets',
    icon: ShieldCheck,
    sub: 'A careful look at ciel-backend.',
  },
  {
    title: 'Catch up on my inbox',
    prompt: 'Any unread emails I should care about?',
    icon: Mail,
    sub: 'Just the messages worth your time.',
  },
]
export default function Chat() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { sessions } = useOutletContext<{ sessions: Session[] | null }>()
  const state = useChat(),
    ui = useUi(),
    screen = useDemo(s => s.screenState)
  const [text, setText] = useState(''),
    [history, setHistory] = useState(false),
    [context, setContext] = useState(false),
    [tool, setTool] = useState<ToolCall | null>(null),
    [editing, setEditing] = useState(false),
    [title, setTitle] = useState('')
  const end = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const audioUrl = useRef<string | null>(null)
  useEffect(() => {
    if (sessionId) void useChat.getState().load(sessionId)
    else useChat.getState().set({ current: null, error: null })
    return () => useChat.getState().stop()
  }, [sessionId])
  useEffect(() => {
    return () => {
      audio.current?.pause()
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    }
  }, [])
  const send = useCallback(
    async (value: string) => {
      if (!value.trim() || useChat.getState().busy) return
      if (byteLength(value) > CAPS.chat) {
        toast('413 payload_too_large · Message exceeds 32 KB. Save it as a note instead.', 'error')
        return
      }
      if (value === '/clear') {
        useChat.getState().set({ current: null })
        navigate('/chat')
        setText('')
        return
      }
      if (value.startsWith('/note ')) {
        useUi.getState().set({ capture: value.slice(6) })
        setText('')
        return
      }
      setText('')
      const id = await useChat.getState().send(value, sessionId)
      if (id) navigate(`/chat/${id}`, { replace: true })
    },
    [navigate, sessionId]
  )
  const typingPrompt = ui.typingPrompt
  useEffect(() => {
    if (!typingPrompt) return
    const prompt = typingPrompt
    let i = 0
    setText('')
    const timer = setInterval(() => {
      i = Math.min(i + 3, prompt.length)
      setText(prompt.slice(0, i))
      if (i === prompt.length) {
        clearInterval(timer)
        useUi.getState().set({ typingPrompt: null })
        void send(prompt)
      }
    }, 20)
    return () => clearInterval(timer)
  }, [typingPrompt, send])
  const messages = state.current?.messages ?? []
  const last = messages.at(-1)
  const pending = state.current?.pending
  const parked = pending?.state === 'pending'
  const local = state.current?.local_only
  const core: CoreState = parked
    ? 'awaiting_confirm'
    : local
      ? 'local'
      : state.busy
        ? last?.tool_calls.some(t => t.ok === null)
          ? 'tool'
          : 'thinking'
        : last?.status === 'error'
          ? 'error'
          : 'idle'
  useEffect(() => {
    const el = scroll.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 230)
      end.current?.scrollIntoView({ block: 'end', behavior: 'auto' })
  }, [last?.content, last?.tool_calls.length, parked])
  async function listen(m: Message) {
    audio.current?.pause()
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    try {
      const blob = await api.tts(m.content.slice(0, 1000))
      const url = URL.createObjectURL(blob)
      audioUrl.current = url
      audio.current = new Audio(url)
      await audio.current.play()
      toast('Playing demo audio · a local calibration tone.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Audio unavailable.', 'error')
    }
  }
  const completedFlow =
    ui.flow && ui.explored.includes(ui.flow) ? flows.find(f => f.id === ui.flow) : null
  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="row">
          <IconButton label="Show conversations" onClick={() => setHistory(true)}>
            <History size={18} />
          </IconButton>
          <span className="chat-header-divider" />
          {editing ? (
            <form
              onSubmit={e => {
                e.preventDefault()
                if (state.current) demoActions.renameSession(state.current.id, title)
                state.set({ current: state.current ? { ...state.current, title } : null })
                setEditing(false)
              }}
            >
              <Input
                aria-label="Conversation title"
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => setEditing(false)}
              />
            </form>
          ) : (
            <button
              className="session-title"
              onClick={() => {
                if (state.current) {
                  setTitle(state.current.title)
                  setEditing(true)
                } else setHistory(true)
              }}
            >
              {state.current?.title ?? 'New conversation'}
              <ChevronDown size={14} />
            </button>
          )}
        </div>
        <div className="row">
          <Badge tone={local ? 'violet' : 'neutral'}>
            {local ? (
              <>
                <LockKeyhole size={12} />
                Local · private session
              </>
            ) : (
              'Groq · demo'
            )}
          </Badge>
          <IconButton
            label="New conversation"
            onClick={() => {
              state.stop()
              state.set({ current: null })
              navigate('/chat')
            }}
          >
            <Plus size={18} />
          </IconButton>
          <IconButton label="Open workspace context" onClick={() => setContext(true)}>
            <PanelRight size={18} />
          </IconButton>
        </div>
      </header>
      <Lens endpoint="POST /chat · SSE" refs="FR-20 · GR-19" milestone="Chat" />
      {local && (
        <div className="private-session-strip">
          <LockKeyhole size={13} />
          Private content stays local for this conversation.
          <Badge tone="rose">web_search blocked</Badge>
        </div>
      )}
      <div className="chat-scroll" ref={scroll}>
        {state.loading || screen === 'loading' ? (
          <div className="conversation">
            <Skeleton rows={5} />
          </div>
        ) : state.error || screen === 'error' ? (
          <ErrorState
            message={state.error ?? 'Sample chat loading error.'}
            retry={() => {
              useDemo.getState().set({ screenState: 'normal' })
              if (sessionId) void state.load(sessionId)
            }}
          />
        ) : messages.length === 0 || screen === 'empty' ? (
          <div className="chat-welcome page-enter">
            <div className="welcome-orb">
              <span className="orb-horizon" />
              <SageCore size={108} />
            </div>
            <p className="welcome-greeting">Good morning, Kai.</p>
            <h1>What should I look into?</h1>
            <p className="welcome-description">
              Your notes, your next steps, a clearer picture.
              <br />A little help, right where you need it.
            </p>
            <div className="starter-grid">
              {starters.map((s, i) => (
                <button
                  className="starter-card"
                  key={s.title}
                  onClick={() => {
                    ui.set({ flow: flows[[0, 1, 2, 3, 8, 10][i]].id })
                    void send(s.prompt)
                  }}
                  title={s.prompt}
                >
                  <span className="starter-icon">
                    <s.icon size={20} strokeWidth={1.6} />
                  </span>
                  <span>
                    <strong>{s.title}</strong>
                    <small>{s.sub}</small>
                  </span>
                  <ArrowUpRight className="starter-arrow" size={16} />
                </button>
              ))}
            </div>
            <div className="welcome-bottom">
              <ShieldCheck size={14} />A private workspace. A little more headspace.
              <span />
              <button onClick={() => ui.set({ tour: true })}>
                Take a look around
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="conversation" aria-label="Conversation">
            <div className="conversation-date">
              Sunday, 4 October<span>Asia/Manila</span>
            </div>
            {messages.map((m, i) => (
              <article className={`message message-${m.role}`} key={m.id}>
                {m.role === 'user' ? (
                  <>
                    <div className="user-bubble">{displayPrompt(m.content)}</div>
                    <span className="message-avatar">K</span>
                  </>
                ) : (
                  <>
                    <SageCore size={30} state={i === messages.length - 1 ? core : 'idle'} />
                    <div className="assistant-body">
                      <div className="answer-eyebrow">
                        <span className="eyebrow">{m.error ? 'NOTICE' : 'ANSWER'}</span>
                        <span>Ciel</span>
                        {i === messages.length - 1 && state.busy && (
                          <span className="live-state">Analyzing</span>
                        )}
                      </div>
                      {(m.thinking || m.tool_calls.length > 0) && (
                        <div className="analysis-timeline">
                          <details>
                            <summary>
                              <span className="analysis-node" />
                              {m.status === 'streaming' ? 'Analysis in progress' : 'Analysis'}
                              <span className="faint">
                                {m.tool_calls.length} tool step
                                {m.tool_calls.length !== 1 ? 's' : ''}
                              </span>
                              <ChevronDown size={13} />
                            </summary>
                            <p>{m.thinking}</p>
                          </details>
                          {m.tool_calls.map(t => (
                            <button
                              className={`tool-step ${t.ok === false ? 'failed' : ''}`}
                              key={t.id}
                              onClick={() => setTool(t)}
                            >
                              <span className="tool-node">
                                {t.ok === null ? (
                                  <span className="running-dot" />
                                ) : t.ok ? (
                                  <Check size={12} />
                                ) : (
                                  <AlertCircle size={12} />
                                )}
                              </span>
                              <span className="tool-label">
                                {t.tool.replaceAll('_', ' ')}
                                <small>{t.summary}</small>
                              </span>
                              <span className="tool-duration">
                                {t.duration_ms > 0 ? `${t.duration_ms} ms` : '…'}
                              </span>
                              <ChevronRight size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                      <div
                        aria-live={i === messages.length - 1 ? 'polite' : 'off'}
                        aria-atomic="false"
                      >
                        <SafeMarkdown
                          text={m.content}
                          citations={m.citations}
                          streaming={m.status === 'streaming'}
                        />
                      </div>
                      {m.citation_removed && <Notice>Unverified citation removed · GR-19</Notice>}
                      {m.confirmation_id && pending?.id === m.confirmation_id && (
                        <ConfirmCard pending={pending} />
                      )}{' '}
                      {m.error && (
                        <StreamError
                          message={m}
                          retry={() => void send(messages[i - 1]?.content ?? 'Try again')}
                        />
                      )}{' '}
                      {m.status === 'stopped' && (
                        <p className="muted">Stopped. Your partial reply is preserved.</p>
                      )}
                      {m.citations.length > 0 && (
                        <div className="source-strip">
                          {m.citations.slice(0, 3).map((c, n) => (
                            <button
                              key={`${c.note_id}-${c.chunk_id}`}
                              onClick={() => ui.set({ noteId: c.note_id, noteSection: c.heading })}
                            >
                              <FileText size={13} />
                              <span>
                                {n + 1}. {c.heading}
                              </span>
                              <ArrowUpRight size={12} />
                            </button>
                          ))}
                        </div>
                      )}
                      {m.content && m.status !== 'streaming' && (
                        <div className="message-actions">
                          <IconButton
                            label="Copy answer"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(m.content)
                                .then(() => toast('Answer copied', 'success'))
                                .catch(() => {})
                            }}
                          >
                            <Copy size={14} />
                          </IconButton>
                          <IconButton
                            label="Regenerate response"
                            onClick={() =>
                              void send(messages[i - 1]?.content ?? 'Help me get started')
                            }
                          >
                            <RotateCcw size={14} />
                          </IconButton>
                          <IconButton
                            label="Save answer as note"
                            onClick={() =>
                              ui.set({
                                capture: m.content,
                                captureMeta: {
                                  origin: 'model',
                                  private: !!local,
                                  session_id: state.current?.id,
                                },
                              })
                            }
                          >
                            <BookmarkPlus size={14} />
                          </IconButton>
                          <IconButton
                            label="Helpful response"
                            onClick={() => toast('Feedback noted (demo)')}
                          >
                            <ThumbsUp size={14} />
                          </IconButton>
                          <IconButton label="Listen to demo audio" onClick={() => void listen(m)}>
                            <Volume2 size={14} />
                          </IconButton>
                          <span>Demo replay</span>
                        </div>
                      )}
                      {i === messages.length - 1 && !state.busy && !parked && (
                        <div className="suggestion-chips">
                          {(m.scenario === 'S15'
                            ? [
                                'What did I note about Tailscale?',
                                'What’s due this week?',
                                'Save a note about today’s DNS fix',
                                'Any unread emails I should care about?',
                              ]
                            : /2 dependencies|vulnerable/.test(m.content)
                              ? ['Create tasks from findings']
                              : local
                                ? ['Search the web for the router CVE']
                                : m.scenario === 'S11' || m.content.includes('unread sample')
                                  ? ['Draft a reply to #2']
                                  : m.scenario === 'S10'
                                    ? ['Write a commit message']
                                    : m.citations.length
                                      ? [
                                          'What’s due this week?',
                                          'Save a note about today’s DNS fix',
                                        ]
                                      : [
                                          'What did I note about Tailscale?',
                                          'What’s due this week?',
                                        ]
                          ).map(p => (
                            <button key={p} onClick={() => void send(p)}>
                              {p}
                              <ArrowUpRight size={12} />
                            </button>
                          ))}
                          {m.content.includes('work for the week') && (
                            <button onClick={() => navigate('/tasks')}>
                              Open Tasks
                              <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </article>
            ))}
            {completedFlow && (
              <div className="backend-explainer">
                <Code2Icon />
                <div>
                  <strong>What the backend does here</strong>
                  <p>{completedFlow.backend}</p>
                  <button onClick={() => navigate('/buildmap')}>
                    View in Build Map
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="composer-area">
        <div className={`composer ${parked ? 'composer-disabled' : ''}`}>
          <textarea
            ref={input}
            aria-label="Message Ciel"
            placeholder={
              parked
                ? 'Resolve the pending confirmation to continue'
                : 'Ask anything, or pick up where you left off…'
            }
            value={text}
            rows={2}
            disabled={parked || state.busy}
            onChange={e => {
              setText(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${Math.min(180, e.currentTarget.scrollHeight)}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send(text)
              }
            }}
          />
          {text.startsWith('/') && (
            <div className="slash-menu">
              {[
                ['/note', 'Capture a note'],
                ['/task', 'What’s due this week?'],
                ['/search', 'Search notes'],
                ['/brief', 'Desk button status'],
                ['/clear', 'Clear conversation'],
              ].map(([cmd, label]) => (
                <button
                  key={cmd}
                  onClick={() =>
                    cmd === '/note'
                      ? ui.set({ capture: '' })
                      : cmd === '/clear'
                        ? void send('/clear')
                        : setText(
                            cmd === '/task'
                              ? "What's due this week?"
                              : cmd === '/brief'
                                ? "What's the status of the desk button?"
                                : 'Search my notes for '
                          )
                  }
                >
                  <span>{cmd}</span>
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="composer-controls">
            <div className="row">
              <IconButton label="Attach text as a note" onClick={() => ui.set({ capture: text })}>
                <Plus size={19} />
              </IconButton>
              <span className="composer-separator" />
              <SageCore size={18} state={core} />
              <span className="composer-model">
                {local ? 'Ollama · local' : 'Ciel'}
                <ChevronDown size={11} />
              </span>
              {byteLength(text) > 20000 && (
                <span className={byteLength(text) > CAPS.chat ? 'error-text' : 'muted'}>
                  {(byteLength(text) / 1024).toFixed(1)} / 32 KB
                </span>
              )}
            </div>
            <div className="row">
              <IconButton
                label="Open push-to-talk voice capture"
                onClick={() => navigate('/voice')}
              >
                <Mic size={18} />
              </IconButton>
              {state.busy ? (
                <button className="send-button" onClick={state.stop} aria-label="Stop generation">
                  <StopCircle size={19} />
                </button>
              ) : (
                <button
                  className="send-button"
                  onClick={() => void send(text)}
                  disabled={!text.trim() || parked}
                  aria-label="Send message"
                >
                  <ArrowUp size={19} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="composer-footnote">
          <span>
            <LockKeyhole size={11} />
            Only in your workspace. Always in your control.
          </span>
          <span>
            <Kbd>Enter</Kbd> to send <span className="faint">·</span> <Kbd>Shift ↵</Kbd> for a new
            line
          </span>
        </div>
      </div>
      <Dialog
        open={state.confirmOpen && !!parked}
        onEscape={() => void state.decide('deny')}
        onClose={() => state.set({ confirmOpen: false })}
        title="Review Ciel’s request"
      >
        {pending && <ConfirmCard pending={pending} />}
      </Dialog>
      <Drawer open={history} onClose={() => setHistory(false)} title="Conversations">
        <Button
          onClick={() => {
            setHistory(false)
            state.set({ current: null })
            navigate('/chat')
          }}
        >
          <Plus size={16} />
          New conversation
        </Button>
        <div className="session-list">
          {sessions?.map(s => (
            <button
              key={s.id}
              onClick={() => {
                setHistory(false)
                navigate(`/chat/${s.id}`)
              }}
            >
              <MessageSquare size={17} />
              <span>
                {s.title}
                <small>Recent conversation</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </Drawer>
      <Drawer open={context} onClose={() => setContext(false)} title="Workspace context">
        <div className="context-greeting">
          <SageCore size={68} />
          <h2>A little perspective.</h2>
          <p>
            Sunday, 4 October 2026
            <br />
            9:30 AM · Asia/Manila
          </p>
        </div>
        <Notice>
          Your replay runs entirely in this tab. Notes, tasks, and audit records are connected.
        </Notice>
        <div className="context-links">
          {[
            {
              title: 'Your knowledge',
              description: '19 seeded notes, ready to connect.',
              path: '/notes',
              icon: FileText,
            },
            {
              title: 'On your horizon',
              description: 'Review today’s tasks and the week ahead.',
              path: '/tasks',
              icon: ListChecks,
            },
            {
              title: 'Your daily brief',
              description: 'A quieter way to start the day.',
              path: '/brief',
              icon: SunIcon,
            },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => {
                setContext(false)
                navigate(item.path)
              }}
            >
              <item.icon size={20} />
              <span>
                {item.title}
                <small>{item.description}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      </Drawer>
      <ToolDetail tool={tool} onClose={() => setTool(null)} />
    </div>
  )
}
function Code2Icon() {
  return <Command size={19} />
}
function SunIcon() {
  return <Clock size={20} />
}
function StreamError({ message, retry }: { message: Message; retry: () => void }) {
  const [remaining, setRemaining] = useState(message.error?.retry_after ?? 0)
  useEffect(() => {
    const t = setInterval(() => setRemaining(n => Math.max(0, n - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="stream-error">
      <Notice tone="error">
        <strong>{message.error?.code}</strong>
        <p>{message.error?.message}</p>
      </Notice>
      <Button variant="secondary" disabled={remaining > 0} onClick={retry}>
        <RotateCcw size={14} />
        {remaining ? `Retry in ${remaining}s` : 'Retry'}
      </Button>
    </div>
  )
}

function displayPrompt(text: string) {
  if (!text.startsWith('Save a note from this answer:\n')) return text
  try {
    const data: unknown = JSON.parse(text.slice('Save a note from this answer:\n'.length))
    if (data && typeof data === 'object' && 'content' in data && typeof data.content === 'string') {
      const title = data.content.split('\n')[0].replace(/^# /, '')
      return (
        'Save this answer as ' +
        ('private' in data && data.private ? 'a private note' : 'a note') +
        ': ' +
        title
      )
    }
  } catch {
    /* Older conversations remain readable if their payload is incomplete. */
  }
  return 'Save this answer as a note.'
}
