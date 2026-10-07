# Contributing to Ciel

Thank you for your interest in contributing to Ciel. This document describes
the development workflow, code conventions, and contribution checklist.

## Prerequisites

- Node.js 25.6.1 (see `.nvmrc`)
- npm 11.9.0

## Setup

From the repository root:

```sh
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Select **Use demo token**, then **Unlock workspace**.

## Development workflow

1. All work happens in the `ciel-web` workspace.
2. Write code following the existing conventions (see below).
3. Add or update tests for your changes.
4. Ensure all checks pass before opening a pull request.

## Code conventions

- **TypeScript**: strict mode is enabled (`tsconfig.json`). No `any` (`eslint`
  enforces `@typescript-eslint/no-explicit-any`).
- **Style**: Prettier enforces formatting. Run `npm run format` before committing.
- **React**: function components with hooks. Components are in `src/features/`
  and `src/design/`.
- **State**: Zustand stores in `src/state/`.
- **API**: the `CielApi` interface in `src/api/client.ts` is the boundary
  between the UI and the data layer. The in-memory `DemoApi` implementation
  lives in `src/api/demo/`.
- **Styling**: Tailwind CSS utility classes and CSS modules in `src/styles/`.
- **Tests**: colocated `src/**/*.test.ts` files using Vitest.

## Running checks

All from the repository root:

```sh
npm test       # vitest run — unit tests
npm run lint   # eslint src
npm run format # prettier --write .
npm run build  # tsc -b && vite build
```

## Pull request checklist

- [ ] Tests added or updated for the change
- [ ] `npm test` — all tests pass
- [ ] `npm run lint` — no errors
- [ ] `npm run format:check` — no formatting issues
- [ ] `npm run build` — builds without errors
- [ ] TypeScript compiles without errors (`tsc --noEmit`)
- [ ] No new `console.log` or debug statements
- [ ] No secrets, tokens, or credentials committed

## Reporting issues

Use the [Security Policy](SECURITY.md) for security vulnerabilities. For all
other issues, open a GitHub issue with:

- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (Node version, browser)
