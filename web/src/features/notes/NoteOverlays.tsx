import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookmarkPlus, LockKeyhole, Trash2, Check, FileText, ArrowUpRight } from 'lucide-react'
import { api } from '../../api'
import { useUi, toast } from '../../state/ui.store'
import { useChat } from '../../state/chat.store'
import { demoActions } from '../../state/demo.store'
import {
  Drawer,
  Dialog,
  Field,
  Input,
  Textarea,
  Select,
  Switch,
  Button,
  Badge,
  Notice,
  Tabs,
  Skeleton,
  CodeBlock,
  Lens,
  ErrorState,
} from '../../design/primitives'
import { useQuery } from '../../lib/useQuery'
import { SafeMarkdown } from '../../lib/markdown'
import { byteLength } from '../../lib/hash'
import { CAPS, validateTags } from '../../lib/limits'
import { chunkNote } from '../../api/demo/db'
import { formatDate } from '../../lib/time'
export function NoteOverlays() {
  const ui = useUi()
  const navigate = useNavigate()
  const [title, setTitle] = useState(''),
    [content, setContent] = useState(''),
    [source, setSource] = useState(''),
    [tags, setTags] = useState(''),
    [domain, setDomain] = useState('notes'),
    [isPrivate, setPrivate] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null),
    [tab, setTab] = useState('note'),
    [deleting, setDeleting] = useState(false),
    [typed, setTyped] = useState(''),
    [editTags, setEditTags] = useState(false),
    [newTags, setNewTags] = useState('')
  const noteQuery = useQuery(
    () => (ui.noteId ? api.getNote(ui.noteId) : Promise.resolve(null)),
    ui.noteId ?? 'none'
  )
  const note = noteQuery.data
  useEffect(() => {
    if (ui.capture !== null) {
      const raw = ui.capture
      setTitle(raw.match(/^# (.+)/)?.[1] ?? '')
      setContent(raw.replace(/^# .+\n+/, '').trim())
      setSource(ui.captureMeta ? 'Confirmed chat' : '')
      setTags('')
      setDomain('notes')
      setPrivate(ui.captureMeta?.private ?? false)
      setError(null)
    }
  }, [ui.capture, ui.captureMeta])
  useEffect(() => {
    setTab('note')
    setDeleting(false)
    setEditTags(false)
  }, [ui.noteId])
  useEffect(() => {
    if (!ui.noteSection || !note || tab !== 'note') return
    const id = ui.noteSection.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const timer = setTimeout(
      () => document.getElementById(id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      250
    )
    return () => clearTimeout(timer)
  }, [ui.noteSection, note, tab])
  async function save() {
    setError(null)
    const parsed = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    try {
      validateTags(parsed)
      if (!content.trim()) throw new Error('Add some content to capture.')
      const body = {
        content: (title.trim() ? '# ' + title.trim() + '\n\n' : '') + content,
        source: source || (ui.captureMeta ? 'Confirmed chat' : 'Manual capture'),
        tags: Array.from(new Set([...parsed, ...(domain !== 'notes' ? [domain] : [])])),
        private: isPrivate || !!ui.captureMeta?.private,
      }
      if (byteLength(body.content) > CAPS.note)
        throw new Error('413 payload_too_large · Note exceeds 256 KB.')
      setSaving(true)
      if (ui.captureMeta) {
        const sessionId = ui.captureMeta.session_id
        ui.set({ capture: null })
        const id = await useChat
          .getState()
          .send('Save a note from this answer:\n' + JSON.stringify(body), sessionId)
        if (id) navigate('/chat/' + id)
        return
      }
      const before = await api.listNotes({ limit: 100 })
      const result = await api.createNote(body)
      toast(
        before.items.some(n => n.id === result.id)
          ? 'Already captured'
          : 'Note captured · processing',
        'success'
      )
      await new Promise(resolve => setTimeout(resolve, 900))
      ui.set({ capture: null })
      if (ui.flow === 'S3') ui.completeFlow('S3')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to capture the note.')
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (!note || typed !== note.title) return
    const count = chunkNote(note).length
    try {
      await api.deleteNote(note.id)
      setDeleting(false)
      ui.set({ noteId: null })
      toast(`Note and ${count} chunks deleted`, 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Unable to delete.', 'error')
    }
  }
  return (
    <>
      <Drawer
        open={ui.capture !== null}
        onClose={() => !saving && ui.set({ capture: null })}
        title="Capture a note"
      >
        <form
          className={`stack capture-form ${saving ? 'absorbing' : ''}`}
          onSubmit={e => {
            e.preventDefault()
            void save()
          }}
        >
          <Lens endpoint="POST /notes → 202" refs="FR-1/2/4 · GR-11" milestone="Notes" />
          <p className="muted">
            Keep something worth coming back to. Ciel will make it easier to find.
          </p>
          <Field label="Title" help="Optional. A title can be drawn from the first line.">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="A thought worth keeping"
            />
          </Field>
          <Field
            label="Content"
            help="Markdown is welcome. Ciel stores URLs as text and does not fetch them."
          >
            <Textarea
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              placeholder="What would you like to remember?"
            />
          </Field>
          <div className={`byte-counter ${byteLength(content) > CAPS.note ? 'error-text' : ''}`}>
            {(byteLength(content) / 1024).toFixed(1)} / 256 KB
          </div>
          <div className="form-columns">
            <Field label="Domain">
              <Select value={domain} onChange={e => setDomain(e.target.value)}>
                {[
                  'notes',
                  'networking',
                  'security',
                  'projects',
                  'postgres',
                  'rag',
                  'llm',
                  'ops',
                  'productivity',
                ].map(d => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Input
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="e.g. Lab journal"
              />
            </Field>
          </div>
          <Field label="Tags" help="Comma-separated · up to 10 lowercase tags">
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="networking, dns"
            />
          </Field>
          {ui.captureMeta?.private ? (
            <Notice tone="private">
              This answer came from a private session. The saved note stays private.
            </Notice>
          ) : (
            <Switch
              label="Keep this note private"
              description="Embedded locally. Never summarized by a cloud model. Excluded from device briefs."
              checked={isPrivate}
              onChange={setPrivate}
            />
          )}
          {isPrivate && (
            <Notice tone="private">Private note: no cloud summary, no auto-tags.</Notice>
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="form-footer">
            <Button type="button" variant="secondary" onClick={() => ui.set({ capture: null })}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <BookmarkPlus size={17} />
              {saving ? 'Preparing…' : ui.captureMeta ? 'Review note' : 'Capture note'}
            </Button>
          </div>
        </form>
      </Drawer>
      <Drawer
        open={!!ui.noteId}
        onClose={() => ui.set({ noteId: null, noteSection: null })}
        title="Your knowledge"
      >
        {noteQuery.loading ? (
          <Skeleton />
        ) : noteQuery.error ? (
          <ErrorState message={noteQuery.error} retry={() => void noteQuery.refresh()} />
        ) : (
          note && (
            <div className="note-detail stack">
              <Lens endpoint="GET /notes/{id}" refs="FR-2 · GR-20" milestone="Notes" />
              <div>
                <div className="row wrap">
                  {note.private && (
                    <Badge tone="violet">
                      <LockKeyhole size={12} />
                      Local-only
                    </Badge>
                  )}
                  {note.origin === 'model' && (
                    <Badge tone="violet">model-written · confirmed</Badge>
                  )}
                  <Badge
                    tone={
                      note.status === 'ready' ? 'mint' : note.status === 'failed' ? 'rose' : 'gold'
                    }
                  >
                    {note.status}
                  </Badge>
                </div>
                <h1>{note.title}</h1>
                <p className="metadata">
                  {formatDate(note.created_at, 'd MMM yyyy, h:mm a')} · {note.source}
                </p>
              </div>
              <div className="note-summary">
                <h3>At a glance</h3>
                <p>{note.summary}</p>
              </div>
              <div className="row wrap">
                {editTags ? (
                  <form
                    className="row"
                    onSubmit={e => {
                      e.preventDefault()
                      try {
                        const parsed = newTags
                          .split(',')
                          .map(t => t.trim())
                          .filter(Boolean)
                        validateTags(parsed)
                        demoActions.editTags(note.id, parsed)
                        setEditTags(false)
                        toast('Tags updated in this demo', 'success')
                      } catch (error) {
                        toast(error instanceof Error ? error.message : 'Invalid tags', 'error')
                      }
                    }}
                  >
                    <Input
                      aria-label="Edit note tags"
                      value={newTags}
                      onChange={e => setNewTags(e.target.value)}
                    />
                    <Button variant="secondary" type="submit">
                      <Check size={15} />
                      Save
                    </Button>
                  </form>
                ) : (
                  <>
                    {note.tags.map(t => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                    <button
                      className="text-link"
                      onClick={() => {
                        setNewTags(note.tags.join(', '))
                        setEditTags(true)
                      }}
                    >
                      Edit tags
                    </button>
                  </>
                )}
              </div>
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: 'note', label: 'Note' },
                  { id: 'chunks', label: 'Chunks', count: chunkNote(note).length },
                  { id: 'references', label: 'Referenced in chats' },
                ]}
              />
              {tab === 'note' ? (
                <SafeMarkdown
                  text={note.content.replace(/^# .+\n*/, '')}
                  highlight={ui.noteSection ?? undefined}
                />
              ) : tab === 'chunks' ? (
                <div className="chunk-list">
                  {chunkNote(note).map(c => (
                    <section key={c.id}>
                      <div className="row between">
                        <strong>{c.heading}</strong>
                        <Badge>#{c.position + 1}</Badge>
                      </div>
                      <p>{c.content}</p>
                      <div className="metadata mono">
                        {c.token_count} estimated tokens · 768 dimensions
                      </div>
                      <div className="metadata mono">{c.embedding_model}</div>
                      <CodeBlock label="chunk id">{c.id}</CodeBlock>
                    </section>
                  ))}
                </div>
              ) : (
                <ReferenceList
                  noteId={note.id}
                  onOpen={id => {
                    ui.set({ noteId: null })
                    navigate(`/chat/${id}`)
                  }}
                />
              )}
              {note.private && (
                <Notice tone="private">
                  This note stays on this machine. Reading it in chat makes that session local-only.
                </Notice>
              )}
              <div className="danger-zone">
                <div>
                  <strong>Right to forget</strong>
                  <small>Delete this note and every indexed chunk.</small>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    setTyped('')
                    setDeleting(true)
                  }}
                >
                  <Trash2 size={15} />
                  Delete note
                </Button>
              </div>
            </div>
          )
        )}
      </Drawer>
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete this note?">
        {note && (
          <div className="stack">
            <Notice tone="error">
              This removes the note and its {chunkNote(note).length} indexed chunks.
            </Notice>
            <Field label={`Type “${note.title}” to confirm`}>
              <Input value={typed} onChange={e => setTyped(e.target.value)} autoFocus />
            </Field>
            <Button variant="danger" disabled={typed !== note.title} onClick={() => void remove()}>
              Delete note and chunks
            </Button>
          </div>
        )}
      </Dialog>
    </>
  )
}
function ReferenceList({ noteId, onOpen }: { noteId: string; onOpen: (id: string) => void }) {
  const { data, loading, error, refresh } = useQuery(async () => {
    const sessions = await api.listSessions()
    const details = await Promise.all(sessions.map(s => api.getSession(s.id)))
    return details.filter(s => s.messages.some(m => m.citations.some(c => c.note_id === noteId)))
  }, noteId)
  return loading ? (
    <Skeleton rows={2} />
  ) : error ? (
    <ErrorState message={error} retry={() => void refresh()} />
  ) : data?.length ? (
    <div className="reference-list">
      {data.map(s => (
        <button key={s.id} onClick={() => onOpen(s.id)}>
          <FileText size={16} />
          {s.title}
          <ArrowUpRight size={15} />
        </button>
      ))}
    </div>
  ) : (
    <p className="muted">No verified citation to this note yet. Ask Ciel a question about it.</p>
  )
}
