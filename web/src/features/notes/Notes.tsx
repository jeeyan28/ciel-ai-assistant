import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Search,
  ArrowUpRight,
  LockKeyhole,
  FileText,
  SlidersHorizontal,
  Trash2,
  Check,
  Grid2X2,
  List,
} from 'lucide-react'
import { api } from '../../api'
import type { Note, SearchResponse } from '../../api/contract'
import { useQuery } from '../../lib/useQuery'
import { useUi, toast } from '../../state/ui.store'
import { useDemo } from '../../state/demo.store'
import {
  PageHeading,
  Button,
  Input,
  Select,
  Badge,
  Tabs,
  Skeleton,
  EmptyState,
  ErrorState,
  Field,
  Notice,
  CodeBlock,
  Switch,
  Dialog,
  Lens,
} from '../../design/primitives'
import { relativeDate } from '../../lib/time'
interface LibraryFilters {
  search: string
  tags: string[]
  origin: string
  privacy: string
  sort: string
}
async function loadLibrary(filters: LibraryFilters, limit: number, key: string) {
  // Metadata covers the demo catalog so filtering happens before the visible page is chosen.
  const catalog = await api.listNotes({ limit: 100 })
  const needle = filters.search.toLowerCase()
  const matches = catalog.items
    .filter(
      note =>
        (!needle ||
          `${note.title} ${note.summary} ${note.content}`.toLowerCase().includes(needle)) &&
        filters.tags.every(tag => note.tags.includes(tag)) &&
        (filters.origin === 'all' || note.origin === filters.origin) &&
        (filters.privacy === 'all' || note.private === (filters.privacy === 'private'))
    )
    .sort(
      (a, b) =>
        (filters.sort === 'updated'
          ? b.updated_at.localeCompare(a.updated_at)
          : b.created_at.localeCompare(a.created_at)) || a.id.localeCompare(b.id)
    )
  const visible = matches.slice(0, limit),
    remaining = new Set(visible.map(note => note.id)),
    records = new Map<string, Note>()
  let cursor: string | undefined
  // Read real keyset pages until this filtered page is complete. A match on a later
  // backing page must never look like an empty result, and every refresh replaces all pages.
  while (remaining.size) {
    const page = await api.listNotes({ limit: 12, cursor })
    for (const note of page.items) {
      if (remaining.delete(note.id)) records.set(note.id, note)
    }
    if (!page.next_cursor || page.next_cursor === cursor) break
    cursor = page.next_cursor
  }
  return {
    key,
    catalog: catalog.items,
    items: visible.flatMap(note => {
      const current = records.get(note.id)
      return current ? [current] : []
    }),
    hasMore: matches.length > limit,
  }
}
export default function Notes() {
  const ui = useUi()
  const [tab, setTab] = useState('library'),
    [search, setSearch] = useState(''),
    [queryText, setQueryText] = useState(''),
    [tags, setTags] = useState<string[]>([]),
    [origin, setOrigin] = useState('all'),
    [privacy, setPrivacy] = useState('all'),
    [sort, setSort] = useState('updated'),
    [list, setList] = useState(false),
    [selected, setSelected] = useState<string[]>([]),
    [deleting, setDeleting] = useState(false),
    [typed, setTyped] = useState('')
  const [page, setPage] = useState({ key: '', limit: 12 })
  useEffect(() => {
    const timer = setTimeout(() => setQueryText(search.trim()), 200)
    return () => clearTimeout(timer)
  }, [search])
  const filterKey = JSON.stringify([queryText, tags, origin, privacy, sort]),
    limit = page.key === filterKey ? page.limit : 12
  const queryKey = JSON.stringify([filterKey, limit])
  const query = useQuery(
    () => loadLibrary({ search: queryText, tags, origin, privacy, sort }, limit, queryKey),
    queryKey
  )
  const notes = useMemo(() => query.data?.catalog ?? [], [query.data?.catalog]),
    filtered = query.data?.key === queryKey ? query.data.items : [],
    moreLoading = query.loading || query.data?.key !== queryKey
  const domains = useMemo(
    () => Array.from(new Set(notes.flatMap(note => note.tags))).sort(),
    [notes]
  )
  useEffect(() => {
    if (!query.data) return
    const ids = new Set(query.data.catalog.map(note => note.id))
    setSelected(current => current.filter(id => ids.has(id)))
  }, [query.data])
  function more() {
    setPage({ key: filterKey, limit: limit + 12 })
  }
  async function bulkDelete() {
    try {
      for (const id of selected) await api.deleteNote(id)
      toast(`${selected.length} notes and their chunks deleted`, 'success')
      setSelected([])
      setDeleting(false)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Deletion failed.', 'error')
    }
  }
  return (
    <div className="data-page page-enter">
      <PageHeading
        title="Your knowledge"
        description="Useful thoughts, connected. Nothing worth keeping gets lost."
      >
        <Button onClick={() => ui.set({ capture: '' })}>
          <Plus size={17} />
          New note
        </Button>
      </PageHeading>
      <Lens endpoint="GET /notes · POST /notes" refs="FR-1/2/4" milestone="Notes" />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'library', label: 'Library', count: notes.length },
          { id: 'retrieval', label: 'Test retrieval' },
        ]}
      />
      {tab === 'retrieval' ? (
        <Retrieval />
      ) : (
        <>
          <div className="filter-bar">
            <div className="search-input">
              <Search size={17} />
              <Input
                aria-label="Search notes"
                placeholder="Find a thought, a fix, a detail…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select
              aria-label="Filter by origin"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
            >
              <option value="all">All origins</option>
              <option value="user">Written by you</option>
              <option value="model">Model-written</option>
            </Select>
            <Select
              aria-label="Filter privacy"
              value={privacy}
              onChange={e => setPrivacy(e.target.value)}
            >
              <option value="all">Any visibility</option>
              <option value="private">Private</option>
              <option value="public">Standard</option>
            </Select>
            <Select aria-label="Sort notes" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="updated">Recently updated</option>
              <option value="created">Recently captured</option>
            </Select>
            <button
              className="icon-button"
              aria-label={list ? 'Grid view' : 'List view'}
              onClick={() => setList(!list)}
            >
              {list ? <Grid2X2 size={18} /> : <List size={18} />}
            </button>
          </div>
          <div className="tag-filters">
            <button className={!tags.length ? 'selected' : ''} onClick={() => setTags([])}>
              All notes<span>{notes.length}</span>
            </button>
            {domains.slice(0, 9).map(t => (
              <button
                key={t}
                className={tags.includes(t) ? 'selected' : ''}
                onClick={() => setTags(a => (a.includes(t) ? a.filter(x => x !== t) : [...a, t]))}
              >
                {t}
                <span>{notes.filter(n => n.tags.includes(t)).length}</span>
              </button>
            ))}
            <Select
              aria-label="Filter by domain"
              value=""
              onChange={e => setTags(t => Array.from(new Set([...t, e.target.value])))}
            >
              <option value="" disabled>
                More domains
              </option>
              {domains.map(t => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </div>
          <div className="collection-meta">
            <span>
              {filtered.length} notes in view <span className="faint">·</span> A little more
              connected every day.
            </span>
            {selected.length > 0 && (
              <Button
                variant="danger"
                onClick={() => {
                  setTyped('')
                  setDeleting(true)
                }}
              >
                <Trash2 size={14} />
                Delete {selected.length} selected
              </Button>
            )}
          </div>
          {query.loading ? (
            <div className="note-grid">
              {[0, 1, 2, 3, 4, 5].map(n => (
                <div className="note-card" key={n}>
                  <Skeleton rows={3} />
                </div>
              ))}
            </div>
          ) : query.error ? (
            <ErrorState message={query.error} retry={() => void query.refresh()} />
          ) : !filtered.length ? (
            <EmptyState
              title="Room for a new thought."
              description="Capture a note, or clear your filters to find one you’ve already kept."
              action="Capture a note"
              onAction={() => ui.set({ capture: '' })}
            />
          ) : (
            <div className={`note-grid ${list ? 'note-list' : ''}`}>
              {filtered.map(note => (
                <article className="note-card" key={note.id}>
                  <div className="note-card-top">
                    <span className={`note-domain domain-${note.domain}`}>
                      <FileText size={18} />
                    </span>
                    <div className="row">
                      {note.private && <LockKeyhole size={14} className="private-icon" />}
                      {note.origin === 'model' && <Badge tone="violet">model-written</Badge>}
                      <input
                        type="checkbox"
                        className="note-checkbox"
                        aria-label={`Select ${note.title}`}
                        checked={selected.includes(note.id)}
                        onChange={e =>
                          setSelected(ids =>
                            e.target.checked ? [...ids, note.id] : ids.filter(id => id !== note.id)
                          )
                        }
                      />
                    </div>
                  </div>
                  <button className="note-card-body" onClick={() => ui.set({ noteId: note.id })}>
                    <h2>{note.title}</h2>
                    <p>{note.summary}</p>
                  </button>
                  <div className="note-card-tags">
                    {note.tags.slice(0, 4).map(t => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <footer>
                    <span>
                      <i className={`status-dot ${note.status}`} />
                      {note.status === 'ready'
                        ? relativeDate(note.updated_at)
                        : note.status === 'pending'
                          ? 'Absorbing…'
                          : 'Indexing failed'}
                    </span>
                    <button
                      aria-label={`Open ${note.title}`}
                      onClick={() => ui.set({ noteId: note.id })}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
          {query.data?.hasMore && (
            <div className="load-more">
              <Button variant="secondary" disabled={moreLoading} onClick={() => void more()}>
                {moreLoading ? 'Loading…' : 'Load more notes'}
              </Button>
              <small>Keyset pagination · no skipped thoughts.</small>
            </div>
          )}
          <div className="notes-footer">
            <LockKeyhole size={14} />
            Your notes stay in your workspace. Private notes stay with the local model.
          </div>
        </>
      )}
      <Dialog open={deleting} onClose={() => setDeleting(false)} title="Delete selected notes?">
        <div className="stack">
          <Notice tone="error">
            {selected.length} notes and all of their chunks will be removed.
          </Notice>
          <Field label="Type DELETE to continue">
            <Input value={typed} onChange={e => setTyped(e.target.value)} />
          </Field>
          <Button variant="danger" disabled={typed !== 'DELETE'} onClick={() => void bulkDelete()}>
            Delete selected notes
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
function Retrieval() {
  const demo = useDemo()
  const [text, setText] = useState('Tailscale subnet router'),
    [after, setAfter] = useState(''),
    [before, setBefore] = useState(''),
    [tags, setTags] = useState(''),
    [k, setK] = useState(5),
    [result, setResult] = useState<SearchResponse | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null)
  async function search() {
    setLoading(true)
    setError(null)
    try {
      setResult(
        await api.searchNotes({
          query: text,
          k,
          after: after || undefined,
          before: before || undefined,
          tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
        })
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? `${'code' in e ? String(e.code) : ''} · ${e.message}`
          : 'Search failed.'
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="retrieval-view">
      <div className="retrieval-intro">
        <SlidersHorizontal size={24} />
        <div>
          <h2>See what Ciel finds.</h2>
          <p>Inspect ranked sections and the exact set that citations may reference.</p>
        </div>
      </div>
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault()
          void search()
        }}
      >
        <div className="row">
          <Input
            aria-label="Retrieval query"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            <Search size={17} />
            Search
          </Button>
        </div>
        <div className="retrieval-filters">
          <Field label="After (inclusive)">
            <Input type="date" value={after} onChange={e => setAfter(e.target.value)} />
          </Field>
          <Field label="Before (exclusive)">
            <Input type="date" value={before} onChange={e => setBefore(e.target.value)} />
          </Field>
          <Field label="Tags">
            <Input
              placeholder="postgres, ops"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </Field>
          <Field label={`Top ${k} sections`}>
            <input
              type="range"
              min={1}
              max={20}
              value={k}
              onChange={e => setK(Number(e.target.value))}
            />
          </Field>
        </div>
        <small className="muted">
          Date filters resolve in Asia/Manila. Scores are deterministic demo samples.
        </small>
        <Switch
          label="Simulate embedding model mismatch"
          checked={demo.embeddingMismatch}
          onChange={embeddingMismatch => demo.set({ embeddingMismatch })}
        />
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? (
        <Skeleton />
      ) : (
        result && (
          <>
            <div className="collection-meta">
              {result.results.length} sections matched · verified against the retrieved set
            </div>
            <div className="retrieval-results">
              {result.results.map((r, i) => (
                <button
                  key={r.chunk_id}
                  onClick={() =>
                    useUi.getState().set({ noteId: r.note_id, noteSection: r.heading })
                  }
                >
                  <span className="result-rank">{i + 1}</span>
                  <div>
                    <h3>
                      {r.title}
                      <ArrowUpRight size={14} />
                    </h3>
                    <span className="result-heading">{r.heading}</span>
                    <p>
                      {r.chunk_text
                        .split(
                          new RegExp(
                            `(${text.split(/\W+/).filter(Boolean).join('|') || '(?!)'})`,
                            'ig'
                          )
                        )
                        .map((s, n) =>
                          text.toLowerCase().split(/\W+/).includes(s.toLowerCase()) ? (
                            <mark key={n}>{s}</mark>
                          ) : (
                            s
                          )
                        )}
                    </p>
                  </div>
                  <div className="score">
                    <span>{Math.round(r.score * 100)}%</span>
                    <progress max={1} value={r.score} />
                  </div>
                </button>
              ))}
            </div>
            {!result.results.length && (
              <EmptyState
                title="Nothing matched this search."
                description="Try a broader query or remove a date or tag filter."
              />
            )}
            <details className="retrieved-set">
              <summary>
                <Check size={15} />
                Retrieved set · citation boundary
              </summary>
              <CodeBlock>{JSON.stringify(result.retrieved, null, 2)}</CodeBlock>
            </details>
          </>
        )
      )}
    </div>
  )
}
