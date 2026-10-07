# Ciel frontend demo

A frontend-only simulation of Ciel, an IT assistant for notes, tasks, and everyday operations. The app includes all 12 workspace screens, an unlock screen, 15 scripted chat scenarios, and a Build Map that connects the interface to the system design.

No backend, API key, model provider, Gmail account, microphone, or physical device is needed. All workspace data is fictional and held in memory. Reloading resets the workspace and locks access; the bearer token is never persisted to browser storage.

## Run locally

Use Node.js and npm. Run these commands from the repository root:

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Select **Use demo token**, then **Unlock workspace**. The demo validates token format; it does not authenticate against a server.

To build and serve the production bundle:

```sh
npm run build
npm run preview
```

Open the local URL printed by Vite. The production build includes the PWA manifest, bundled fonts and icons, and a static-shell service worker. API routes use `NetworkOnly`; API and health routes are excluded from navigation fallback. Use the production preview to inspect that behavior.

Run the unit suite and lint checks separately:

```sh
npm test
npm run lint
```

## Explore the demo

- **Flow Explorer** opens from the lower-right button or sidebar. Its 14 guided entries cover S1–S14. S3 combines confirmed note capture and indexing; S15 is the unmatched-input fallback. Run an entry to watch its prompt type and submit automatically, then inspect the resulting tool steps and backend explanation.
- **Dev Lens** (`Shift+D`) shows endpoint and requirement labels. Its toolbar selects normal, loading, empty, and error views, injects an unverified citation, and runs forced error scenarios.
- **Settings → Available tools** switches between all add-ons and the four core tools: `save_note`, `search_notes`, `add_task`, and `list_tasks`. All add-ons are enabled initially.
- **Settings → Reset demo data** restores the seed. **Replay tour** clears exploration progress. Theme, density, motion preferences, and all edits stay in memory.
- **Build Map** describes the endpoints, data model, guardrails, and integration assumptions.

Useful first flows: ask about Tailscale to inspect citations; request the Friday TLS reminder to approve or deny an exact write; open private homelab context and then request a web search to inspect the session's local-only policy.

The clock is fixed at **Sunday, 4 October 2026, 09:30 Asia/Manila**. “Yesterday” resolves to 3 October, and “Friday at 5pm” resolves to 9 October 2026 at 17:00 UTC+08.

| Shortcut                  | Action                                               |
| ------------------------- | ---------------------------------------------------- |
| `Ctrl+K` / `⌘K`           | Search notes, tasks, sessions, and actions           |
| `Shift+D`                 | Toggle Dev Lens                                      |
| `g`, then `c` / `n` / `t` | Open Chat / Notes / Tasks                            |
| `?`                       | Open keyboard help                                   |
| `Enter` / `Shift+Enter`   | Send a chat message / insert a newline               |
| `Enter` in confirmation   | Approve the focused action                           |
| `Escape`                  | Deny a pending confirmation, or close another dialog |

## Project structure

```text
web/
  public/                  Local favicon and PWA icons
  scripts/                 Icon generation
  src/
    App.tsx, routes.tsx    Authenticated shell and lazy-loaded routes
    api/
      contract.ts          Request, response, error, and SSE types
      client.ts            CielApi interface: 26 endpoint methods
      index.ts             Selected API implementation
      demo/
        DemoApi.ts         In-memory endpoint implementation
        db.ts, seed/       Fictional tables and initial data
        agent/             Matcher, scenarios, streaming, and guardrails
    design/                Shared primitives, original logo, and Sage Core
    features/              Twelve workspace screens, unlock, shell, and tour
    features/buildmap/     Build Map UI and shared documentation catalog
    state/                 In-memory Zustand stores
    lib/                   Markdown, citations, hashing, dates, and helpers
    styles/                Tokens, layout, and reduced-motion styles
  README.md                Frontend usage and implementation guide
docs/                      Repository-level documentation
```

The implementation uses React 18, Vite, strict TypeScript, React Router, Zustand, Tailwind CSS, local Fontsource fonts, and sanitized Markdown. The test files cover the matcher, fixed-clock dates, canonical hashing, citation filtering, confirmations, validation, and API invariants.

## API adapter boundary

The app consumes `CielApi` from `src/api/client.ts`. The selected implementation is `DemoApi`, constructed in `src/api/index.ts`. This interface covers chat/session operations, confirmations, notes/retrieval, tasks/projects, daily brief/audio, device status, audit, and health.

The [backend API specification](../docs/api.md) defines `/api/v1` routes, with `/healthz` and `/readyz` at the root. The interface's SSE event names are:

```text
thinking  token  tool_call  tool_result  tool_confirm  citations  done  error
```

A server adapter must forward cancellation, preserve partial replies, support parked confirmations, and keep the bearer token in memory. The backend must independently bind stored arguments and tool-call IDs, enforce five-minute expiry, and consume decisions atomically.

Session-title edits, note-tag edits, derived chunk metadata, referenced-chat lookup, and some list/session envelopes are frontend-specific assumptions. They are not published server endpoints.

## What the simulation means

- Chat answers and tool results are scripted. Search uses deterministic lexical scoring, not embeddings; chunk token counts are character-based estimates. Provider labels, health latency, evaluation results, advisory data, and scans are fixtures or sample values.
- Voice capture replays an editable Taglish transcript without requesting microphone access. TTS and brief playback generate a valid local 16 kHz mono PCM WAV calibration tone, not synthesized speech.
- Project registration checks a fixture path allowlist. It does not inspect this computer's filesystem, resolve symlinks, or run scanners. Mailbox actions return summary and draft text only.
- The demo models approval hashes, citation verification, byte caps, token scopes, private routing, and audit classification in client code. Production authentication, authorization, isolation, rate limiting, retention, and privacy guarantees require independent backend enforcement.
- Markdown blocks external images and renders links as inert copyable text. Static assets are local. The service worker caches the app shell; workspace content and bearer tokens remain in memory.

Lighthouse scores and animation frame rates are not represented as measured results.
