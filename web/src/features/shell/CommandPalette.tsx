import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  FileText,
  CheckSquare,
  MessageSquare,
  Plus,
  LockKeyhole,
  ArrowUpRight,
} from 'lucide-react'
import { Dialog, Input, Kbd } from '../../design/primitives'
import { useUi } from '../../state/ui.store'
import { useAuth } from '../../state/auth.store'
import { api } from '../../api'
type Item = { id: string; label: string; type: string; run: () => void }
export function CommandPalette() {
  const open = useUi(s => s.palette),
    set = useUi(s => s.set)
  const [query, setQuery] = useState(''),
    [items, setItems] = useState<Item[]>([]),
    [index, setIndex] = useState(0)
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    let active = true
    void Promise.all([api.listNotes({ limit: 100 }), api.listTasks(), api.listSessions()])
      .then(([notes, tasks, sessions]) => {
        if (active)
          setItems([
            ...notes.items.map(n => ({
              id: n.id,
              label: n.title,
              type: 'Note',
              run: () => set({ noteId: n.id }),
            })),
            ...tasks.map(t => ({
              id: t.id,
              label: t.title,
              type: 'Task',
              run: () => navigate(`/tasks?q=${encodeURIComponent(t.title)}`),
            })),
            ...sessions.map(s => ({
              id: s.id,
              label: s.title,
              type: 'Conversation',
              run: () => navigate(`/chat/${s.id}`),
            })),
          ])
      })
      .catch(() => {
        if (active) setItems([])
      })
    return () => {
      active = false
    }
  }, [open, navigate, set])
  const actions: Item[] = [
    { id: 'new-chat', label: 'New conversation', type: 'Action', run: () => navigate('/chat') },
    { id: 'new-note', label: 'Capture a note', type: 'Action', run: () => set({ capture: '' }) },
    { id: 'lock', label: 'Lock workspace', type: 'Action', run: () => useAuth.getState().lock() },
  ]
  const filtered = [...actions, ...items]
    .filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 12)
  const run = (item: Item) => {
    set({ palette: false })
    item.run()
  }
  return (
    <Dialog open={open} onClose={() => set({ palette: false })} title="Find your way">
      <div className="palette-search">
        <Search size={20} />
        <Input
          autoFocus
          aria-label="Search notes, tasks, conversations and actions"
          placeholder="Search notes, tasks, conversations…"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setIndex(0)
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex(i => Math.min(i + 1, filtered.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex(i => Math.max(0, i - 1))
            }
            if (e.key === 'Enter' && filtered[index]) run(filtered[index])
          }}
        />
      </div>
      <div className="palette-results">
        {filtered.map((item, i) => (
          <button key={item.id} className={i === index ? 'selected' : ''} onClick={() => run(item)}>
            {item.type === 'Note' ? (
              <FileText size={18} />
            ) : item.type === 'Task' ? (
              <CheckSquare size={18} />
            ) : item.type === 'Conversation' ? (
              <MessageSquare size={18} />
            ) : item.id === 'lock' ? (
              <LockKeyhole size={18} />
            ) : (
              <Plus size={18} />
            )}
            <span>
              {item.label}
              <small>{item.type}</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        ))}
        {!filtered.length && <p className="muted pad">No matches. Try a shorter search.</p>}
      </div>
      <div className="palette-footer">
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> to navigate
        </span>
        <span>
          <Kbd>Enter</Kbd> to open
        </span>
        <span>
          <Kbd>Esc</Kbd> to close
        </span>
      </div>
    </Dialog>
  )
}
