# Core system specification

The core scope is notes, retrieval, tasks, and streaming chat with four agent tools. This is a backend/system contract; the runnable checkout is the [frontend simulation](../ciel-web/README.md). Client fixtures demonstrate flows without a database, model service, embeddings, or server authentication.

## Functional requirements

Requirement identifiers remain stable across the [architecture](architecture.md), [API](api.md), and [security](security.md) specifications.

- **FR-1:** capture notes through text, form, or chat.
- **FR-2:** generate a short summary and two to five tags per note through structured model output, subject to private-content policy.
- **FR-3:** answer questions over stored notes with note/section citations and time-range/tag filters.
- **FR-4:** store notes with topic domains such as networking, security, and projects.
- **FR-5:** create/list tasks through the agent; update them through the UI, including status, due date, and optional project.
- **FR-20:** stream chat responses and show tool-call steps.
- **FR-21:** provide a responsive, installable web PWA.
- **FR-22:** inspect tool-call audit records and result status.
- **FR-23:** confirm agent-initiated writes against the tool-call ID and stored arguments, with single use, five-minute expiry, and user-token scope; mark model-written notes with model origin.

## Non-functional requirements

The complete requirement set is in the [architecture specification](architecture.md#non-functional-requirements).

| Identifier | Core requirement                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1      | No mandatory recurring subscription                                                                                                                |
| NFR-3      | Target first token below 1.5 s from the configured cloud provider and typical tools below 5 s; measure on the deployment                           |
| NFR-5      | Restart after failure and preserve committed database state                                                                                        |
| NFR-6      | No telemetry; owner-controlled storage                                                                                                             |
| NFR-7      | Scoped bearer authentication, TLS, and deployment-secret configuration; health routes and state-validated callbacks have the documented exceptions |
| NFR-8      | Repeatable evaluation with recorded configuration/results                                                                                          |
| NFR-10     | One user, fewer than 10,000 notes and 500 tasks                                                                                                    |
| NFR-11     | Relative-date resolution in the configured timezone; default Asia/Manila                                                                           |

## System boundaries

| Area         | Contract                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | FastAPI/Python, PostgreSQL/pgvector, React/Vite/TypeScript, container deployment                                                                          |
| Notes        | Text/URL-as-text capture, summary/tags, section-aware chunks, local embeddings, filtered search, verified citations                                       |
| Chat         | SSE events, tool-step display, collapsed thinking content, and resumable confirmation                                                                     |
| Provider     | A narrow `LLMClient` interface with model identity in configuration                                                                                       |
| Core tools   | `save_note`, `search_notes`, `add_task`, and `list_tasks`; reject unknown tools before dispatch (GR-1)                                                    |
| Confirmation | Store exact arguments and hash, park the turn, require user approval/denial, expire after five minutes, consume once (GR-2)                               |
| Tasks        | Agent create/list; UI patch; relative due dates use the configured timezone                                                                               |
| Data         | `notes`, `chunks`, `tasks`, `sessions`, `messages`, `tool_calls`, and `pending_confirmations`; schema-owner migrations and a least-privilege runtime role |
| Web          | Chat, note capture/retrieval, tasks, audit, and responsive PWA shell                                                                                      |
| Evaluation   | Fixed knowledge questions, retrieval pairs, human answer grades, and policy acceptance cases                                                              |

Project registration, code/security scanning, mailbox access, voice recognition/synthesis, device integration, and connection/automation contracts are separate scope boundaries described in the architecture and API specifications. The simulation has fixture screens for several of these domains.

## Privacy and data rules

- Private notes carry `private=true`; private embeddings and model processing stay local (D1/D3).
- With a cloud provider configured, private notes use an extractive summary and no model-generated tags. A missing local provider must not silently send private material to the cloud.
- Private content makes the session local-only for its lifetime (D2). Web search is blocked for that session (D8).
- Agent-created notes carry `origin='model'` and remain untrusted retrieved data (GR-20).
- Audit arguments for private calls and confirmable writes contain length/hash metadata rather than raw text (D5).
- Fixture content is fictional or public-domain material without real private documents or credentials.

## Time rules

Resolve relative dates in `CIEL_TIMEZONE`, defaulting to Asia/Manila. A bare weekday means today when it matches, otherwise the next occurrence. Date-only due dates resolve to local end of day. Note-search ranges compare creation timestamps in that timezone. The frontend simulation uses its separate fixed demo clock.

## Acceptance criteria

The [evaluation specification](evaluation.md#design-acceptance-criteria) defines metric denominators and evidence requirements.

| Criterion                       | Core target                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Retrieval hit@5                 | At least 8/10                                                                                                         |
| Retrieval MRR                   | At least 0.60                                                                                                         |
| Correct-or-partial human grades | At least 8/10                                                                                                         |
| Cited-correct-source            | At least 8/10                                                                                                         |
| Tool-loop failures              | Zero across 20 conversations covering all four tools                                                                  |
| Confirmation                    | Approve executes original arguments once; deny/expiry execute nothing; replay and altered arguments fail (GR-2-T1…T6) |
| Citation integrity              | Presented verified citations belong to the retrieved set; violations are labelled and audited (GR-19-T1…T3)           |
| End-to-end behavior             | Seeded capture, retrieval, task mutation, and audit flows satisfy the API contracts                                   |
| Documentation                   | Actual setup commands, architecture, limitations, and measured evaluation evidence                                    |

These targets describe acceptance of the system design. They are not passing backend results from this checkout.
