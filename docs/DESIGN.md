# Interface Design

> **Status:** Design reference for the Ciel frontend simulation.

## Visual Language

### Color

- **Light mode**: sky-washed background (`#F3F8FD`), clean white surfaces,
  deep navy ink (`#0A1F3A`). Accents use the slime blue family for interactive
  states and brand ink for links.
- **Dark mode ("Night Sky")**: deep navy background (`#06111F`), elevated
  surfaces, light ink for text. Same accent semantics but adapted for low
  light.
- **Semantic colors**:
  - `rose` — errors, destructive actions, high-urgency
  - `mint` — success, completed tasks, healthy systems
  - `violet` — private/local content, model-written material
  - `blue` — informational, provider status
  - `sage` — warnings, pending confirmations

### Typography

- **Inter** (body, UI labels, buttons) — clean, highly readable at small sizes
- **Sora** (headings, display text) — distinctive, friendly personality
- **JetBrains Mono** (code, technical data) — monospace for commands, IDs,
  and technical details

### Spacing and Layout

- 14px base font size for comfortable reading density
- 8px grid system for consistent vertical rhythm
- `page-enter` animation class for route transitions (subtle opacity + scale)
- Card-based layout with 12px border radius, subtle shadows

### Motion

- `ease-slime` (cubic-bezier) for playful micro-interactions (button hover,
  starter cards)
- `ease-calm` (cubic-bezier) for layout transitions (sidebar collapse, panel
  open/close)
- Reduced motion respected via `prefers-reduced-motion` and the
  `reducedMotion` state flag
- Waveform animation for voice recording state

## Responsive Design

Not a scaled-down desktop — composition changes by breakpoint:

- **≥1600px**: enlarged welcome, denser starter grid
- **1024–1599px**: standard desktop layout
- **640–1023px**: rail-collapsed sidebar, table grid becomes single column
- **<640px**: fixed mobile sidebar off-canvas, bottom navigation bar,
  touch-optimized targets (44px minimum)

## Component Patterns

### Buttons

- Variants: `primary`, `secondary`, `ghost`, `danger`, `gold`
- Gold variant: used for confirmation actions (approve) to distinguish from
  standard primary actions
- Minimum 44px touch targets on mobile

### Inputs

- 46px height for text/password/token fields
- Focus ring: 2px solid `#6CC7FA` (slime-500), 3px offset
- Error state: border-color change with inline error message

### Cards

- 12px border radius, 1px border, subtle shadow
- Header has 1px border-bottom separator
- Interactive cards (notes, projects) have hover transition

### Dialogs

- Modal with `<dialog>` element, `showModal()` for accessibility
- Auto-focus first input or `[data-autofocus]` element
- Escape key closes, click-outside closes
- Trap focus within the dialog

### Navigation

- Sidebar: 260px rail (72px on tablet, off-canvas on mobile)
- Nav items: 40px height, rounded hover state
- Active item: blue background, bold text
- Mobile bottom nav: 5 icons with labels under 64px tap targets
- `g` then `c`/`n`/`t` keyboard shortcut navigation
- `Ctrl+K` / `⌘K` for command palette

### Status Indicators

- Badges with semantic color variants
- Dot indicators for online/offline status
- Progress rings for countdowns (5-minute confirmation expiry)
- Waveform visualization for voice recording

## Interaction Principles

1. **Confirmation-first for writes**: Any agent-initiated write (save_note,
   add_task, update_task, project registration) is held as pending. The turn
   parks, showing a confirmation card with exact arguments and SHA-256 hash.
   Nothing is written until user approves.

2. **Partial text is preserved**: If a stream is interrupted (timeout,
   cancellation, provider rate limit), the partial text remains visible and
   editable.

3. **Private context is visible**: When a session becomes local-only, a
   violet banner appears: "Private content stays local for this conversation"
   with a "web_search blocked" badge.

4. **Citations are verified**: Only citations from the current request's
   retrieved set are shown as verified. Unverified citations are stripped and
   an audit event is recorded.

5. **Loading states are meaningful**: Skeleton loaders during data fetch,
   empty states with actionable text, error states with retry buttons.

6. **Dev Lens and Flow Explorer**: Developer tools accessible via `Shift+D`
   (Dev Lens) and a floating button (Flow Explorer) provide insight into the
   API surface and guided scenarios.

## Accessibility

- `aria-label` on all icon buttons
- `role="alert"` on error messages
- `aria-live="polite"` on toast notifications
- Focus management in dialogs (traps focus, returns focus on close)
- Semantic HTML (`<main>`, `<section>`, `<header>`, `<h1>`-`<h3>`)
- `aria-describedby` links error messages to inputs
- `aria-pressed` on toggle buttons
- `aria-keyshortcuts` in keyboard help dialog
