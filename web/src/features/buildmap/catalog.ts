/** Shared endpoint, model, guardrail, and scenario reference for the demo UI and export. */

/** An API example and its screen, requirement references, and architecture area. */
export interface Endpoint {
  id: string
  method: string
  path: string
  screen: string
  refs: string
  milestone: number
  request: string
  response: string
  note: string
}
const entry = (
  id: string,
  method: string,
  path: string,
  screen: string,
  refs: string,
  milestone: number,
  request: string,
  response: string,
  note = ''
): Endpoint => ({ id, method, path, screen, refs, milestone, request, response, note })
/** Contract examples exposed by the in-memory adapter; no network requests are made. */
export const endpoints: Endpoint[] = [
  entry(
    'chat',
    'POST',
    '/chat',
    'Chat',
    'FR-20 · GR-1/2/19',
    2,
    '{"session_id":"s01","message":"What did I note about Tailscale?"}',
    'event: token\ndata: {"text":"Your notes…"}\n\nevent: citations\ndata: {"citations":[{"note_id":"n01","chunk_id":"n01-c1","heading":"Advertising routes","score":0.96}]}\n\nevent: done\ndata: {"session_id":"s01","tool_calls":1}',
    'SSE via fetch + ReadableStream. continue:true resumes a parked turn. All eight event types are in contract.ts.'
  ),
  entry(
    'sessions',
    'GET',
    '/sessions',
    'Chat',
    'FR-20',
    2,
    '—',
    '[{"id":"s01","title":"Tailscale routing","started_at":"2026-10-03T01:00:00Z","last_message_at":"2026-10-03T01:05:00Z"}]'
  ),
  entry(
    'session-create',
    'POST',
    '/sessions',
    'Chat',
    'FR-20',
    2,
    '{"title":"New conversation"}',
    '{"id":"uuid","title":"New conversation"}'
  ),
  entry(
    'session',
    'GET',
    '/sessions/{id}',
    'Chat',
    'FR-20 · GR-2',
    2,
    '—',
    '{"id":"s01","messages":[],"pending":null}',
    'Messages and tool-call history. The demo also returns local_only and pending metadata in its session envelope.'
  ),
  entry(
    'stream',
    'GET',
    '/sessions/{id}/stream',
    'Chat',
    'FR-23 · GR-2',
    3,
    '—',
    'event: tool_confirm\ndata: {"id":"uuid","tool":"add_task","preview":"…","decision_endpoint":"/sessions/s01/confirm"}',
    'Reattach a parked turn without duplicating the user message.'
  ),
  entry(
    'confirm',
    'POST',
    '/sessions/{id}/confirm',
    'Chat',
    'FR-23 · GR-2',
    3,
    '{"tool_call_id":"uuid","decision":"approve"}',
    '{"status":"executed"}',
    'Stored args SHA-256, 5-minute expiry, atomic single use. 409 confirmation_modified / confirmation_consumed.'
  ),
  entry(
    'notes-create',
    'POST',
    '/notes',
    'Notes',
    'FR-1/2/4 · GR-3/11',
    2,
    '{"content":"# DNS fix\\nResolver corrected.","source":"Manual capture","tags":["networking"],"private":false}',
    '202 {"id":"uuid","status":"pending"}',
    'Idempotency-Key or content hash. Background pending → ready | failed. Title is parsed from Markdown.'
  ),
  entry(
    'notes-list',
    'GET',
    '/notes?limit=&cursor=&tag=&q=',
    'Notes',
    'FR-2',
    2,
    'limit=12&tag=networking',
    '{"items":[],"next_cursor":"opaque-keyset-cursor"}',
    'In-memory adapter list envelope. The cursor identifies the last row, never an offset.'
  ),
  entry(
    'note-get',
    'GET',
    '/notes/{id}',
    'Notes',
    'FR-2 · GR-20',
    2,
    '—',
    '{"id":"n01","origin":"user","private":false,"status":"ready","content":"…"}',
    'Chunks tab requires chunk metadata; frontend derives sections in the demo.'
  ),
  entry(
    'note-delete',
    'DELETE',
    '/notes/{id}',
    'Notes',
    'FR-4',
    2,
    '—',
    '204 No Content',
    'Cascade chunks and remove content-hash idempotency entries. Typed UI confirmation.'
  ),
  entry(
    'note-search',
    'POST',
    '/notes/search',
    'Notes, Chat',
    'FR-3 · GR-19',
    2,
    '{"query":"Postgres","k":5,"after":"2026-10-03","before":"2026-10-04","tags":["postgres"]}',
    '{"results":[{"note_id":"n03","chunk_id":"n03-c1","heading":"Nightly pg_dump","score":0.87,"title":"Postgres backup and restore runbook","summary":"…","chunk_text":"…","origin":"user"}],"retrieved":[{"note_id":"n03","chunk_id":"n03-c1"}]}',
    'Local-date half-open range. k ≤ 20. 409 embedding_model_mismatch.'
  ),
  entry(
    'tasks-list',
    'GET',
    '/tasks?status=&project_id=',
    'Tasks, Chat',
    'FR-5',
    3,
    'status=todo',
    '[{"id":"t01","title":"Rotate DEVICE_TOKEN","status":"todo"}]'
  ),
  entry(
    'tasks-create',
    'POST',
    '/tasks',
    'Tasks',
    'FR-5/22',
    3,
    '{"title":"Renew TLS certificate","due_at":"2026-10-09T17:00:00+08:00","project_id":null}',
    '{"id":"uuid","status":"todo"}',
    'The core task tool uses a free-text project; project_id represents the project relation in this reference.'
  ),
  entry(
    'tasks-patch',
    'PATCH',
    '/tasks/{id}',
    'Tasks',
    'FR-22',
    3,
    '{"status":"done"}',
    '{"id":"t01","status":"done"}',
    'Optimistic UI with rollback on errors. The design uses bound confirmation for agent-triggered task updates.'
  ),
  entry(
    'projects-list',
    'GET',
    '/projects',
    'Projects',
    'FR-6',
    5,
    '—',
    '[{"id":"p01","name":"ciel-backend","path":"/data/projects/ciel-backend","private":false}]'
  ),
  entry(
    'projects-create',
    'POST',
    '/projects',
    'Projects',
    'FR-6 · GR-5',
    5,
    '{"name":"sandbox","path":"/data/projects/sandbox","language":"Python","private":false}',
    '{"id":"uuid","name":"sandbox"}',
    'The demo checks four registered fixture directories without accessing the filesystem. Canonical paths and symlink boundaries require server enforcement.'
  ),
  entry(
    'projects-delete',
    'DELETE',
    '/projects/{id}',
    'Projects',
    'FR-6',
    5,
    '—',
    '204 No Content',
    'Unregister only; never delete repository files.'
  ),
  entry(
    'brief',
    'GET',
    '/brief/daily',
    'Brief',
    'FR-7 · GR-3',
    9,
    '—',
    '{"captured_yesterday":[],"due_today":[],"reflection":"A little maintenance…","generated_at":"2026-10-04T01:30:00Z"}',
    'Exclude private notes and tasks attached to private projects.'
  ),
  entry(
    'brief-voice',
    'POST',
    '/brief/voice',
    'Device',
    'FR-8 · GR-17',
    9,
    '—',
    'audio/wav · 16 kHz · mono · 16 bit · ≤30 seconds',
    'Device scope. Roughly 960 KB PCM at 30 seconds. Public demo device path returns 403.'
  ),
  entry(
    'voice',
    'POST',
    '/voice',
    'Voice',
    'FR-1/21',
    8,
    'multipart audio (webm/opus or wav), save_as_note=false',
    '{"transcript":"Naayos na ang DNS…"}',
    'Demo ignores audio and replays a fixed Taglish transcript. User reviews before saving.'
  ),
  entry(
    'tts',
    'GET',
    '/tts?text=…',
    'Voice, Brief, Chat',
    'FR-21',
    8,
    'text=Good morning',
    'audio/wav · 16 kHz · mono · 16 bit',
    '1,000 character cap; query strings must be scrubbed from real access logs. Demo generates a quiet calibration tone, not speech.'
  ),
  entry(
    'heartbeat',
    'POST',
    '/device/heartbeat',
    'Device',
    'FR-19 · GR-17',
    9,
    '{"device_id":"ciel-desk-01"}',
    '{"last_heartbeat":"2026-10-04T01:30:00Z"}'
  ),
  entry(
    'device',
    'GET',
    '/device/status',
    'Device',
    'FR-19',
    9,
    '—',
    '{"online":true,"last_heartbeat":"2026-10-04T01:29:48Z","backend_uptime":345612}'
  ),
  entry(
    'audit',
    'GET',
    '/audit/tool-calls?from=&to=&tool=',
    'Audit',
    'GR-10/15',
    3,
    'tool=save_note',
    '[{"id":"uuid","tool":"save_note","args":{"length":214,"sha256":"64 hex characters"},"ok":true,"duration_ms":430}]',
    '90-day retention. All write/private arguments are metadata only. Never log tokens.'
  ),
  entry(
    'health',
    'GET',
    '/healthz',
    'Health & Limits',
    'GR-17',
    1,
    '—',
    '{"status":"ok"}',
    'Root route, unauthenticated, no PII.'
  ),
  entry(
    'ready',
    'GET',
    '/readyz',
    'Health & Limits',
    'GR-18',
    1,
    '—',
    '{"status":"ready","postgres":true,"embedder":true,"provider":"up"}',
    'Root route. 503 if Postgres/embedder down; provider status cached 30 seconds and does not fail readiness.'
  ),
]
/** Numbered architecture areas; the retained numeric associations do not describe a schedule. */
export const milestones = [
  ['Foundations', 'Auth, readiness, schema, configuration'],
  ['Knowledge core', 'Notes, chunks, retrieval, chat SSE'],
  ['Work & confirmations', 'Tasks, parked turns, audit and limits'],
  ['Ciel Lite', 'PWA, keyboard access, security review'],
  ['Coding tools', 'Projects, review, commit text, private routing'],
  ['Security & search', 'Scans, advisories, blocked private web search'],
  ['Read-only email', 'Mailbox summaries and copyable reply text'],
  ['Voice', 'Push-to-talk, transcript review, local TTS'],
  ['Desk companion', 'Private-filtered brief and ESP32 status'],
  ['Operations', 'Backups, restart behavior, rate limits'],
  ['Public demo', 'Isolated fake data, no provider keys'],
  ['Evaluation', 'Retrieval metrics, guardrail reports, interface review'],
]
/** Reference data shapes and the screen relationships illustrated by the demo. */
export const models = [
  {
    name: 'notes',
    columns:
      'id · content · summary · tags[] · source · origin · confirmed · private · status · created_at · updated_at',
    relation: 'notes.id → chunks.note_id',
    route: '/notes',
  },
  {
    name: 'chunks',
    columns:
      'id · note_id FK · heading · position · content · embedding vector(768) · embedding_model · origin · token_count',
    relation: 'chunks.id → retrieved set → verified citations',
    route: '/notes',
  },
  {
    name: 'tasks',
    columns:
      'id · title · description · status · due_at · project (free text) · project_id FK · created_at',
    relation: 'tasks.project_id → projects.id',
    route: '/tasks',
  },
  {
    name: 'projects',
    columns: 'id · name · path · language · private · created_at',
    relation: 'projects.private → sessions.local_only',
    route: '/projects',
  },
  {
    name: 'sessions',
    columns: 'id · title · started_at · last_message_at · local_only',
    relation: 'sessions.id → messages.session_id',
    route: '/chat',
  },
  {
    name: 'messages',
    columns: 'id · session_id FK · role · content · thinking · citations · created_at',
    relation: 'messages.id → tool_calls.turn_id',
    route: '/chat',
  },
  {
    name: 'tool_calls',
    columns:
      'id UUIDv4 · session_id FK · turn_id · tool · args jsonb (classified) · ok · error_code · duration_ms · created_at',
    relation: 'tool_calls.id → pending_confirmations.id',
    route: '/audit',
  },
  {
    name: 'pending_confirmations',
    columns: 'id FK · session_id · tool · args · args_hash · expires_at · state · consumed_at',
    relation: 'Exact arguments, atomic claim, one execution',
    route: '/chat',
  },
  {
    name: 'device',
    columns: 'device_id · last_heartbeat · firmware · backend_uptime',
    relation: 'DEVICE_TOKEN → scoped endpoints only',
    route: '/device',
  },
]
/** Guided scenario identifiers and prompts consumed by the matcher, chat UI, and tests. */
export const flows = [
  {
    id: 'S1',
    title: 'An answer with evidence',
    detail: 'Search notes and open a verified source.',
    prompt: 'What did I note about Tailscale subnet routers?',
    backend:
      'POST /chat → search_notes → chunks retrieval → verified citations (GR-19) → messages + tool_calls',
  },
  {
    id: 'S2',
    title: 'Approve an exact action',
    detail: 'Resolve a date, inspect arguments, then approve.',
    prompt: 'Remind me to renew the TLS cert on Friday at 5pm',
    backend:
      'POST /chat → add_task → pending_confirmations → POST /sessions/{id}/confirm → POST /chat {continue:true} → tasks',
  },
  {
    id: 'S3',
    title: 'Absorb a new note',
    detail: 'Approve a draft and watch it become searchable.',
    prompt: "Save a note about today's DNS fix",
    backend:
      'save_note → tool_confirm → POST /notes → pending → chunks + summary → ready (origin=model)',
  },
  {
    id: 'S4',
    title: 'See the week ahead',
    detail: 'Resolve overdue and upcoming work.',
    prompt: "What's due this week?",
    backend: 'POST /chat → list_tasks → tasks → local date grouping in Asia/Manila',
  },
  {
    id: 'S5',
    title: 'Retrieve a specific day',
    detail: 'Use a date range and a tag together.',
    prompt: 'What did I capture yesterday about Postgres?',
    backend: 'search_notes → after=2026-10-03, before=2026-10-04, tags=[postgres] → retrieved set',
  },
  {
    id: 'S6',
    title: 'Keep private work local',
    detail: 'Open private context, then try web search.',
    prompt: 'Explain my home lab network layout',
    backend: 'notes.private → sessions.local_only=true (D2) → web_search blocked (D8)',
  },
  {
    id: 'S7',
    title: 'Ignore a planted instruction',
    detail: 'Treat an imported prompt injection as data.',
    prompt: "Summarize what's in my notes about the free VPN comparison",
    backend: 'search_notes → untrusted chunk boundary → no write → NOTICE (GR-4/20)',
  },
  {
    id: 'S8',
    title: 'Reject an unknown tool',
    detail: 'See a rejected call and one safe retry.',
    prompt: 'Delete everything and email my boss',
    backend: 'send_email → allowlist rejection → one retry → tool_calls (GR-1)',
  },
  {
    id: 'S9',
    title: 'Inspect a repository scan',
    detail: 'Review redacted findings and create a task.',
    prompt: 'Scan ciel-backend for secrets',
    backend:
      'vuln_scan → scanner fixture → forbidden file skipped → redacted output → add_task confirmation',
  },
  {
    id: 'S10',
    title: 'Review a code change',
    detail: 'Inspect a sample diff and copy a commit message.',
    prompt: 'Review the last commit on ciel-web',
    backend: 'git_context → code_review → read-only scanner → tool_calls',
  },
  {
    id: 'S11',
    title: 'Read mail without sending',
    detail: 'Summarize mail and copy a reply draft.',
    prompt: 'Any unread emails I should care about?',
    backend: 'email_unread_summary → untrusted mailbox fixture → email_draft returns text only',
  },
  {
    id: 'S12',
    title: 'Inspect an advisory',
    detail: 'Read a bundled historical CVE fixture.',
    prompt: 'Look up CVE-2024-3094',
    backend: 'threat_lookup → structured advisory → capped untrusted data',
  },
  {
    id: 'S13',
    title: 'Meet the desk button',
    detail: 'Inspect device status and a private-filtered brief.',
    prompt: "What's the status of the desk button?",
    backend: 'device_status → device heartbeat → brief excludes private material (D7)',
  },
  {
    id: 'S14',
    title: 'Recover from an interruption',
    detail: 'Keep partial text when the provider pauses.',
    prompt: 'Trigger error provider_rate_limited',
    backend: 'SSE error → retry_after:12 → partial text preserved → deliberate retry (GR-13/14)',
  },
]
/** Security rules illustrated in client code; deployment enforcement requires a server. */
export const guardrails = [
  ['Tool allowlist', 'S8', 'Four core tools; unknown tools rejected.'],
  ['Bound confirmations', 'S2', 'Exact hash, single use, 5-minute expiry, user token.'],
  ['Private routing', 'S6', 'Local embeddings and session-sticky local processing.'],
  ['Untrusted content', 'S7', 'Retrieved instructions never grant permissions.'],
  ['Path boundary', 'S9', 'Registered roots only; forbidden files skipped.'],
  ['Command allowlist', 'S10', 'No shell, commit, push, or arbitrary command tool.'],
  [
    'Scanner isolation',
    'S9',
    'Read-only scanner fixture; infrastructure isolation requires a server.',
  ],
  ['Private web search', 'S6', 'External search fails closed in a private session.'],
  ['Read-only mailbox', 'S11', 'No send or Gmail draft scopes.'],
  ['Secret handling', 'S9', 'Redaction before display; token never logged.'],
  ['Schema and caps', 'S3', 'UTF-8 byte caps and tag validation.'],
  ['Tool output bounds', 'S1', '8 KB UTF-8 output cap; k clamped to 20.'],
  ['Loop and duration bounds', 'S14', 'Four iterations, 10-second tool, 120-second stream.'],
  ['Rate limits', 'S14', '60 requests/minute and three concurrent streams.'],
  ['Audit classification', 'S2', 'Write/private args contain only length + SHA-256.'],
  ['Demo isolation', 'S13', 'Fictional data; public mode disables device endpoints.'],
  ['Token scope', 'S13', 'Only healthz/readyz unauthenticated; device scope limited.'],
  ['Fail closed', 'S8', 'Unknown or failed policy check blocks the action.'],
  ['Verified citations', 'S1', 'Only request-retrieved note/section pairs survive.'],
  ['Model origin', 'S3', 'Approved model notes remain labeled and untrusted.'],
]

/**
 * Render the shared catalog as a Markdown design reference without performing I/O.
 * @returns Endpoint examples, data relationships, architecture areas, scenarios, and simulation limits.
 */
export function backendMarkdown(): string {
  return `# Ciel — frontend and API design reference

Generated from ciel-web/src/features/buildmap/catalog.ts.

This reference describes the in-memory frontend simulation and its API interface. All endpoint operations use the demo adapter; no backend, database, model provider, mailbox, scanner, or physical device is connected. Architecture areas organize the design and do not represent a delivery schedule.

API base: /api/v1, except root /healthz and /readyz. Demo clock: Sunday 4 October 2026, 09:30 Asia/Manila.

## 1. Endpoint inventory

${endpoints
  .map(
    e => `### ${e.method} ${e.path}

${e.screen} · ${e.refs} · Area ${e.milestone}

Request:

\`\`\`text
${e.request}
\`\`\`

Response:

\`\`\`text
${e.response}
\`\`\`

${e.note}
`
  )
  .join('\n')}
## SSE events

Exact names: thinking, token, tool_call, tool_result, tool_confirm, citations, done, error. See contract.ts for payloads. Citations are emitted after the final token and before done. A parked turn ends with done {status: awaiting_confirm, tool_call_id}. Reattach with GET /sessions/{id}/stream; approve/deny then POST /chat {continue:true}.

## 2. Data model

These shapes explain screen requirements and relationships. They are design examples, not database migrations.

${models
  .map(
    m => `### ${m.name}

${m.columns}

${m.relation}. Seen in UI at ${m.route}.`
  )
  .join('\n\n')}

## 3. Architecture areas

${milestones.map(([name, scope], i) => `${i + 1}. **${name}** — ${scope}.`).join('\n')}

## 4. Guardrail → UI behavior

The demo illustrates these rules in client code. Production authentication, authorization, isolation, privacy, retention, and rate limiting require independent server enforcement.

${guardrails.map(([name, flow, detail], i) => `- GR-${i + 1}: ${name}. ${detail} Try ${flow}.`).join('\n')}

## Flow Explorer

${flows.map(f => `- ${f.id} — ${f.title}: ${f.backend}`).join('\n')}

## 5. Simulation and contract boundaries

- Session titles and note tags are edited in memory through demo.store.ts. CielApi has no session-rename or note-tag-update method.
- Chunk metadata and referenced-chat lookup are derived locally. List, session, and error examples describe the frontend simulation rather than a running server contract.
- The core task tool accepts a free-text project; task records also expose project_id for the project relationship.
- Chunk token counts are character-based estimates (characters / 4). Search uses deterministic lexical scoring rather than embeddings.
- Project paths use a fixture allowlist. The demo does not check filesystem existence or symlinks, isolate scanners, authenticate OAuth accounts, capture microphone audio, or invoke model providers.
- TTS returns a local 16 kHz mono PCM WAV calibration tone rather than synthesized speech.
- Flow Explorer has 14 guided flows. S3 combines note capture and indexing; S15 is the unmatched-input fallback.
- Project registration is a direct user action. Model-triggered registration is not part of the simulated confirmation flows.
- Endpoint operations use CielApi, selected in src/api/index.ts. The active implementation is DemoApi; no RealApi implementation exists.
- Streaming uses an asynchronous iterator with the SSE event shapes above. A network adapter would need fetch and ReadableStream, in-memory bearer handling, cancellation, stream duration limits, and server-owned pending confirmations.
- The static service worker excludes /api/* and health routes from navigation fallback; /api/* requests use NetworkOnly. Workspace data and bearer tokens stay in memory.
- Lighthouse scores and animation frame rates are not reported as measured results.
`
}
