import type {
  Note,
  Chunk,
  Task,
  Project,
  Session,
  Message,
  ToolCall,
  PendingConfirmation,
  DeviceStatus,
} from '../contract'
import { seedNotes } from './seed/notes'
import { seedTasks } from './seed/tasks'
import { seedProjects } from './seed/projects'
import { seedSessions } from './seed/sessions'
import { seedAudit } from './seed/audit'
import { changed } from './control'
import { DEMO_NOW } from '../../lib/time'
export function chunkNote(note: Note): Chunk[] {
  const parts = note.content.split(/^## /m).slice(1)
  return (parts.length ? parts : [`Overview\n${note.content}`]).map((part, i) => {
    const [heading, ...body] = part.split('\n')
    const content = body.join('\n').trim()
    return {
      id: `${note.id}-c${i + 1}`,
      note_id: note.id,
      heading,
      content,
      position: i,
      token_count: Math.ceil(content.length / 4),
      embedding_model: 'nomic-embed-text-v1.5',
      dimensions: 768,
      origin: note.origin,
    }
  })
}
interface Database {
  notes: Note[]
  chunks: Chunk[]
  tasks: Task[]
  projects: Project[]
  sessions: Session[]
  messages: Message[]
  tool_calls: ToolCall[]
  pending_confirmations: PendingConfirmation[]
  device: DeviceStatus
  idempotency: Map<string, string>
}
const history = seedSessions()
const notes = seedNotes()
export const db: Database = {
  notes,
  chunks: notes.flatMap(chunkNote),
  tasks: seedTasks(),
  projects: seedProjects(),
  ...history,
  tool_calls: [],
  pending_confirmations: [],
  device: {
    online: true,
    last_heartbeat: '2026-10-04T01:29:48Z',
    backend_uptime: 345612,
    device_id: 'ciel-desk-01',
    firmware: '0.3.2-demo',
    rssi: -48,
  },
  idempotency: new Map(),
}
export let dbReady = seedAudit().then(rows => {
  db.tool_calls = rows
  changed()
})
export const backgroundTimers = new Set<ReturnType<typeof setTimeout>>()
export function resetDatabase() {
  backgroundTimers.forEach(clearTimeout)
  backgroundTimers.clear()
  db.notes = seedNotes()
  db.chunks = db.notes.flatMap(chunkNote)
  db.tasks = seedTasks()
  db.projects = seedProjects()
  const s = seedSessions()
  db.sessions = s.sessions
  db.messages = s.messages
  db.pending_confirmations = []
  db.idempotency.clear()
  db.device = { ...db.device, online: true, last_heartbeat: DEMO_NOW }
  dbReady = seedAudit().then(rows => {
    db.tool_calls = rows
    changed()
  })
  changed()
}
