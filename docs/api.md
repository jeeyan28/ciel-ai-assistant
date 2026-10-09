# API specification

> Design specification. See the README for current implementation status.

This document defines backend routes and tool contracts. Only `/healthz` and `/readyz` are implemented so far; the `/api/v1` routes below are specified but not yet built. The frontend calls the 26-method `CielApi` interface through `DemoApi` and simulates its responses in memory; connection, automation, notification, and live GitHub contracts are outside that adapter. See the [frontend README](../web/README.md) for the implemented surface.

Base URL: `https://<host or tailnet>/api/v1` · Auth: `Authorization: Bearer <CIEL_TOKEN>` (user) or `Bearer <DEVICE_TOKEN>` (ESP32, restricted scope) · Format: JSON unless noted.

**Health endpoints are the exception to the base URL**: `GET /healthz` (liveness) and `GET /readyz` are served at the **root** — e.g. `http://localhost:8000/healthz` — not under `/api/v1`. Both are unauthenticated and return no PII. `/readyz` = Postgres reachable + embedder loaded → otherwise **503**; the LLM provider is checked with a **30 s cache** and reported only as `"provider": "up"|"down"|"unknown"` — a provider outage does **not** fail readiness (no Docker restart loop). [docs/architecture.md](architecture.md) (component 4) state the same.

## Conventions

- Errors: `{"error": {"code": "tool_timeout", "message": "dependency_scan exceeded 10s", "detail": "..."}}` + proper 4xx/5xx. Security-relevant codes: `401 invalid_token`, `403 forbidden` (scope/confirm misuse), `409 embedding_model_mismatch`, `409 connection_required` / `409 connection_unavailable` (automation needs a healthy connection), `409 run_in_progress` (automation already running), `413 payload_too_large`, `429 rate_limited` (with `retry_after`), `503 not_ready`
- Ciel ids: UUIDv4 (**tool-call ids are UUIDv4 too** — the `tc_N` values in examples are placeholders); provider IDs retain native types; timestamps: ISO-8601 UTC
- **Caps (enforced; numbers from [docs/security.md](security.md) "Concrete default limits")**: JSON body 1 MB · chat message 32 KB · note content 256 KB · tool result → LLM 8 KB · note-search `k` ≤ 20 · SSE stream 120 s · rate limits 60 req/min/token + 3 concurrent SSE (429 with `retry_after` on breach) · notification body 2000 chars · automation run 60 s / ≤4 iterations / 10 runs per automation per hour (30/hour globally) · GitHub clone 60 s / 200 MB (`--depth 1`, no submodules)
- Long ops: chat is SSE; ordinary tools are capped at 10 s. Note ingestion, automation runs, and GitHub import/sync return **202** and run in the background; project records expose import status
- All tool invocations (including those triggered by chat) are logged to `tool_calls`
- Relative dates ("yesterday", "Friday", bare due dates) are resolved in the user's configured timezone (default Asia/Manila) — rules in [docs/architecture.md](architecture.md)
- Query strings are **scrubbed from access logs** (`/notes?q=…`, `/tts?text=…` never persist user text in logs — GR-10/GR-15)
- **Demo mode**: with `CIEL_DEMO_MODE=true`, the chat endpoint replays canned/scripted responses from seeded fake data — no LLM provider is called and no API key is required. The UI is labeled "demo replay". Real providers are for local use only. The public-demo contract requires in a **separate environment with separate storage and credentials** (D6 — the flag alone is not the control)

## Endpoints

### Chat / Sessions

| Method | Path                    | Purpose                                                                                                                                               |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/chat`                 | Send message; **SSE response** (schema below). Body `{session_id?, message?, continue?}` — `continue:true` **continues a parked turn** (no `message`) |
| GET    | `/sessions`             | List sessions (title, started_at, last_message_at)                                                                                                    |
| POST   | `/sessions`             | Create named session `{title?}`                                                                                                                       |
| GET    | `/sessions/{id}`        | Messages + tool-call timeline for one session                                                                                                         |
| GET    | `/sessions/{id}/stream` | Re-attach to the session's live/parked turn (SSE) — a dropped connection re-attaches without losing the turn                                          |

`POST /chat` body:

```json
{ "session_id": "…", "message": "scan ciel-backend for secrets" }
```

**SSE event stream** (the UI renders these live):

```
event: thinking     data: {"text": "…reasoning content, collapsed in UI…"}   # optional; only when the model emits thinking
event: token        data: {"text": "Scanning"}
event: token        data: {"text": " the repo…"}
event: tool_call    data: {"id":"tc_1","tool":"vuln_scan","args":{"project":"ciel-backend"}}
event: tool_result  data: {"id":"tc_1","ok":true,"summary":"2 vulnerable deps, 0 secrets","duration_ms":2140}
event: tool_confirm data: {"id":"tc_2","tool":"save_note","preview":"…","decision_endpoint":"/sessions/{id}/confirm"}
event: done         data: {"session_id":"…","status":"awaiting_confirm","tool_call_id":"tc_2"}   # stream ENDS here — turn parked
event: citations    data: {"citations":[{"note_id":"…","chunk_id":"…","heading":"…","score":0.83}]}
event: done         data: {"session_id":"…","usage":{"prompt_tokens":812,"completion_tokens":233},"tool_calls":2}
event: error        data: {"error":{"code":"agent_loop_limit","message":"max 4 tool iterations reached"}}
```

- `tool_confirm` is emitted for agent-initiated writes (save_note, add_task, update_task, project registration); the turn then **parks** (state persisted in `pending_confirmations`) and the stream closes with `done {status:"awaiting_confirm"}`. Resolving the decision and re-opening with `POST /chat {continue:true}` continues the same turn
- `citations` is emitted **after the last token and before the final `done`**: the verified list (citations were checked against the retrieved set for this request; violations stripped + labeled per [docs/security.md](security.md) GR-19/D4a). Answer markers use `[[n:<note_id>#<chunk_id>]]`
- GitHub answers additionally cite backend-retrieved references `{source_ref_id, repository_id, commit_sha?, path?, item_id?, url, fetched_at}` with `[[g:<source_ref_id>]]`; the same event carries verified GitHub entries. Validate IDs/locations against the turn's retrieved set and persist verified references with the message; no model-invented source links
- `error` with `code:"provider_rate_limited"` (429 upstream) ends the turn — no in-loop retry; `retry_after` is included

The client resolves a parked confirmation with:

| Method | Path                     | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/sessions/{id}/confirm` | `{tool_call_id, decision: approve\|deny}` → on approve the pending tool executes (with the **exact stored arguments**); on deny the model receives "user denied". **Bound to the tool-call id AND an args hash** — args altered after parking → `409 confirmation_modified`, nothing executes; **single-use** (replay → `409 confirmation_consumed`); **expires after 5 min** (auto-deny → model receives "confirmation expired"); **user token only** (device token → 403). Response: `{status: executed\|denied\|expired}` |

### Notes

| Method | Path                            | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/notes`                        | Capture note `{content, source?, tags?, private?}` → **202** `{id, status:"pending"}` — parsing/chunking/embedding run in the background (`notes.status`: `pending` → `ready` \| `failed`). Stored with `origin=user`, `confirmed=true` (user-typed — no confirmation step). Optional `Idempotency-Key` header (or content-hash fallback) makes retries safe: same key/hash → same note id, no duplicate                                                         |
| GET    | `/notes/{id}`                   | Full note (includes `origin`, `private`, `status`)                                                                                                                                                                                                                                                                                                                                                                                                               |
| DELETE | `/notes/{id}`                   | Deletes the note **and its chunks** (right-to-forget; real endpoint, not GUI-only)                                                                                                                                                                                                                                                                                                                                                                               |
| GET    | `/notes?limit=&cursor=&tag=&q=` | List / filter (q = simple full-text). `limit` default 20, max 100; `cursor` = opaque keyset cursor (id of last row) — no offset pagination                                                                                                                                                                                                                                                                                                                       |
| POST   | `/notes/search`                 | RAG query `{query, k=5 (≤20), after?, before?, tags?}` (dates in the user's timezone) → `{results: [{note_id, title, summary, score, chunk_id, chunk_text, heading, origin}], retrieved: [{note_id, chunk_id}]}`. `retrieved` is the per-request retrieved set used to verify answer citations (GR-19). Only `status=ready` notes match. Error `embedding_model_mismatch` (409) if the query's embedding model differs from the stored chunks' `embedding_model` |

### Voice

| Method | Path          | Purpose                                                                                                                      |
| ------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/voice`      | `multipart: audio (webm/opus from MediaRecorder, or wav), {save_as_note: true}` → STT → `{transcript}` (+ note id if saving) |
| GET    | `/tts?text=…` | → `audio/wav` (**16 kHz mono 16-bit**, Piper's native output). Text length cap 1000 chars. Used by the PWA and the ESP32     |

### Work

| Method | Path                                                     | Purpose                                                                                                                                                                                                                                   |
| ------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/tasks?status=&project_id=`                             | List                                                                                                                                                                                                                                      |
| POST   | `/tasks`                                                 | `{title, description?, due_at?, project_id?}`                                                                                                                                                                                             |
| PATCH  | `/tasks/{id}`                                            | `{status?, due_at?, …}`                                                                                                                                                                                                                   |
| GET    | `/projects` / POST                                       | Register project `{name, path, language, private?}` (path must be an existing dir under `/data/projects/`; `private=true` forces local-LLM routing — see [docs/security.md](security.md)). Agent-initiated registration is confirmable    |
| GET    | `/projects/{id}`                                         | Project identity, imported SHA, last sync time, and `cloning\|ready\|failed` status; poll after GitHub import/sync                                                                                                                        |
| GET    | `/projects/{id}/github?view=&ref=&path=&number=&cursor=` | Authorized read-only `overview\|files\|commits\|branches\|pull_requests\|issues\|checks\|security` context, including selected commit/PR diffs and existing discussions; paginated, source/time linked, with partial/unavailable sections |
| DELETE | `/projects/{id}`                                         | Unregister                                                                                                                                                                                                                                |
| GET    | `/brief/daily`                                           | Daily brief JSON `{captured_yesterday:[], due_today:[], reflection:"…", generated_at}` (dates resolved in the user's timezone)                                                                                                            |
| POST   | `/brief/voice`                                           | **DEVICE-scoped**: daily brief → TTS → `audio/wav` stream, **16 kHz mono 16-bit, capped at ~30 s**, streamed for chunked PCM playback (ESP32 audio path: [docs/architecture.md](architecture.md))                                         |

### Device (ESP32)

| Method | Path                | Purpose                                                            |
| ------ | ------------------- | ------------------------------------------------------------------ |
| POST   | `/device/heartbeat` | `{device_id}` → upsert `last_heartbeat`                            |
| GET    | `/device/status`    | Device + backend health `{online, last_heartbeat, backend_uptime}` |

DEVICE_TOKEN may only call `/device/*`, `/brief/voice`, `/tts`. Any other route → 403. If `DEVICE_TOKEN` is unset (optional) every device route fails closed with 403 — there is no default device token.

### Connections ("Connected apps")

| Method | Path                                           | Purpose                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/connections`                                 | List connections `{id, provider, status: ok\|degraded\|reauth_required\|revoked, scopes, created_at}` — **secrets are never returned** (masked only)                                                                                                                                                                                                                                                        |
| POST   | `/connections`                                 | Create `{provider: gmail\|telegram\|github, ...}` → 201. Gmail starts OAuth; Telegram takes `{bot_token, chat_id}` (encrypted at rest); GitHub starts App authorization/installation selection with no PAT field, following [architecture component 6](architecture.md#6-tool-adapters)                                                                                                                     |
| PATCH  | `/connections/{id}`                            | `{scopes?}` — e.g. gmail `{"read_bodies": true}` (off by default: metadata = from/subject/date only) · `{enabled?}`                                                                                                                                                                                                                                                                                         |
| DELETE | `/connections/{id}`                            | Disconnect → 204: connection credentials removed and dependents blocked fail-closed. GitHub snapshots remain stale/offline; fresh reads/sync/analysis stop. Installation management remains on GitHub                                                                                                                                                                                                       |
| POST   | `/connections/{id}/test`                       | Gmail mailbox probe; Telegram test message; GitHub verifies account/installation and selected-repository read grants → `{ok, detail}`                                                                                                                                                                                                                                                                       |
| POST   | `/connections/{id}/oauth/start`                | Gmail consent or GitHub App authorization/installation flow → `{authorize_url}`; initiated with the user token                                                                                                                                                                                                                                                                                              |
| GET    | `/connections/{id}/oauth/callback`             | Provider return, guarded by expiring single-use state tied to the authenticated initiation; verify GitHub account/installation before linking, redirect to the fixed UI origin. Invalid credentials → `reauth_required`                                                                                                                                                                                     |
| GET    | `/connections/{id}/repos?visibility=&cursor=`  | **github**: authorized installation repositories `{repository_id, full_name, visibility, language, default_branch, pushed_at}` (≤100/page, opaque cursor); Ciel project selection is required before analysis. No client URL                                                                                                                                                                                |
| POST   | `/connections/{id}/repos/{owner}/{repo}/clone` | **github** → **202** `{project_id, status:"cloning"}` — the backend constructs `https://github.com/<owner>/<repo>.git` itself (D12), runs `git clone --depth 1 --no-recurse-submodules` in the api layer (60 s / 200 MB caps), then flips `projects.status` to `ready` \| `failed`. A `private` GitHub repo registers with `projects.private=true` by default. Over the clone cap → `413 payload_too_large` |
| POST   | `/connections/{id}/repos/{owner}/{repo}/sync`  | **github** → 202 `{project_id, status:"cloning"}`: verify access, then fixed fetch/reset commands against a Ciel-owned snapshot; finish `ready\|failed`, recording SHA/time. Never touches a user's own repository                                                                                                                                                                                          |

### Automations

| Method | Path                                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/automations?enabled=`                 | List with `trigger`, `notify_channels`, `last_run_at`, `blocked_reason?`                                                                                                                                                                                                                                                                                                                                                                                                         |
| POST   | `/automations`                          | `{name, trigger: {type:"email", connection_id, sender, subject_contains?} \| {type:"manual"}, instructions, notify: ["in_app","telegram"]?, enabled?}` → 201. Email trigger without a healthy connection → `409 connection_required`                                                                                                                                                                                                                                             |
| GET    | `/automations/{id}`                     | Full record + recent runs summary                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| PATCH  | `/automations/{id}`                     | `{name?, instructions?, trigger?, notify?, enabled?}` — **enable/disable is `enabled`**                                                                                                                                                                                                                                                                                                                                                                                          |
| DELETE | `/automations/{id}`                     | Delete → 204 (run history and its audit rows are kept; notifications pruned per retention)                                                                                                                                                                                                                                                                                                                                                                                       |
| POST   | `/automations/{id}/run`                 | **Manual trigger → 202** `{run_id, status:"queued"}`. For an email-trigger automation: uses the most recent matching message; **if none exists the run still proceeds** with trigger payload `(manual run — no matching message)` and history shows `trigger: manual` (never an error). A manual-trigger automation runs `instructions` alone. Already running → `409 run_in_progress`; connection down → `409 connection_unavailable`; over the hourly cap → `429 rate_limited` |
| GET    | `/automations/{id}/runs?limit=&cursor=` | Run history (keyset cursor): `{id, trigger, status, started_at, finished_at, error_code?, notification_id?}`                                                                                                                                                                                                                                                                                                                                                                     |
| GET    | `/automations/{id}/runs/{run_id}`       | Run detail: status timeline, the run's tool-call steps (same shape as the session timeline), notification + delivery statuses                                                                                                                                                                                                                                                                                                                                                    |

Runs are background work (202 pattern): poll → guard → scoped payload → headless session → read-only tool loop → notification. Full sequence: [docs/architecture.md](architecture.md) "Automation run lifecycle"; the run's tool calls are auditable through the existing `GET /audit/tool-calls`.

### Notifications

| Method | Path                                        | Purpose                                                                                               |
| ------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/notifications?unread=true&limit=&cursor=` | In-app notification list: `{id, automation_id, run_id, title, body, deliveries, created_at, read_at}` |
| POST   | `/notifications/{id}/read`                  | Mark read → 204                                                                                       |
| POST   | `/notifications/read-all`                   | Mark all read → 204                                                                                   |
| DELETE | `/notifications/{id}`                       | Dismiss → 204                                                                                         |

In-app is simply these rows (badge = `?unread=true` count); Telegram delivery status rides on each row's `deliveries`. Rows are pruned after 30 days.

### Audit / Ops

| Method | Path                                | Purpose                                                                                                                                                                |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/audit/tool-calls?from=&to=&tool=` | Tool-call history (web audit view)                                                                                                                                     |
| GET    | `/healthz` (root)                   | Liveness (no auth) — served at the root, not under `/api/v1`                                                                                                           |
| GET    | `/readyz` (root)                    | Readiness: Postgres + embedder → 200, else 503; provider reported as `up\|down\|unknown` from a 30 s cache (no auth; no PII) — served at the root, not under `/api/v1` |

## Tool Schemas (what the LLM sees — one-line descriptions, short arg names)

```json
[
  {
    "name": "save_note",
    "description": "Store a note; auto-summarized and tagged. Requires user confirmation.",
    "args": { "content": "string", "source": "string?", "tags": "string[]?", "private": "bool?" }
  },
  {
    "name": "search_notes",
    "description": "Answer from the user's notes; cite note + section. Supports time ranges and tags.",
    "args": {
      "query": "string",
      "k": "int?(≤20)",
      "after": "ISO date?",
      "before": "ISO date?",
      "tags": "string[]?"
    }
  },
  {
    "name": "add_task",
    "description": "Create a task/ticket. Requires user confirmation.",
    "args": {
      "title": "string",
      "due_at": "ISO8601?",
      "project": "string? (free-text label)",
      "description": "string?"
    }
  },
  {
    "name": "list_tasks",
    "description": "List tasks, optionally by status or project.",
    "args": { "status": "todo|doing|done?", "project": "string?" }
  },
  {
    "name": "update_task",
    "description": "Change a task's status or fields. Requires user confirmation.",
    "args": {
      "task_id": "string",
      "status": "todo|doing|done?",
      "due_at": "ISO8601?",
      "description": "string?"
    }
  },
  {
    "name": "project_status",
    "description": "Summarize registered projects/tasks and selected GitHub project activity, checks, security, and refresh time.",
    "args": { "project": "string?" }
  },
  {
    "name": "github_context",
    "description": "Read selected GitHub project views with source references; never changes GitHub.",
    "args": {
      "project": "string",
      "what": "overview|files|commits|branches|pull_requests|issues|checks|security",
      "ref": "string?",
      "path": "string?",
      "number": "int?",
      "cursor": "string?"
    }
  },
  {
    "name": "git_context",
    "description": "Read-only git status/log/diff for a registered project.",
    "args": { "project": "string", "what": "status|log|diff", "n": "int?" }
  },
  {
    "name": "code_review",
    "description": "Review code, docs/structure, or a selected commit/PR diff. Feedback only; never posts or writes.",
    "args": {
      "project": "string?",
      "code": "string?",
      "what": "diff|docs|structure?(default diff)",
      "commit_sha": "string?",
      "pull_request": "int?"
    }
  },
  {
    "name": "commit_message",
    "description": "Draft copyable commit text from a local worktree or explicitly selected GitHub commit/PR diff.",
    "args": { "project": "string", "commit_sha": "string?", "pull_request": "int?" }
  },
  {
    "name": "dependency_scan",
    "description": "Run the project's dependency audit (npm/pip/cargo/govulncheck).",
    "args": { "project": "string" }
  },
  {
    "name": "vuln_scan",
    "description": "Dependency audit + redacted secret detection on a repo.",
    "args": { "project": "string" }
  },
  {
    "name": "threat_lookup",
    "description": "Look up a CVE or security advisory by ID/name.",
    "args": { "id": "string" }
  },
  {
    "name": "email_unread_summary",
    "description": "Summarize unread emails from the last 7 days; returns Gmail message IDs.",
    "args": { "limit": "int?" }
  },
  {
    "name": "email_draft",
    "description": "Return reply-draft text for one unread email. Text only — never written to Gmail.",
    "args": { "message_id": "string", "context": "string" }
  },
  {
    "name": "web_search",
    "description": "Search the web for facts not in the user's notes. Never put private data in the query.",
    "args": { "query": "string", "max_results": "int?" }
  },
  {
    "name": "device_status",
    "description": "Check the desk device (ESP32) and backend health.",
    "args": {}
  }
]
```

Notes for the agent:

- The system prompt includes the current date, weekday, and the user's timezone (default Asia/Manila). Relative dates resolve per the rules in [docs/architecture.md](architecture.md) (single source of truth)
- Unknown tool name from the LLM → reject, feed the error back, one retry max
- Every `args` validated with pydantic **before** execution; unknown/extra fields rejected; tags additionally validated server-side (≤10 tags, ≤32 chars, `[a-z0-9-_]`)
- **Write tools** (save_note, add_task, update_task, project registration) pause for client confirmation (`tool_confirm` event + `POST /sessions/{id}/confirm`); deny → the tool returns "user denied". Confirmations are bound to the call id **and its args**, single-use, 5-min expiry (see the confirm table above)
- **Private-content rules** (backend-enforced, [docs/security.md](security.md) GR-3/GR-8): private notes are embedded locally and never summarized by a cloud LLM; a session containing private content is stuck to the local provider (D2) and `web_search` is fail-closed blocked for it (D8)
- Subprocess tools (code/security): run in the scanner container, 10 s timeout, cwd pinned to the registered project path, output truncated to 8 KB; gitleaks output is `--redact`ed before it reaches the LLM; forbidden-file hits are skipped + flagged (D9). **Ciel never runs `git commit` or `git push` (GR-6 unchanged)** — `commit_message` returns text and the user commits; `code_review` is read-only in every `what` mode (`diff`/`docs`/`structure`)
- Thinking content, when the provider/model emits it, is streamed as `event: thinking` — never mixed into `token`
- **Automations add no LLM-visible tools**: automations are created and edited in the UI, never by the agent. An automation _run_ reuses this same schema list but is dispatched against a backend **static read-only subset** (`search_notes`, `list_tasks`); any other tool requested during a run — especially a write tool — is rejected before dispatch and is never parked for confirmation (GR-21, [docs/security.md](security.md) D10)
- GitHub reads validate selected repository access, cap/redact results, and use paginated API history beyond the shallow snapshot. Commit/PR selectors are mutually exclusive and required for GitHub drafts/reviews; local projects retain worktree behavior. No GitHub mutation route/tool exists; missing security access is unavailable, not passed. `github_context` stays outside the automation allowlist

## Versioning

The contract uses `/api/v1`. Breaking changes require a new version and a documented compatibility transition.
