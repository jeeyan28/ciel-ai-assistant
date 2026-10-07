# Product — Demo Scope and Behavior

> **Scope:** This document describes the behavior of the **frontend simulation**
> that ships in this repository. The backend, database, model providers, and
> physical integrations described in the system architecture are **not
> implemented** in this checkout.

## What the Demo Does

The Ciel frontend is an interactive React/TypeScript simulation that models a
personal AI IT assistant. It runs entirely in the browser using an in-memory
data adapter — no server, database, or API key is required.

### Twelve Workspace Screens

| Screen          | Route       | Purpose                                                                    |
| --------------- | ----------- | -------------------------------------------------------------------------- |
| Chat            | `/chat`     | Streaming conversation with tool-call badges, confirmations, and citations |
| Notes           | `/notes`    | Library of notes with filtering, search, and retrieval testing             |
| Tasks           | `/tasks`    | Task board (todo/doing/done) with project grouping and due dates           |
| Projects        | `/projects` | Registered code projects with scan status and review actions               |
| Audit           | `/audit`    | Tool-call history with field classification (D5)                           |
| Brief           | `/brief`    | Daily briefing: yesterday's notes, today's tasks, reflection               |
| Voice           | `/voice`    | Simulated voice capture with Taglish transcript                            |
| Email           | `/email`    | Read-only mailbox with reply-draft generation                              |
| Device          | `/device`   | ESP32 desk button status and virtual button press                          |
| Health & Limits | `/system`   | Liveness, readiness, rate-limit usage, and configuration controls          |
| Build Map       | `/buildmap` | API endpoint catalog, data model, guardrails, and scenario reference       |
| Settings        | `/settings` | Theme (light/dark), density, reduced motion, add-on toggles                |

### Unlock Flow

- The user enters a 32+ character token (the demo token is `ciel_demo_only_2026_not_a_real_secret_token`)
- The token is held in memory only — never persisted to `localStorage` or `sessionStorage`
- Closing or reloading the tab locks the workspace

### Guided Scenarios (Flow Explorer)

14 scripted chat scenarios covering:

- **S1** — An answer with evidence (retrieval + citations)
- **S2** — Approve an exact action (date resolution + confirmation)
- **S3** — Absorb a new note (draft + capture + indexing)
- **S4** — See the week ahead (task grouping by date)
- **S5** — Retrieve a specific day (date range + tag filters)
- **S6** — Keep private work local (session-sticky local routing)
- **S7** — Ignore a planted instruction (prompt injection as data)
- **S8** — Reject an unknown tool (allowlist enforcement)
- **S9** — Inspect a repository scan (redacted findings + forbidden-file skip)
- **S10** — Review a code change (read-only diff + code review)
- **S11** — Read mail without sending (unread summary + reply draft)
- **S12** — Inspect an advisory (bundled CVE fixture)
- **S13** — Meet the desk button (device status + private-filtered brief)
- **S14** — Recover from an interruption (partial text preserved on error)
- **S15** — Unmatched input fallback (help text)

### Simulated Guardrails

The demo models these security policies in client code (production requires
server enforcement):

- **Tool allowlist** (GR-1): 4 core tools always available; 15 add-on tools
  when add-ons are enabled in Settings
- **Write confirmation** (GR-2): save_note, add_task, update_task, project
  registration — bound to tool-call ID + SHA-256 args hash, single-use, 5-min
  expiry, user token only
- **Private routing** (GR-3): private notes/projects keep the session local;
  web_search is blocked in private sessions (D8)
- **Citation verification** (GR-19): only retrieved note/section pairs survive
- **Audit classification** (GR-15): write/private tool args stored as
  metadata-only (length + SHA-256)
- **Rate limiting** (GR-14): 60 req/min, 3 concurrent streams
- **Size caps** (GR-11/GR-12): JSON 1MB, chat 32KB, note 256KB, tool result 8KB
- **Demo isolation** (GR-16): fictional data only, device endpoints disabled
  in public demo mode

## What the Demo Does NOT Do

- Does not connect to a real backend, database, or API
- Does not call any LLM provider
- Does not send or read real email
- Does not run scanners on a real filesystem
- Does not connect to real GitHub
- Does not use a real device
- Does not capture real audio or synthesize real speech
- All data is fictional and held in memory — reloading resets the workspace

## Demo Boundaries

- **Clock**: fixed at Sunday, 4 October 2026, 09:30 Asia/Manila
- **Search**: deterministic lexical scoring, not vector embeddings
- **Chunking**: character-based token estimates (characters / 4), section-aware
- **Project paths**: fixture allowlist only (`/data/projects/*` demo directories)
- **Voice**: replays a fixed Taglish transcript, generates a calibration tone
  (not speech), 16 kHz mono 16-bit WAV
- **Scans**: return canned fixture findings, never inspect this machine
- **TTS**: generates a local calibration tone, not synthesized speech
