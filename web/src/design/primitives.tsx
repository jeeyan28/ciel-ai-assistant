import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react'
import { X, Copy, Check, ArrowRight, AlertCircle, RotateCcw, LockKeyhole } from 'lucide-react'
import clsx from 'clsx'
import { toast, useUi } from '../state/ui.store'
import { SageCore } from './SageCore'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
}) {
  return <button className={clsx('button', `button-${variant}`, className)} {...props} />
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('input', props.className)} />
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('input textarea', props.className)} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('input select', props.className)} />
}
export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  )
}
export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: string
  title?: string
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  )
}
export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      className="switch-row"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>
        <span className="switch-label">{label}</span>
        {description && <small>{description}</small>}
      </span>
      <span className={`switch-track ${checked ? 'on' : ''}`}>
        <span />
      </span>
    </button>
  )
}
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onKeyDown={e => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault()
              const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
              onChange(tabs[n].id)
              ;(e.currentTarget.parentElement?.children[n] as HTMLElement).focus()
            }
          }}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count !== undefined && <span>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
export function Dialog({
  open,
  onClose,
  onEscape,
  title,
  children,
  wide = false,
  drawer = false,
}: {
  open: boolean
  onClose: () => void
  onEscape?: () => void
  title: string
  children: ReactNode
  wide?: boolean
  drawer?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      const prior = document.activeElement as HTMLElement | null
      el.showModal()
      ;(
        el.querySelector<HTMLElement>('[data-autofocus]') ??
        el.querySelector<HTMLElement>(
          'input:not([disabled]),textarea:not([disabled]),select:not([disabled])'
        )
      )?.focus()
      return () => {
        el.close()
        prior?.focus()
      }
    }
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={clsx('dialog', wide && 'wide', drawer && 'drawer')}
      aria-label={title}
      onCancel={e => {
        e.preventDefault()
        ;(onEscape ?? close.current)()
      }}
      onClick={e => {
        if (e.target === e.currentTarget) {
          const b = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close.current()
        }
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <IconButton label="Close dialog" onClick={onClose}>
          <X size={19} />
        </IconButton>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
export function Drawer(props: Omit<Parameters<typeof Dialog>[0], 'drawer'>) {
  return <Dialog {...props} drawer />
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode
  tone?: 'info' | 'error' | 'gold' | 'private' | 'success'
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'private' ? (
        <LockKeyhole size={17} />
      ) : tone === 'success' ? (
        <Check size={17} />
      ) : (
        <AlertCircle size={17} />
      )}
      <div>{children}</div>
    </div>
  )
}
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  return (
    <button
      className="copy-button"
      onClick={() => {
        void navigator.clipboard
          .writeText(text)
          .then(() => toast('Copied to clipboard', 'success'))
          .catch(() => toast('Clipboard unavailable. Select and copy the text.', 'error'))
      }}
      title={label}
      aria-label={label}
    >
      <Copy size={14} />
      <span>{label}</span>
    </button>
  )
}
export function CodeBlock({ children, label = 'json' }: { children: string; label?: string }) {
  return (
    <div className="code-block">
      <div>
        <span>{label}</span>
        <CopyButton text={children} />
      </div>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  )
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-stack" role="status" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - (i % 3) * 12}%` }} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  )
}
export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string
  description: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <SageCore size={76} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Button variant="secondary" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </Button>
      )}
    </div>
  )
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state">
      <Notice tone="error">{message}</Notice>
      <Button variant="secondary" onClick={retry}>
        <RotateCcw size={16} />
        Try again
      </Button>
    </div>
  )
}
export function PageHeading({
  title,
  description,
  children,
  addon,
}: {
  title: string
  description: string
  children?: ReactNode
  addon?: string
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="heading-line">
          <h1>{title}</h1>
          {addon && <Badge tone="blue">{addon} add-on</Badge>}
        </div>
        <p>{description}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </header>
  )
}
export function Lens({
  endpoint,
  refs,
  milestone,
}: {
  endpoint: string
  refs: string
  milestone: string
}) {
  const dev = useUi(s => s.devLens)
  return dev ? (
    <div className="lens-tag">
      {endpoint} · {refs} · {milestone}
    </div>
  ) : null
}
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}
export function Sparkline({
  values = [8, 5, 7, 4, 6, 2, 4, 3, 5, 2],
  label,
}: {
  values?: number[]
  label: string
}) {
  return (
    <svg className="sparkline" viewBox="0 0 120 32" role="img" aria-label={label}>
      <polyline
        points={values.map((v, i) => `${(i * 120) / (values.length - 1)},${30 - v * 3}`).join(' ')}
        fill="none"
        stroke="var(--slime-600)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
export function Waveform({ playing = false }: { playing?: boolean }) {
  return (
    <div className={`waveform ${playing ? 'playing' : ''}`} aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => (
        <i
          key={i}
          style={{ height: 12 + Math.abs(Math.sin(i * 1.7)) * 32, animationDelay: `${i * -0.09}s` }}
        />
      ))}
    </div>
  )
}
export function Toasts() {
  const items = useUi(s => s.toasts)
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.tone}`} role="status">
          {t.tone === 'error' ? <AlertCircle size={17} /> : <Check size={17} />}
          <span>{t.message}</span>
          {t.action && <button onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
