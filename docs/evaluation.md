# Testing and evaluation

The executable project uses Vitest for the frontend unit suite, ESLint for source linting, and TypeScript/Vite for the production build. The backend evaluation cases below are a system-design specification. This checkout has no Python suite, model benchmark, evaluation runner, or live integration test.

## Frontend checks

Run from the workspace root:

```sh
npm test
npm run lint
npm run build
```

The colocated unit tests cover scenario matching, deterministic dates, canonical hashing, citation filtering, confirmation handling, validation, API invariants, chat cancellation, and sanitized Markdown. The test configuration is in `web/vite.config.ts`.

Fixture latency and model-evaluation values displayed by the application are samples, not measurements.

## Backend acceptance cases

These cases define coverage for a backend implementation; they are not existing automated suites.

| Layer       | Contract under examination                                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Tool adapters with fake dependencies: argument validation, command allowlists, path containment, and selected-repository access  |
| Unit        | Chunk size/overlap and Markdown, HTML, and PDF parsing                                                                           |
| Integration | Scripted `LLMClient` loop: dispatch, bounded iterations, audit records, and SSE event order                                      |
| Integration | Ingest fixture documents, retrieve relevant chunks, and verify citations against the retrieved set                               |
| Integration | [Guardrail test specifications](security.md#test-specifications), including GR-1–GR-23                                           |
| Integration | Scoped mailbox trigger, read-only automation loop, deduplication, hourly caps, notification records, and fake delivery transport |
| Model smoke | Knowledge, work, and code conversations against the configured provider                                                          |
| Device      | Heartbeats, scoped credentials, private-filtered briefs, and streamed WAV playback                                               |
| Manual      | Browser recording/playback, microphone-permission failure, and physical-button failure handling                                  |

A fake provider and fake mailbox keep deterministic policy checks independent of external accounts. Live provider and hardware checks need separate evidence. Citation integrity follows GR-19, and unavailable checks fail closed under GR-18.

## Evaluation corpus

| Scope           | Design corpus                                                          | Purpose                                              |
| --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| Core knowledge  | 10 knowledge questions                                                 | A smoke check for retrieval and citation regressions |
| Cross-domain    | 25 questions, five each for knowledge, work, code, email, and security | Answer quality and tool discipline across domains    |
| Retrieval pairs | 10 query-to-expected-chunk pairs                                       | Deterministic retrieval checks                       |

Each question records its expected relevant notes or chunks and a rubric for required facts, source citations, and tool use. Corpus and configuration identities belong in the report. A golden set stays fixed; exploratory seed material belongs in a separate development corpus.

## Metrics

1. **Retrieval:** hit@5 and mean reciprocal rank. Report the hit count and denominator, plus the MRR score.
2. **Answer quality:** correct, partially correct, or wrong; record cited-correct-source separately. Grade the post-verification answer shown to the user (D4b), rather than raw provider output.
3. **Tool discipline:** proportion of sessions selecting the correct tool first; repeated or unbounded loops count as failures.
4. **Latency:** median first-token and complete-answer duration, grouped by provider/model.

A model judge uses a fixed rubric and prompt, ideally with a different model from the answer provider. Its output must remain distinguishable from human grading.

Reports record provider/model identity, embedding/chunking configuration, corpus identity, raw counts, observed variability, and any measured before/after comparison. Only knowledge questions contribute to knowledge-specific retrieval and citation metrics; a cross-domain total is not their denominator.

## Regression checks

Embedding changes, provider/model changes, chunking changes, and system-prompt changes require evaluation against the same corpus.

- Run deterministic retrieval metrics once with a frozen corpus and fixed embeddings.
- Run stochastic answer-quality checks three times and report the observed range.
- Flag a drop of at least two questions outside that range for review; at 10 questions this is 20 percentage points, and at 25 questions it is 8.
- Record any accepted regression and its reason alongside the measured result.
- Expand coverage for missing cases without retuning the existing golden questions to improve scores.

## Fixture requirements

- **Repository:** a small dependency project with a known advisory and a fake detector sample. Scans must identify the findings without echoing a credential value.
- **Mailbox:** fictional messages with stable IDs, sender/subject/body fields, and selected-message reply-draft cases.
- **Prompt injection:** hostile instructions in notes, email, web text, repository content, and tool output, plus distractor notes on the same topic (GR-4-T1/T2, GR-20-T1/T2).
- **Automations:** matching, non-matching, and duplicate triggers; scope boundaries; fake Telegram transport; private-content exclusion; capped delivery bodies (GR-21, GR-22).
- **GitHub:** fake App/API responses and a controlled repository fixture for selected access, history/diffs, source-linked drafts, redaction, private routing, unavailable checks, and stale/disconnected state (FR-29, GR-23-T1…T5).

These backend fixture requirements do not describe files already present in the checkout.

## Design acceptance criteria

| Criterion                              | Target                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| Core retrieval hit@5                   | At least 8/10                                                                              |
| Core retrieval MRR                     | At least 0.60                                                                              |
| Core correct-or-partial human grades   | At least 8/10                                                                              |
| Core cited-correct-source              | At least 8/10                                                                              |
| Core tool-loop failures                | Zero across 20 conversations covering the four core tools                                  |
| Cross-domain correct-or-partial grades | At least 20/25                                                                             |
| Tool-loop failures in extended checks  | Zero across 50 evaluation runs                                                             |
| Real-provider smoke conversations      | 3/3 pass                                                                                   |
| Confirmation                           | Stored arguments, single use, denial, expiry, replay rejection, and modification rejection |
| Citation integrity                     | Every verified citation belongs to the per-request retrieved set                           |
| Backup recovery                        | A restored database supports the expected application contracts                            |

No result is established until an implementation has produced a report with the relevant commands, configuration, and measured evidence.
