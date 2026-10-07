import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Columns3,
  List,
  CalendarDays,
  Check,
  GripVertical,
  PenLine,
  ArrowRight,
} from 'lucide-react'
import type { Task, TaskStatus } from '../../api/contract'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import { useDemo } from '../../state/demo.store'
import { toast, useUi } from '../../state/ui.store'
import {
  PageHeading,
  Button,
  Badge,
  Input,
  Select,
  Drawer,
  Field,
  Textarea,
  Switch,
  Skeleton,
  ErrorState,
  EmptyState,
  Lens,
  Notice,
} from '../../design/primitives'
import { relativeDate, formatDate, taskGroup, localInputToIso } from '../../lib/time'
let savedView: 'board' | 'list' = 'board'
export default function Tasks() {
  const query = useQuery(() => api.listTasks())
  const [params] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? ''),
    [project, setProject] = useState('all'),
    [status, setStatus] = useState('all'),
    [view, setView] = useState(savedView),
    [editing, setEditing] = useState<Task | 'new' | null>(null),
    [dragging, setDragging] = useState<string | null>(null)
  const dev = useUi(s => s.devLens),
    demo = useDemo()
  const tasks = query.data ?? []
  const filtered = tasks.filter(
    t =>
      (!search || t.title.toLowerCase().includes(search.toLowerCase())) &&
      (project === 'all' || t.project === project) &&
      (status === 'all' || t.status === status)
  )
  async function patch(task: Task, next: TaskStatus) {
    const original = tasks
    query.setData(rows => rows?.map(t => (t.id === task.id ? { ...t, status: next } : t)) ?? null)
    try {
      await api.patchTask(task.id, { status: next })
      toast(next === 'done' ? 'One less thing on your mind.' : 'Task moved.', 'success', {
        label: 'Undo',
        run: () => {
          void api.patchTask(task.id, { status: task.status }).catch(e => toast(String(e), 'error'))
        },
      })
    } catch (e) {
      query.setData(original)
      demo.set({ failPatch: false })
      toast(e instanceof Error ? e.message : 'Update failed.', 'error')
    }
  }
  const card = (task: Task) => (
    <article
      className={`task-card ${task.status === 'done' ? 'completed' : ''}`}
      draggable
      onDragStart={e => {
        setDragging(task.id)
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={() => setDragging(null)}
      key={task.id}
    >
      <div className="task-card-head">
        <button
          className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
          aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => void patch(task, task.status === 'done' ? 'todo' : 'done')}
        >
          {task.status === 'done' && <Check size={13} />}
        </button>
        <button className="task-title" onClick={() => setEditing(task)}>
          {task.title}
        </button>
        <GripVertical className="drag-handle" size={15} aria-hidden="true" />
      </div>
      <p>{task.description}</p>
      <div className="task-card-meta">
        <Badge>{task.project || 'Personal'}</Badge>
        {task.source === 'ciel' && <span className="ciel-source">created by Ciel</span>}
      </div>
      <footer>
        <span
          className={taskGroup(task.due_at, task.status) === 'Overdue' ? 'due overdue' : 'due'}
          title={
            task.due_at
              ? `${formatDate(task.due_at, 'EEE d MMM yyyy, h:mm a')} Asia/Manila`
              : 'No due date'
          }
        >
          <CalendarDays size={13} />
          {relativeDate(task.due_at)}
        </span>
        <Select
          aria-label={`Status of ${task.title}`}
          value={task.status}
          onChange={e => void patch(task, e.target.value as TaskStatus)}
        >
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </Select>
      </footer>
      {dev && <small className="task-lens">Agent update_task · confirmed write</small>}
    </article>
  )
  return (
    <div className="data-page tasks-page page-enter">
      <PageHeading
        title="A little forward motion"
        description="What matters next, with enough space to breathe."
      >
        <Button onClick={() => setEditing('new')}>
          <Plus size={17} />
          New task
        </Button>
      </PageHeading>
      <Lens endpoint="GET /tasks · PATCH /tasks/{id}" refs="FR-5/22" milestone="Tasks" />
      <div className="task-summary">
        <span>
          <strong>{tasks.filter(t => t.status !== 'done').length}</strong> open
        </span>
        <span>
          <strong>{tasks.filter(t => taskGroup(t.due_at, t.status) === 'Today').length}</strong> for
          today
        </span>
        <span className="overdue">
          <strong>{tasks.filter(t => taskGroup(t.due_at, t.status) === 'Overdue').length}</strong>{' '}
          overdue
        </span>
        <div className="segmented">
          <button
            aria-pressed={view === 'board'}
            className={view === 'board' ? 'active' : ''}
            onClick={() => {
              savedView = 'board'
              setView('board')
            }}
          >
            <Columns3 size={15} />
            Board
          </button>
          <button
            aria-pressed={view === 'list'}
            className={view === 'list' ? 'active' : ''}
            onClick={() => {
              savedView = 'list'
              setView('list')
            }}
          >
            <List size={15} />
            List
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-input">
          <Search size={16} />
          <Input
            aria-label="Search tasks"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find a task…"
          />
        </div>
        <Select
          aria-label="Project filter"
          value={project}
          onChange={e => setProject(e.target.value)}
        >
          <option value="all">All projects</option>
          {[...new Set(tasks.map(t => t.project))].filter(Boolean).map(p => (
            <option key={p}>{p}</option>
          ))}
        </Select>
        <Select
          aria-label="Task status filter"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="todo">Todo</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </Select>
      </div>
      {dev && (
        <Switch
          label="Fail next update (optimistic rollback)"
          checked={demo.failPatch}
          onChange={failPatch => demo.set({ failPatch })}
        />
      )}{' '}
      {query.loading ? (
        <Skeleton rows={6} />
      ) : query.error ? (
        <ErrorState message={query.error} retry={() => void query.refresh()} />
      ) : !filtered.length ? (
        <EmptyState
          title="A clear horizon."
          description="There are no tasks in this view. Add one, or adjust your filters."
          action="Create a task"
          onAction={() => setEditing('new')}
        />
      ) : view === 'board' ? (
        <div className="task-board">
          {(['todo', 'doing', 'done'] as const).map(column => (
            <section
              className={`board-column ${dragging ? 'drop-ready' : ''}`}
              key={column}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const task = tasks.find(t => t.id === e.dataTransfer.getData('text/plain'))
                if (task) void patch(task, column)
                setDragging(null)
              }}
            >
              <header>
                <div>
                  <i className={`column-dot ${column}`} />
                  <h2>
                    {column === 'todo' ? 'To do' : column === 'doing' ? 'In progress' : 'Done'}
                  </h2>
                  <span>{filtered.filter(t => t.status === column).length}</span>
                </div>
                <button aria-label={`Add ${column} task`} onClick={() => setEditing('new')}>
                  <Plus size={15} />
                </button>
              </header>
              <div className="board-cards">
                {filtered.filter(t => t.status === column).map(card)}
                {!filtered.some(t => t.status === column) && (
                  <p className="column-empty">Drop a task here, or use its status menu.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="task-list-view">
          {['Overdue', 'Today', 'This week', 'Later', 'Done'].map(group => {
            const rows = filtered.filter(t => taskGroup(t.due_at, t.status) === group)
            return (
              rows.length > 0 && (
                <section key={group}>
                  <h2>
                    {group}
                    <span>{rows.length}</span>
                  </h2>
                  {rows.map(task => (
                    <div className="task-list-row" key={task.id}>
                      <button
                        className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
                        aria-label={`Toggle ${task.title}`}
                        onClick={() => void patch(task, task.status === 'done' ? 'todo' : 'done')}
                      >
                        {task.status === 'done' && <Check size={13} />}
                      </button>
                      <button className="task-title" onClick={() => setEditing(task)}>
                        {task.title}
                      </button>
                      <Badge>{task.project}</Badge>
                      <span className="due">{relativeDate(task.due_at)}</span>
                      <Select
                        aria-label={`Status of ${task.title}`}
                        value={task.status}
                        onChange={e => void patch(task, e.target.value as TaskStatus)}
                      >
                        <option value="todo">Todo</option>
                        <option value="doing">Doing</option>
                        <option value="done">Done</option>
                      </Select>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => setEditing(task)}
                      >
                        <PenLine size={15} />
                      </button>
                    </div>
                  ))}
                </section>
              )
            )
          })}
        </div>
      )}
      <div className="tasks-help">
        <ArrowRight size={14} />
        Drag a card between columns, or use its status menu with your keyboard.
      </div>
      <TaskEditor
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        task={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
function TaskEditor({ task, onClose }: { task: Task | 'new' | null; onClose: () => void }) {
  const item = task && task !== 'new' ? task : null
  const [title, setTitle] = useState(item?.title ?? ''),
    [description, setDescription] = useState(item?.description ?? ''),
    [due, setDue] = useState(item?.due_at ? formatDate(item.due_at, "yyyy-MM-dd'T'HH:mm") : ''),
    [project, setProject] = useState(item?.project ?? ''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null)
  async function save() {
    setSaving(true)
    try {
      const body = { title, description, due_at: localInputToIso(due), project }
      if (item) await api.patchTask(item.id, body)
      else await api.createTask(body)
      toast(item ? 'Task updated' : 'Task created', 'success')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save task.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer open={!!task} title={item ? 'Edit task' : 'A next step'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={e => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="What needs doing?">
          <Input
            autoFocus
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Give it a clear next action"
          />
        </Field>
        <Field label="A little context">
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Any details your future self might need"
          />
        </Field>
        <Field label="Due date and time" help="Asia/Manila · optional">
          <Input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} />
        </Field>
        <Field label="Project label" help="A free-text label in Ciel Lite.">
          <Input
            value={project}
            onChange={e => setProject(e.target.value)}
            placeholder="homelab, ops, ciel…"
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form-footer">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} type="submit">
            <Check size={16} />
            {saving ? 'Saving…' : 'Save task'}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
