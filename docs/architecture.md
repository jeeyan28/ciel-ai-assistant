# System architecture specification

> Design specification. See the README for current implementation status.

This document defines the system design and its backend contracts. The executable checkout contains a frontend simulation in `web/` and a backend foundation in `backend/` (a FastAPI app with health checks, and Docker Compose with PostgreSQL and pgvector); it has no model integration, mailbox connection, or device firmware yet. See the [frontend README](../web/README.md) for implemented behavior and commands.

## Scope & Requirements

Ciel is a personal, single-user AI IT assistant: one LLM agent with a swappable tool set, driven over a web PWA, with optional add-ons (coding/security/email tools, voice, a physical button).

**Stable numbering:** FR, NFR, GR, and decision identifiers remain consistent across the specifications.

- **Core functional requirements** (FR-1–FR-5, FR-20–FR-23): [core system specification](mvp.md).
- **Project, coding, security, email, and device requirements** (FR-6–FR-19): the component contracts below and the [API specification](api.md).
- **Connection and automation requirements** (FR-24–FR-29):
  - **FR-24:** connect and disconnect Gmail/Telegram with scoped access and encrypted credentials; disconnecting revokes dependent access.
  - **FR-25:** create, enable, disable, and delete automations with email or manual triggers, user-authored instructions, and declared notification channels.
  - **FR-26:** manually run an automation and inspect its status, tool steps, notification, and delivery history.
  - **FR-27:** match email triggers, execute a read-only agent loop, and create a notification.
  - **FR-28:** list, read, and dismiss in-app notifications; record Telegram delivery status.
  - **FR-29:** connect a read-only GitHub App and select repositories; browse files, history, branches, pull requests, issues, discussions, checks, and available security results; return source-linked analysis and copyable commit/review drafts. Repository mutations are excluded.
- **Non-functional requirements:** the targets below.

### Non-functional requirements

- **NFR-1 Cost**: no mandatory recurring subscription.
- **NFR-2 Portability**: same codebase runs on a home PC or a small VPS by changing config only.
- **NFR-3 Latency**: target first streamed token < 1.5 s with the configured cloud provider and < 5 s with a local CPU model; typical tool execution < 5 s, with subprocess tools capped at 10 s. These are design targets, not measured frontend results.
- **NFR-4 Availability**: target 99% during the configured operating window. The ESP32 must degrade gracefully when the backend is down (silence, not crash).
- **NFR-5 Reliability**: auto-restart on crash (Docker), no data loss on crash (Postgres durability).
- **NFR-6 Privacy**: no telemetry; data only in user-controlled Postgres; provider calls limited to text the user chose to process.
- **NFR-7 Security**: single-user bearer-token auth on business endpoints; connection callbacks require one-time state bound to an authenticated initiation; TLS in transit (Caddy/Tailscale); secrets only via environment (see [docs/security.md](security.md)).
- **NFR-8 Eval-ability**: a repeatable eval suite runs in one command; results are documented.
- **NFR-9 Observability**: structured logs; every tool call recorded in an audit table.
- **NFR-10 Scale target**: single user, <10k notes, <500 tasks. No horizontal scaling required.
- **NFR-11 Time**: default timezone Asia/Manila, configurable (`CIEL_TIMEZONE`); all relative-date resolution uses it.

### Out of scope (explicit)

- Multi-user / accounts / team features
- Auto-sending email or any irreversible action without user approval — **except** automation notifications, which are pre-authorized at the moment the user enables the automation (standing, revocable scope: read → run → notify only; [docs/security.md](security.md) D10)
- Arbitrary command execution / shell access from the agent
- Fine-tuning or training models (provider-pluggable inference only)
- Public deployment with real data. Private deployment by default; the only public-facing mode is **DEMO MODE**: fake seed data only, canned/scripted responses, no real tokens/notes/email, rate-limited
- Multi-device note sync beyond one user's own devices
- Complex multi-agent orchestration (one agent, one tool loop, max 4 iterations)
- Custom PCB / multi-sensor hardware (button + speaker only)

## Architecture Style

**Modular monolith** with a **tool-adapter pattern** (hexagonal-lite) at the agent boundary.

Rationale:

- Single-user, single-availability-domain → microservices are pure overhead (network hops, 10× the deploy surface) and would signal the wrong tradeoff at this scale.
- One FastAPI app, one Postgres, clearly separated internal modules (agent, tools, data, voice). Each module has a clean internal interface, so module boundaries isolate agent, tool, data, and voice responsibilities.
- The **tool boundary is the hexagonal part**: the agent core only knows tool _schemas_ (ports). Every tool is a swappable _adapter_ (for example, Gmail or Microsoft Graph for email; Groq, Gemini, or Ollama for models).

```text
┌─────────────────────────── Clients ──────────────────────────┐
│  Web + PWA (React/Vite)   PWA on phone   ESP32 Button (opt)  │
└───────────────┬───────────────┬──────────────────┬───────────┘
                │ HTTPS (Tailscale / Caddy)        │ LAN (or subnet router)
┌───────────────▼───────────────▼──────────────────▼───────────┐
│                    API GATEWAY (FastAPI)                      │
│  auth (bearer tokens) · rate limit · SSE · audit write        │
├──────────────────────────────────────────────────────────────┤
│                    AGENT CORE                                 │
│  orchestrator (chat loop, tool dispatch, guardrails)          │
│  LLMClient abstraction ──┬──────────┬──────────┐             │
│                          Groq      Gemini    Ollama (local)   │
├──────────────────────────▼──────────▼──────────▼─────────────┤
│  TOOL ADAPTERS (one module per tool, schema + impl)           │
│  knowledge: save_note · search_notes · daily_brief            │
│  work:      add_task · list_tasks · update_task · status      │
│  code:      git_context · code_review · commit_message        │
│            dependency_scan · vuln_scan · threat_lookup         │
│  github:    github_context (selected repositories, read-only) │
│  email:     email_unread_summary · email_draft (add-on)       │
│  web:       web_search                                        │
│  device:    device_status                                     │
├──────────────────────────────────────────────────────────────┤
│  AUTOMATION ENGINE (add-on)                              │
│  email poller · run executor (read-only loop) · notifier      │
├──────────────────────────────────────────────────────────────┤
│  DATA LAYER                                                   │
│  Postgres (notes, chunks+pgvector, tasks, projects,           │
│            sessions, messages, audit, device,                 │
│            connections, automations, runs, notifications)     │
│            · file store                                       │
├──────────────────────────────────────────────────────────────┤
│  VOICE PIPELINE (add-on)                                      │
│  STT: whisper.cpp (service)   ·   TTS: Piper (WAV)            │
└──────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### 1. Ciel Web (React + Vite + TypeScript PWA)

- Chat UI with streaming tokens + **tool-step badges** ("searching notes... 3 found") + confirm/deny dialog for parked turns
- **Single origin**: Caddy serves the built UI and reverse-proxies `/api/*`, `/healthz`, `/readyz` to the api service — the browser talks to one origin, so there is **no CORS** anywhere and `connect-src 'self'` holds. The token travels in an `Authorization` header, so streaming uses **`fetch` + a ReadableStream reader, not `EventSource`** (EventSource cannot send headers, and a token in the query string would leak into logs — see GR-10)
- **Service worker caches only static shell assets — never `/api/*`** (network-only for all API routes): a stale cached response must never mask a fresh audit/confirm state
- CSP (served by Caddy, also listed in [docs/security.md](security.md)): `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'`. The `style-src` exception is deliberate (React sets `style` attributes; styles are a far lower-risk surface than scripts) — scripts get no exception
- Note capture form, task list view, projects view, audit view
- GitHub uses **Connected apps → select repositories → Projects**. The project view presents files/README, commits/diffs, branches, pull requests and existing reviews/comments, issues/comments, workflow checks, and security findings. Chat explains the selected project/change and returns copyable commit-message or review drafts. Status shows GitHub activity/checks/security and refresh time. These connection views are outside the shipped simulation
- Installable PWA (manifest + service worker); **this is also the mobile experience** — no separate app
- Markdown output is sanitized: external images are never auto-rendered (exfiltration vector, see [docs/security.md](security.md))
- _Failure mode_: offline → cached shell, chat unavailable; acceptable.

### 2. Mobile (PWA of component 1)

- Responsive web app + browser push-to-talk via MediaRecorder (webm/opus) → POST /voice → agent reply, optionally spoken via TTS (WAV playback in the browser)
- _Failure mode_: same as web; adds mic permission handling.

### 3. Ciel Button (ESP32, optional add-on)

- One button, I2S amp (MAX98357A) + small speaker
- Press → HTTPS `POST /brief/voice` (server generates brief JSON → TTS WAV → streams to ESP32) → firmware plays raw PCM to the I2S amp **as it streams in** (chunked I2S writes, **no full-file buffering in RAM**). **No audio decoder in firmware**
- **Audio format: 16 kHz mono 16-bit WAV**, and the daily brief is **capped at ~30 s** (TTS truncates; text remains in the UI). Size: 16 kHz × 16-bit mono = 32 KB/s, so a full 30 s brief ≈ **960 KB (≈ 1 MB)** — comfortably streamable on a LAN
- **WAV is a deliberate choice over MP3**: Piper outputs WAV natively and PCM-to-I2S is trivial on ESP32. An ffmpeg MP3 step + firmware MP3 decoder are only added if file size actually becomes a problem
- **Networking**: the ESP32 cannot run Tailscale. It reaches the server either (a) on the **same LAN** as the server, or (b) through a **Tailscale subnet router** that serves the server's LAN into the mesh
- **TLS**: for a private host with a self-signed certificate, the firmware **embeds the root CA** (NVS or compile-time). For a host with a public certificate (demo mode), system CAs suffice
- Heartbeat every 5 min → `POST /device/heartbeat`
- _Failure mode_: backend down → button does nothing (no crash loop; retry with backoff, max 3×)
- Auth: dedicated `DEVICE_TOKEN` (restricted scope: /device/_, /brief/_, /tts only)

**Hardware components:**

- ESP32 DevKitC (or ESP32-S3)
- MAX98357A I2S amplifier module
- 2–4 W, 8 Ω small speaker
- 6×6 mm tactile push button
- 10 kΩ resistor (button pull-up; or use the GPIO's internal pull-up)
- 470 µF electrolytic capacitor (bulk on the amp's VCC — check whether the module ships with one)
- Breadboard, jumper wires, USB-C 5 V power supply (≥ 500 mA)

**Wiring requirements:** match pins and electrical limits to the selected modules.

- Button: one leg to GND, the other to a GPIO (e.g. GPIO 5) with the 10 kΩ pull-up; debounce in firmware
- MAX98357A: VCC → 5 V (bulk capacitor to GND), GND → GND; **DIN ← ESP32 I2S data pin, BCLK ← I2S SCK, LRCLK ← I2S WS**; 8 Ω speaker to the module output
- ESP32 I2S: master mode, 16 kHz / 16-bit / mono; PCM chunks written straight from the HTTPS stream to I2S (no full-file buffering)
- Power: 5 V supply; the amp's I2S inputs tolerate 3.3 V logic

### 4. API Gateway (FastAPI)

- GitHub Connect uses GitHub App authorization and repository selection. Initiation requires the Ciel user token; callbacks validate expiring, single-use state and account/installation ownership. The backend checks that each project belongs to the authorized installation before serving fresh data
- All business routes under `/api/v1`; the health endpoints are the exception — `/healthz` and `/readyz` are served at the **root** (e.g. `http://localhost:8000/healthz`), not under `/api/v1`; bearer-token auth; per-client rate limits; SSE for chat; structured JSON logs
- Writes every tool call to the audit table (via agent-core callback)
- Health: `/healthz` (liveness), `/readyz` = Postgres reachable **and embedder loaded**, plus a **provider check cached for 30 s** reported as a `provider: up|down|unknown` field that **does not fail readiness** (a Groq outage must not make Docker restart-loop the api). When `/readyz` fails → 503 with a JSON body (both at the root, as specified in [docs/api.md](api.md))
- **Degrade, don't hang**: a provider `429`/`5xx` mid-stream surfaces as `event: error {code:"provider_rate_limited"}` with `retry_after` — no in-loop retry (the turn ends; the model's partial text stays visible in the UI). Request-size caps, rate-limit numbers, and SSE duration caps are the published values in [docs/security.md](security.md) → "Concrete default limits" (enforced as 429)
- **Log hygiene**: query strings are stripped from access logs (routes like `/notes?q=…` or `/tts?text=…` would otherwise persist user text in log files — GR-10/GR-15); tokens and `.env` values are never logged

### 5. Agent Core

- Orchestrates: user msg → LLM (with tool schemas) → tool dispatch → results back → repeat (max 4 iterations) → final answer
- Guardrails (backend-enforced; full table + IDs in [docs/security.md](security.md)): reject unknown tool names (GR-1); enforce per-tool argument schemas (pydantic, GR-11); timeout per tool (10 s); kill loop on repeated identical calls / >4 iterations (GR-13); fail-closed on any failed check (GR-18)
- **Write confirmation (resumable state machine)**: agent-initiated writes (save_note, add_task, update_task, project registration) are held as _pending_. The turn **parks** when a confirmable call is dispatched, and the parked state is **persisted server-side** (table `pending_confirmations`), so a dropped SSE connection or a backend restart never loses the turn:

  | State                         | Meaning                                               | Next states                                                                               |
  | ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
  | `running`                     | model turn in progress, tools dispatching             | `awaiting_confirm` (confirmable call) · `done` · `failed`                                 |
  | `awaiting_confirm`            | turn parked; `tool_confirm` emitted; decision pending | `running` (approve) · `running` (deny → model receives "user denied") · `expired` (5 min) |
  | `done` / `failed` / `expired` | terminal for this turn                                | —                                                                                         |

  Semantics: the decision is **bound to the tool-call id and the exact stored arguments** (approving one write never authorizes another; any arg drift = reject), pending confirmations **expire after 5 minutes** (auto-deny; the model receives "confirmation expired"), they are **single-use** (consumed by the first decision), and the endpoint accepts the **user token only** (device token → 403). Execution proceeds only on approve. **Parallel calls**: if one model response carries several tool calls, they are dispatched **sequentially in call order** and only **one confirmation may be pending at a time** — the turn parks on the first confirmable call, the rest stay queued in the parked turn; confirmations consume no extra loop iteration (the ≤4-iteration cap counts _dispatched_ tool calls). Client continues the parked turn with `POST /chat {session_id, continue:true}` (see [docs/api.md](api.md)); a reconnecting client re-attaches with `GET /sessions/{id}/stream`. Model-written notes are stored with `origin='model'` (see data model). Direct user-typed capture (`POST /notes`) never needs confirmation

- **Citation verification (GR-19)**: the backend records the retrieved chunk/note set for the request; answer citations use the marker format `[[n:<note_id>#<chunk_id>]]`, are checked as a **subset of that set before persistence/presentation**, and a violation is handled per D4a: strip the marker, label the text "unverified citation", audit event. The verified citation list is emitted as `event: citations` after the last token and before `done` (see [docs/api.md](api.md))
- GitHub uses the same verification for `[[g:<source_ref_id>]]`: retrieved repository/file/commit/item references carry revision/time and validated links; verified references are stored with messages for replay
- **Thinking tokens**: models may emit reasoning/thinking content (Qwen3 thinking mode, Groq reasoning models). It is exposed as a separate stream event type (see [docs/api.md](api.md)) and collapsed in the UI. Default: thinking off on the local 8B for speed
- `LLMClient` interface: `chat(messages, tools) → AsyncIterator[LLMEvent]` (events: token | thinking | tool_call | done). Implementations: `GroqClient` (default), `GeminiClient` (alternative), `OllamaClient` (optional local/private) — OpenAI-compatible wrappers
- Prompt manager: system prompt + per-tool one-line descriptions + context budget management (trim oldest tool results if context grows)
- **Time & date**: the system prompt injects the current date, weekday, and the user's timezone (`CIEL_TIMEZONE`, default **Asia/Manila**). Resolution rules — single source of truth: "yesterday" = today−1 in that tz; a bare weekday ("Friday") = today if today is that weekday, otherwise the next occurrence in that tz; date-only due dates resolve to end-of-day in that tz; note-search date ranges filter on `notes.created_at` converted to that tz

### 6. Tool Adapters

**GitHub adapter (FR-29)** belongs here alongside the coding/security adapters, within the same FastAPI application:

- **Data flow**: Web project picker/chat → gateway → GitHub adapter → selected-repository API reads or Ciel-owned code snapshot → existing code/security tools → agent answer/findings → web project view. Postgres holds connection identity, project/revision metadata, and the existing audit trail
- **Connection**: a GitHub App grants selected repositories read access to Contents/Metadata, Issues/Pull requests, Actions/Checks/Commit statuses, and available code-scanning/Dependabot/secret-scanning alerts. App credentials and short-lived installation tokens stay in the backend. No repository writes, posted comments/reviews, commits/pushes, merges, workflow triggers, alert dismissal, or settings changes are available
- **Repository context**: `github_context` reads all agreed project views; `project_status` includes the GitHub overview. Use paginated API history and selected-commit/PR diffs; the bounded shallow clone supplies code for local analysis. `code_review` and `commit_message` use an explicit selected change and return feedback/text for copying; local worktree drafts use the registered project path
- **Safety**: reuse code review, dependency audit, and redacted secret scanning, together with GitHub's available alerts. Do not install/run repository scripts. Results identify the source, inspected SHA, time, evidence, and partial/unavailable coverage; GitHub alerts keep their reported revision/scope. Private repository metadata, discussions, code, and findings follow local-model routing; connection credentials stay outside the scanner, and detected secret values are redacted before results reach the UI or model
- **Access and status**: refresh/sync on user request; removed access blocks new connected reads/analysis. Retained snapshots/results show their original revision/time and stale/offline state. Project status means GitHub activity/checks/security, with no deployed-app monitoring or GitHub-triggered automations

Each tool module = `{name, description, args_schema (pydantic), run → ToolResult(ok, data, error)}`. Groups and schemas: [docs/api.md](api.md) (single source of truth).

- knowledge: Postgres + pgvector queries; `search_notes` supports time-range + tag filters. **Tags are validated server-side** (normalize to lowercase; ≤ 10 tags, ≤ 32 chars each, charset `[a-z0-9-_]`), not just by the model's schema. **Private notes (D1)**: embeddings are always local (fastembed — D3); with a cloud LLM, a `private=true` note is **never sent to a cloud LLM for summary/tags** — use an extractive summary and no automatic tags when a local provider is unavailable
- code/security: **subprocess allowlist only** — `git (status|log|diff|show)`, `npm audit`, `pip-audit`, `cargo audit`, `govulncheck`, `gitleaks --redact` — with cwd pinned to a registered project path (path whitelist, no traversal). A forbidden-file deny-list hit (`.env*`, `id_rsa*`, `*.pem`, `*.key`) is **skipped and flagged in the scan result, never returned to the model (D9)**. Audit/scan tools may execute package build code, so they run in a **separate scanner container**: read-only mount of the project, no secrets, egress limited to package registries. gitleaks output always passes `--redact` before it can reach any LLM. **`code_review` takes `what: diff|docs|structure`**: `diff` (default) reviews the working diff or pasted code; `docs` reviews README + all `*.md` for clarity, structure, and professionalism; `structure` reviews the folder layout and flow. All three are read-only (no confirmation), capped at 8 KB, and obey the deny-list. **Ciel never runs `git commit` or `git push` (GR-6 unchanged)** — `commit_message` returns text and the user commits themselves
- email (add-on): Gmail API via OAuth, `gmail.readonly` scope only. `email_unread_summary` returns message IDs + summaries; `email_draft` takes a message_id and returns LLM draft text shown in the UI — Ciel never writes to Gmail. The same connection object (scopes, encrypted refresh token, re-auth flow) is used by the automation poller (component 10), which reads new mail through it under the connection's scopes
- notification (add-on): Telegram Bot API over fixed-host HTTPS `sendMessage` (`api.telegram.org` only — no user-controlled URL, so no SSRF surface); one attempt per delivery, status recorded on the notification row (GR-22)
- web: one search provider (e.g. Brave/Tavily/DuckDuckGo) — swappable; `web_search` is **fail-closed blocked when the session contains private content** (backend policy, D8 — see [docs/security.md](security.md) GR-8)
- device: read device table; device-scoped outputs exclude private-flagged material (D7)

### 7. Data Layer

- Postgres 16 + pgvector
- Tables: `notes`, `chunks`, `tasks`, `projects`, `sessions`, `messages`, `tool_calls`, `pending_confirmations`, `device`, plus connection and automation tables `connections`, `automations`, `automation_runs`, `notifications`
- **Ingestion is async**: `POST /notes` (and agent `save_note`) returns **202** with `status:"pending"`; parsing → chunking → embedding run in the background and flip `notes.status` to `ready` (or `failed` + error). `POST /notes/search` only matches `ready` notes. The confirm dialog and chat show the note as "indexing…" until then
- File store: raw audio + generated TTS WAV (local disk, temp-cleaned; WAV files are larger than MP3, so the retention window is shorter — see voice pipeline)

### 8. Voice Pipeline (optional add-on)

- STT: whisper.cpp `small` model (CPU) behind an internal endpoint `/voice`
- TTS: Piper with a configured voice, or an equivalent adapter. The transport contract is **16 kHz mono 16-bit WAV**, with briefs capped at approximately 30 s. The ESP32 streams PCM to I2S without buffering the full file.
- CPU resource limits and audio latency require measurements on the deployment hardware.
- **Language coverage:** speech recognition and playback require representative Filipino/Taglish and English samples. Text remains the fallback for unsupported speech or poor audio quality.

### 9. Infra / DevOps

- Deployment boundaries: API, web, database, isolated scanner, speech recognition, and speech synthesis. The checkout's Compose file is a design reference with absent build contexts.
- Caddy: TLS termination (local CA; Let's Encrypt only for public demo mode) **and single-origin routing** — it serves the built PWA and proxies `/api/*`, `/healthz`, `/readyz` to api, so browser and API share one origin (no CORS; see component 1)
- Tailscale: phone + laptop reach the server without port-forwarding. The ESP32 cannot join Tailscale — it uses the LAN path or a subnet router (see component 3)
- Backup: nightly `pg_dump` + audio dir to a second folder (or USB)

### 10. Automation Engine (add-on)

Kept as its own component because it is the only part of Ciel that **starts work without a user in the loop**. It adds no new LLM-visible tools and no new service — it reuses the agent core, the connections, and the audit table.

- **Connections**: `gmail` (the OAuth connection — scopes, encrypted refresh token, re-auth flow) and `telegram` (bot token + chat id, AES-GCM at rest under `CIEL_ENCRYPTION_KEY`). Each connection carries **scope rules** enforced by the backend before any payload reaches the model: Gmail metadata (from / subject / date) always, the body only when `read_bodies` is opted in. Disconnecting a connection deletes its secrets and **blocks** every automation that depends on it (fail-closed, GR-18). GitHub uses the shared connection registry through the user-driven adapter in component 6
- **Trigger:** an in-process asyncio poller reads new Gmail messages every `CIEL_EMAIL_POLL_INTERVAL` (default 60 s), using a durable history cursor and at most 50 messages per cycle. Enabled email-trigger automations match the sender or domain and optional subject text; matching is case-insensitive.
- **Dedup + caps**: one run per `(automation_id, gmail_message_id)` — the same email never fires twice; 10 runs/automation/hour (`CIEL_AUTOMATION_MAX_RUNS_PER_HOUR`) **and 30 runs/hour globally — the caps compose**; excess triggers are skipped with one in-app notice + an audit event; `409 run_in_progress` if a run is already active for that automation
- **Run executor**: runs are rows (`queued → running → done | failed | blocked`) processed by **one in-process worker, FIFO, one at a time** (queue ≤ 20). A run opens a headless session (`sessions.source='automation'`), so audit, citation verification, and prompt assembly are the existing machinery. The tool loop is the chat loop restricted to the **static read-only allowlist** (`search_notes`, `list_tasks`): ≤ 4 iterations, 10 s/tool, 60 s wall-clock; write tools are rejected **before dispatch** and never parked (GR-21, D10); `search_notes` filters `private=true` notes out (D11); `web_search` and all subprocess/external tools are simply not in the allowlist. On `invalid_grant` from Gmail the connection flips to `reauth_required` and its automations go `blocked` with an in-app notice (reuses the GR-9 re-auth flow)
- **Notifier**: renders the run's answer into a notification row (title from the trigger, body ≤ 2000 chars), then delivers to the declared channels — in-app is the row itself; Telegram is one `sendMessage` attempt with status recorded in `deliveries`. A failed delivery marks the notification, never the run
- _Failure mode_: provider down → run `failed` with an error notification; poller cannot reach Gmail → connection `degraded`, automations stay enabled but idle; restart resumes from the stored cursor (Postgres is the durability layer — same pattern as note ingestion and the parked-turn tables)
- Auth: automation/connection business routes are user-token only (device token → 403), except state-validated provider callbacks; in demo mode (D6) connections cannot be created, runs execute against the canned fixture mailbox, and Telegram delivery is `skipped`

## Data Model

| Table                        | Key columns                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| notes                        | id, title, content, summary, tags[], source, origin (user/model), confirmed (bool), **private (bool, default false — D1)**, **status (pending/ready/failed)**, created_at, updated_at                                                                                                                                                                                                                                                  |
| chunks                       | id, note_id FK, text, heading (section heading for citations), embedding (pgvector; **768-dim for the default model** — dimension follows `CIEL_EMBEDDING_MODEL`), embedding_model, position                                                                                                                                                                                                                                           |
| tasks                        | id, title, description, status (todo/doing/done), due_at, project (free-text label in the core scope) or project_id FK (registered-project scope), created_at, updated_at                                                                                                                                                                                                                                                              |
| projects                     | id, name, path, language, private (bool), status (cloning/ready/failed; only ready projects reach tools), source (local/github), connection_id FK, github_repository_id, github_full_name, snapshot_sha, last_synced_at, created_at, updated_at                                                                                                                                                                                        |
| sessions                     | id, title, source (chat/automation), started_at, last_message_at                                                                                                                                                                                                                                                                                                                                                                       |
| messages                     | id, session_id FK, role, content, source_refs (jsonb, verified note/GitHub references), created_at                                                                                                                                                                                                                                                                                                                                     |
| tool_calls (the audit table) | **id = UUIDv4 (the confirm binding key)**, session_id FK, turn_id, tool, args (jsonb — **full for read tools; metadata-only (length + hash) for private-flagged and confirmable write calls, D5**), ok, error_code, duration_ms, created_at (retention 90 days)                                                                                                                                                                        |
| pending_confirmations        | **id (= tool-call id)**, session_id FK, turn_id, tool, args (jsonb, the exact stored args), args_hash, iteration, status (pending/approved/denied/expired/consumed), created_at, expires_at (+5 min), decided_at                                                                                                                                                                                                                       |
| device                       | id, name, last_heartbeat, status                                                                                                                                                                                                                                                                                                                                                                                                       |
| connections                  | id, provider (gmail/telegram/github), status (ok/degraded/reauth_required/revoked), scopes (jsonb — gmail: `read_bodies` bool; GitHub: granted read permissions), secret (nullable bytea — encrypted Gmail/Telegram credentials), cursor (gmail history id), github_account_id, github_installation_id, selected_repository_ids, created_at, updated_at; GitHub App credentials stay backend-only, installation tokens are short-lived |
| automations                  | id, name, enabled, trigger_type (email/manual), trigger_config (jsonb — `{sender, subject_contains?}`), connection_id FK, instructions (user-authored), notify_channels[] (in_app/telegram), last_run_at, created_at, updated_at                                                                                                                                                                                                       |
| automation_runs              | id, automation_id FK, trigger (email/manual), trigger_message_id (gmail message id — **dedup key**, unique with automation_id), session_id FK (the headless run session), status (queued/running/done/failed/blocked), error_code, started_at, finished_at                                                                                                                                                                             |
| notifications                | id, automation_id FK, run_id FK, title, body (≤ 2000 chars), deliveries (jsonb — `[{channel, status, error, sent_at}]`), created_at, read_at (null = unread); rows pruned after 30 days                                                                                                                                                                                                                                                |

Schema management uses Alembic migrations, including `CREATE EXTENSION IF NOT EXISTS vector`. Migrations execute as a schema-owner role; the API uses a least-privilege role with DML rights on its tables, without DDL, superuser access, or rights on other databases. Tool-call IDs are server-generated UUIDv4 values; `tc_N` strings in API examples are placeholders.

Search behavior: `chunks.embedding_model` is compared against the query's embedding model; a mismatch returns `embedding_model_mismatch` (409) instead of returning garbage across models.

## Request Lifecycle (chat)

1. Client → `POST /api/v1/chat` (SSE response); `{session_id, message, continue?}` — `continue:true` continues a parked turn instead of starting a new one
2. Gateway validates token, creates/loads session
3. Agent builds messages (system + trimmed history + user msg) and calls `LLMClient`
4. Stream tokens as `event: token` (plus `event: thinking` when the model emits reasoning content)
5. If tool_calls returned: emit `event: tool_call` → **confirmable?** (write tools) → persist the pending call in `pending_confirmations`, emit `event: tool_confirm`, then `event: done {status:"awaiting_confirm"}` and **close the stream** (turn parked). Otherwise dispatch to the adapter (schema-validated, timed out, audited) → emit `event: tool_result`
6. Client resolves the decision via `POST /sessions/{id}/confirm`, then re-opens the turn with `POST /chat {continue:true}` (or `GET /sessions/{id}/stream`) → back to step 5
7. Loop 3–5 until final answer or max 4 iterations (dispatched calls only; parked time costs no iteration)
8. Verify answer citations against the retrieved set (strip/label violations per GR-19/D4a), then emit `event: citations` with the verified list
9. Emit `event: done` with usage + session id; persist final message + audit rows

## Automation run lifecycle

1. **Trigger** — (email) the in-process poller fetches new mail via the Gmail connection (cursor on `connections`, ≤ 50/cycle) and matches sender/subject against each enabled email-trigger automation; (manual) the user's `POST /automations/{id}/run` — for an email-trigger automation this uses the most recent matching message, for a manual-trigger automation it runs the instructions alone
2. **Guard the trigger** — dedup (`automation_id + trigger_message_id`), rate cap (10/hour/automation), one-run-at-a-time, connection status `ok`, automation `enabled`. Any failed check → run row `blocked` (or trigger skipped) + audit event + one in-app notice — **fail-closed, no partial run** (GR-18, GR-21)
3. **Scope the payload** — connection scopes applied first (metadata always; body only if `read_bodies`); the trigger content is wrapped as data (GR-4)
4. **Open the run session** — headless session (`sessions.source='automation'`, title = automation name); queued run picked up by the single in-process executor (FIFO)
5. **Agent loop** — system prompt = automation `instructions` + date/tz; tools = read-only allowlist (`search_notes`, `list_tasks`); ≤ 4 iterations, 10 s/tool, 60 s wall-clock; write requests rejected before dispatch (never parked — D10); `search_notes` excludes `private=true` (D11); every tool call audited to `tool_calls` against the run session
6. **Finish the turn** — citations verified as usual (GR-19), final answer persisted on the run session, run → `done` (or `failed` + `error_code`)
7. **Notify** — build the notification (title from trigger, body ≤ 2000 chars, private content impossible by D11) → insert the row (in-app) → deliver Telegram if declared (one attempt, status into `deliveries`)
8. **Audit** — run, tool calls, and delivery outcomes are all inspectable: run detail endpoint for the automation view, existing `GET /audit/tool-calls` for the flat audit view

## Provider Abstraction (the portability core)

```python
class LLMClient(Protocol):
    async def chat(self, messages: list[Message], tools: list[ToolSchema]) -> AsyncIterator[LLMEvent]: ...
# LLMEvent ∈ {Token(text), Thinking(text), ToolCall(name, args), Done(usage)}

class GroqClient(LLMClient): ...     # cloud adapter
class GeminiClient(LLMClient): ...   # alternative cloud adapter
class OllamaClient(LLMClient): ...   # local/private adapter
```

Selection is defined by `CIEL_LLM_PROVIDER=groq|gemini|ollama` and `CIEL_LLM_MODEL`. Provider model IDs belong in deployment configuration. Private material requires local processing and has no cloud fallback; see [security](security.md). These variables are system-design contracts and are not consumed by the frontend simulation.

Runtime notes (single-user scale, NFR-10): the gateway runs **one uvicorn worker** — parked turns, confirmation state, and rate-limit counters are process-local, so the persisted tables (`pending_confirmations`, `tool_calls`) are the durability layer, not a multi-worker cache. Embeddings (fastembed/ONNX, CPU-bound and synchronous) run in a **thread pool** (`asyncio.to_thread`, one batch in flight) so embedding never blocks the event loop or SSE streaming. The automation poller and run executor are in-process asyncio tasks on that same worker: only one run executes at a time, and every piece of durable run state (Gmail cursor, queued run rows, dedup keys) lives in Postgres — a restart resumes cleanly.

## Deployment boundaries

| Topology        | Runtime                        | Model boundary                                                          | Access                                                                                 |
| --------------- | ------------------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| A — Home server | Owner-controlled PC or mini-PC | Configured cloud provider or local Ollama; private material stays local | Private mesh access; the ESP32 uses LAN or a subnet router                             |
| B — Private VPS | Owner-controlled VPS           | Configured provider; local processing is constrained by hardware        | Private mesh access                                                                    |
| D — Public demo | Isolated environment           | Scripted responses without provider credentials                         | Fictional data, separate storage/credentials, bounded requests, disabled device routes |

The private topologies require TLS, scoped authentication, backups, resource limits, and tested recovery. A public demo requires separate storage and credentials; a mode flag alone does not establish isolation (D6).

## Technology roles

The web implementation uses React, Vite, strict TypeScript, React Router, Zustand, Tailwind CSS, bundled fonts, and sanitized Markdown. Versions are recorded in the package manifests and root lockfile.

The system design assigns these roles:

| Role               | Design choice                                                        |
| ------------------ | -------------------------------------------------------------------- |
| Backend            | Python 3.12, FastAPI, Pydantic, one Uvicorn worker                   |
| Data               | PostgreSQL 16 with pgvector; Alembic migrations                      |
| Cloud models       | Groq or Gemini through the provider interface                        |
| Local models       | Ollama for private material                                          |
| Embeddings         | A local CPU embedder; fastembed/ONNX or an equivalent adapter        |
| Speech             | whisper.cpp recognition and Piper synthesis                          |
| Email              | Gmail OAuth with read-only mailbox access                            |
| Notifications      | In-app records and fixed-host Telegram delivery                      |
| Repository context | Read-only GitHub App; bounded credential-free code snapshots         |
| Scanner            | Allowlisted language audit tools and redacted gitleaks output        |
| Device             | ESP32, I2S amplifier, speaker, button, and scoped device credential  |
| Hosting            | Containers, Caddy for TLS/single-origin routing, private mesh access |
| Observability      | Structured logs, audit records, liveness/readiness contracts         |

### Embedding consistency

The design uses a 768-dimensional default embedding model and records its identity on every chunk. The local embedder runs in a thread pool with one batch in flight, keeping CPU-bound work outside the streaming event loop.

Model artifacts require an explicit identity, license, revision, and compatible query/document preprocessing. Download artifacts during image construction, pin the revision, and include the model in the image. Readiness depends on the embedder being loaded, rather than a runtime model download.

Task-prefixed models require distinct query and document prefixes in a shared wrapper. A model change must preserve dimensional consistency or migrate stored vectors. Search rejects a different embedding-model identity with `embedding_model_mismatch` (409).

### Version discipline

- Dependency versions belong in lockfiles; updates are explicit changes.
- Provider model identities and embedding revisions belong in configuration.
- Changes to models, chunking, or preprocessing require the evaluation checks described in [evaluation](evaluation.md).
- Hardware wiring must match the selected module pinout and electrical limits.

## Excluded architectural components

| Component                          | Reason                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| General agent framework            | The single-agent tool loop has a narrow interface and explicit policy enforcement |
| Redis or an external queue         | PostgreSQL is the durability layer at single-user scale                           |
| Kafka/event sourcing               | The audit table covers the stated event volume                                    |
| Managed application database       | The design uses owner-controlled PostgreSQL                                       |
| Separate native mobile application | The responsive PWA covers the mobile interface                                    |

## Known Limitations and Mitigations

Operational failure cases and the controls required by the system design:

| Limitation                                                                        | Likelihood/impact | Mitigation                                                                                                                                                                                                                                                                                                  | Early-warning signal                                                                                         |
| --------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Provider rate limits or policy changes                                            | M / M             | Provider interface, explicit error states, bounded requests, and local processing for private material                                                                                                                                                                                                      | Repeated 429 responses during ordinary use                                                                   |
| Local model produces invalid tool calls                                           | M / M             | Narrow tool descriptions, validated arguments, bounded iterations, and explicit tool errors                                                                                                                                                                                                                 | Repeated invalid arguments in one session                                                                    |
| Embedding/DB mismatch after a model swap                                          | L / M             | Model name pinned in config; `chunks.embedding_model` column; search returns `embedding_model_mismatch` (409) instead of returning garbage across models                                                                                                                                                    | Quality drop after an "upgrade" commit                                                                       |
| Retrieval quality is poor                                                         | M / H             | Evaluate against a fixed corpus; preserve measured retrieval and citation results when adjusting chunking or the embedding model                                                                                                                                                                            | Answers cite irrelevant notes                                                                                |
| STT CPU latency on slow hardware                                                  | L / M             | `small` (or `base` fallback) model; STT in a separate container so it never blocks chat; UI shows "transcribing"                                                                                                                                                                                            | Transcription >15 s for a 20 s voice memo                                                                    |
| Data loss or damaged storage                                                      | L / H             | Named volumes, encrypted off-host backups, and a tested restore procedure                                                                                                                                                                                                                                   | A restore fails or backups are unavailable                                                                   |
| Subprocess tools abused via path injection in `projects.path`                     | L / H             | Path must be under `/data/projects/` (symlink-resolved, canonicalized) at registration; allowlisted binaries only; no user-controlled args beyond the fixed command list                                                                                                                                    | gitleaks/npm audit called with a cwd outside the sandbox during dev testing                                  |
| ESP32 audio failure                                                               | M / M             | Adequate power, module-compatible I2S wiring, streamed WAV/PCM, and graceful silence on backend failure                                                                                                                                                                                                     | Silent or distorted playback                                                                                 |
| Prompt injection via retrieved notes / web / email content                        | M / M             | Controls are **backend-enforced, not prompt-only**: read-only tool surface + confirmation-gated writes (GR-4), citation verification before presentation (GR-19), model-written notes treated as lowest-authority data (GR-20) — full treatment in [docs/security.md](security.md) "Guardrails / AI Safety" | A write executes without a user decision, or an answer cites a chunk that was never retrieved                |
| Automation polling lag (up to one poll interval)                                  | L / L             | 60 s default interval, configurable 15–3600 s; manual "Run now" covers anything urgent; polling is forced by the Testing-status OAuth app (no Pub/Sub push)                                                                                                                                                 | An "urgent" email is noticed minutes late and the user switches the interval down                            |
| Unattended runs on hostile input / provider cost                                  | M / M             | Read-only allowlist + rate caps + 60 s wall-clock (GR-21); trigger content is data (GR-4); every run audited; enable/disable is one toggle                                                                                                                                                                  | A run's tool trace shows repeated identical calls, or hourly run counts sit at the cap with no user activity |
| Telegram as an external dependency (outage, bot revoked, chat deleted)            | M / L             | Delivery status recorded per notification, in-app notification still written; connection test button; PWA Web Push documented as the fallback channel                                                                                                                                                       | A cluster of `deliveries.status='failed'` rows in run details                                                |
| GitHub access removed, unavailable security results, or a huge/hostile repository | L / M             | Selected-repository read permissions; credential-free bounded snapshots (GR-23); explicit stale/partial/unavailable states, private routing, and no repository-script execution                                                                                                                             | Failed syncs, missing grants, or unavailable checks in the project view                                      |
