# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `.nvmrc` specifying Node.js 25.6.1
- `.editorconfig` for consistent editor settings
- `.gitattributes` enforcing LF line endings
- Prettier configuration (`.prettierrc.json`, `.prettierignore`)
- `format` and `format:check` npm scripts
- `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- `AGENTS.md` for coding agent conventions
- `docs/DESIGN.md`, `docs/PRODUCT.md`, `docs/frontend-verification.md`

### Changed

- Formatted all source files with Prettier for consistent code style

## [0.1.0] — 2026-10-06

### Added

- Initial frontend simulation: React + Vite + TypeScript
- In-memory `DemoApi` adapter with 15 scripted chat scenarios
- Twelve workspace screens: chat, notes, tasks, projects, audit, brief,
  voice, email, device, health, Build Map, settings
- Zustand state management (auth, chat, demo, ui stores)
- Tailored design system with light/dark themes
- PWA with service worker (static shell caching only)
- Vitest unit test suite (88 tests across 6 files)
- ESLint and TypeScript strict checks
- System design specification (architecture, API, security, MVP, evaluation)
