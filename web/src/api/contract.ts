export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
export type Args = Record<string, Json>
export type ErrorCode =
  | 'invalid_token'
  | 'forbidden'
  | 'embedding_model_mismatch'
  | 'confirmation_modified'
  | 'confirmation_consumed'
  | 'payload_too_large'
  | 'rate_limited'
  | 'not_ready'
  | 'provider_rate_limited'
  | 'agent_loop_limit'
  | 'tool_timeout'
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; detail?: string; retry_after?: number }
}
export type Origin = 'user' | 'model'
export interface Note {
  id: string
  title: string
  content: string
  summary: string
  source: string
  tags: string[]
  private: boolean
  origin: Origin
  confirmed: boolean
  status: 'pending' | 'ready' | 'failed'
  created_at: string
  updated_at: string
  domain: string
}
export interface Chunk {
  id: string
  note_id: string
  heading: string
  content: string
  position: number
  token_count: number
  embedding_model: string
  dimensions: 768
  origin: Origin
}
export interface NoteInput {
  content: string
  source?: string
  tags?: string[]
  private?: boolean
}
export interface NoteListQuery {
  limit?: number
  cursor?: string
  tag?: string
  q?: string
}
export interface NoteList {
  items: Note[]
  next_cursor: string | null
}
export interface SearchQuery {
  query: string
  k?: number
  after?: string
  before?: string
  tags?: string[]
}
export interface Citation {
  note_id: string
  chunk_id: string
  heading: string
  score: number
}
export interface Retrieved {
  note_id: string
  chunk_id: string
}
export interface SearchResult extends Citation {
  title: string
  summary: string
  chunk_text: string
  origin: Origin
}
export interface SearchResponse {
  results: SearchResult[]
  retrieved: Retrieved[]
}
export type TaskStatus = 'todo' | 'doing' | 'done'
export interface Task {
  id: string
  title: string
  description: string
  due_at: string | null
  project_id: string | null
  project: string
  status: TaskStatus
  source: 'manual' | 'ciel'
  created_at: string
}
export interface TaskInput {
  title: string
  description?: string
  due_at?: string | null
  project_id?: string | null
  project?: string
}
export type TaskPatch = Partial<TaskInput> & { status?: TaskStatus }
export interface Project {
  id: string
  name: string
  path: string
  language: string
  private: boolean
  last_scan: string
  created_at: string
}
export type ProjectInput = Pick<Project, 'name' | 'path' | 'language'> & { private?: boolean }
export interface ToolCall {
  id: string
  session_id: string
  turn_id: string
  tool: string
  args: Args
  ok: boolean | null
  error_code?: string
  duration_ms: number
  summary: string
  created_at: string
  private: boolean
  metadata_only: boolean
}
export interface PendingConfirmation {
  id: string
  session_id: string
  tool: string
  args: Args
  args_hash: string
  args_length: number
  expires_at: number
  state: 'pending' | 'executed' | 'denied' | 'expired'
  preview: string
  result?: string
}
export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  thinking: string
  tool_calls: ToolCall[]
  citations: Citation[]
  retrieved: Retrieved[]
  confirmation_id?: string
  error?: ApiErrorBody['error']
  status: 'streaming' | 'done' | 'awaiting_confirm' | 'stopped' | 'error'
  created_at: string
  scenario?: string
  citation_removed?: boolean
}
export interface Session {
  id: string
  title: string
  started_at: string
  last_message_at: string
  local_only: boolean
}
export interface SessionDetail extends Session {
  messages: Message[]
  pending?: PendingConfirmation
}
export interface ChatRequest {
  session_id?: string
  message?: string
  continue?: boolean
}
export type SseEvent =
  | { event: 'thinking'; data: { text: string } }
  | { event: 'token'; data: { text: string } }
  | { event: 'tool_call'; data: { id: string; tool: string; args: Args } }
  | {
      event: 'tool_result'
      data: { id: string; ok: boolean; summary: string; duration_ms: number }
    }
  | {
      event: 'tool_confirm'
      data: { id: string; tool: string; preview: string; decision_endpoint: string }
    }
  | { event: 'citations'; data: { citations: Citation[] } }
  | {
      event: 'done'
      data: {
        session_id: string
        usage?: { prompt_tokens: number; completion_tokens: number }
        tool_calls?: number
        status?: 'awaiting_confirm'
        tool_call_id?: string
      }
    }
  | { event: 'error'; data: { error: { code: ErrorCode; message: string; retry_after?: number } } }
export interface DailyBrief {
  captured_yesterday: Note[]
  due_today: Task[]
  reflection: string
  generated_at: string
}
export interface DeviceStatus {
  online: boolean
  last_heartbeat: string
  backend_uptime: number
  device_id: string
  firmware: string
  rssi: number
}
export interface Health {
  status: 'ok'
}
export interface Readiness {
  status: 'ready' | 'not_ready'
  postgres: boolean
  embedder: boolean
  embedding_model: string
  provider: 'up' | 'down' | 'unknown'
}
export interface Email {
  id: string
  from: string
  subject: string
  body: string
  gist: string
  date: string
  urgency: 'high' | 'normal' | 'low'
  injection: boolean
}
