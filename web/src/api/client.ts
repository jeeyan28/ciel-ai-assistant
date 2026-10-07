import type {
  ChatRequest,
  SseEvent,
  Session,
  SessionDetail,
  NoteInput,
  Note,
  NoteListQuery,
  NoteList,
  SearchQuery,
  SearchResponse,
  Task,
  TaskInput,
  TaskPatch,
  TaskStatus,
  Project,
  ProjectInput,
  DailyBrief,
  DeviceStatus,
  ToolCall,
  Health,
  Readiness,
} from './contract'
export interface CielApi {
  chat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<SseEvent>
  listSessions(): Promise<Session[]>
  createSession(body: { title?: string }): Promise<Session>
  getSession(id: string): Promise<SessionDetail>
  streamSession(id: string, signal?: AbortSignal): AsyncIterable<SseEvent>
  confirm(
    sessionId: string,
    body: { tool_call_id: string; decision: 'approve' | 'deny' }
  ): Promise<{ status: 'executed' | 'denied' | 'expired' }>
  createNote(body: NoteInput, idempotencyKey?: string): Promise<{ id: string; status: 'pending' }>
  getNote(id: string): Promise<Note>
  deleteNote(id: string): Promise<void>
  listNotes(query?: NoteListQuery): Promise<NoteList>
  searchNotes(query: SearchQuery): Promise<SearchResponse>
  listTasks(query?: { status?: TaskStatus; project_id?: string }): Promise<Task[]>
  createTask(body: TaskInput): Promise<Task>
  patchTask(id: string, body: TaskPatch): Promise<Task>
  listProjects(): Promise<Project[]>
  registerProject(body: ProjectInput): Promise<Project>
  deleteProject(id: string): Promise<void>
  getDailyBrief(): Promise<DailyBrief>
  transcribe(
    audio: Blob,
    options: { save_as_note: boolean }
  ): Promise<{ transcript: string; note_id?: string }>
  tts(text: string): Promise<Blob>
  briefVoice(): Promise<Blob>
  deviceHeartbeat(body: { device_id: string }): Promise<{ last_heartbeat: string }>
  deviceStatus(): Promise<DeviceStatus>
  auditToolCalls(query?: { from?: string; to?: string; tool?: string }): Promise<ToolCall[]>
  healthz(): Promise<Health>
  readyz(): Promise<Readiness>
}
