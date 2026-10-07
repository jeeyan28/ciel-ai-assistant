import { useEffect, useState } from 'react'
import { ShieldCheck, Check, Clock, ChevronDown } from 'lucide-react'
import type { PendingConfirmation } from '../../api/contract'
import { Button, Badge, CodeBlock, Notice } from '../../design/primitives'
import { SageCore } from '../../design/SageCore'
import { useChat } from '../../state/chat.store'
import { useUi, toast } from '../../state/ui.store'
import { demoActions } from '../../state/demo.store'
import { api } from '../../api'
import { formatDate } from '../../lib/time'
export function ConfirmCard({ pending }: { pending: PendingConfirmation }) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Math.ceil((pending.expires_at - Date.now()) / 1000))
  )
  const busy = useChat(s => s.busy),
    decide = useChat(s => s.decide),
    dev = useUi(s => s.devLens)
  const active = pending.state === 'pending'
  useEffect(() => {
    const update = () => setLeft(Math.max(0, Math.ceil((pending.expires_at - Date.now()) / 1000)))
    update()
    const timer = setInterval(update, 500)
    return () => clearInterval(timer)
  }, [pending.expires_at])
  useEffect(() => {
    if (left === 0 && active && !busy) void decide('deny')
  }, [left, active, busy, decide])
  const args = pending.args
  const title =
    pending.tool === 'add_task'
      ? 'create a task'
      : pending.tool === 'save_note'
        ? 'save a note'
        : 'update a task'
  async function breakIt(action: 'replay' | 'modify' | 'expire') {
    try {
      if (action === 'modify') demoActions.modify(pending.id)
      if (action === 'expire') demoActions.expire(pending.id)
      if (action === 'expire') {
        await useChat.getState().load(pending.session_id)
        await decide('deny')
        return
      }
      await api.confirm(pending.session_id, { tool_call_id: pending.id, decision: 'approve' })
      toast('Confirmation executed.', 'success')
    } catch (e) {
      toast(
        e instanceof Error
          ? `${'code' in e ? String(e.code) : 'Error'} · ${e.message}`
          : 'Request rejected.',
        'error'
      )
    }
  }
  return (
    <section className={`confirm-card ${!active ? 'resolved' : ''}`}>
      <header>
        <SageCore size={34} state={active ? 'awaiting_confirm' : 'tool'} />
        <div>
          <span className="eyebrow">
            {active
              ? 'CONFIRM'
              : pending.state === 'executed'
                ? 'EXECUTED'
                : pending.state.toUpperCase()}
          </span>
          <h3>
            {active
              ? `Ciel wants to ${title}.`
              : pending.state === 'executed'
                ? 'Your approved action is complete.'
                : pending.state === 'expired'
                  ? 'Expired — auto-denied.'
                  : 'Nothing was written.'}
          </h3>
        </div>
        {active && (
          <div className="countdown" title="Expires after five minutes">
            <svg className="countdown-ring" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" className="countdown-track" />
              <circle
                cx="12"
                cy="12"
                r="9"
                strokeDasharray={56.55}
                strokeDashoffset={56.55 * (1 - left / 300)}
              />
            </svg>
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </div>
        )}
      </header>
      {active && <p className="muted">Nothing is written until you approve.</p>}
      <div className="confirm-preview">
        {pending.tool === 'save_note' ? (
          <>
            <strong>{String(args.content).split('\n')[0].replace(/^# /, '')}</strong>
            <p className="preview-content">
              {String(args.content).split('\n').slice(1).join('\n')}
            </p>
            <div className="row wrap">
              {Array.isArray(args.tags) &&
                args.tags.map(t => <Badge key={String(t)}>{String(t)}</Badge>)}
              <Badge tone="violet">model-written</Badge>
              {args.private === true && <Badge tone="violet">Private · local-only</Badge>}
            </div>
          </>
        ) : (
          <>
            <strong>{String(args.title ?? 'Update task status')}</strong>
            {args.due_at && (
              <p>
                <Clock size={14} />
                {formatDate(String(args.due_at), 'EEE d MMM yyyy, h:mm a')} · Asia/Manila
              </p>
            )}
            {args.project && <Badge>{String(args.project)}</Badge>}
            {args.status && <Badge tone="mint">{String(args.status)}</Badge>}
          </>
        )}
      </div>
      <details className="exact-args">
        <summary>
          Exact arguments <ChevronDown size={14} />
        </summary>
        <CodeBlock>{pending.preview}</CodeBlock>
        <p className="mono break">SHA-256 {pending.args_hash}</p>
        <p className="mono break">ID {pending.id}</p>
      </details>
      {active ? (
        <div className="confirm-actions">
          <Button
            variant="gold"
            data-autofocus
            onClick={() => void decide('approve')}
            disabled={busy || left === 0}
          >
            <Check size={17} />
            Approve
          </Button>
          <Button variant="secondary" onClick={() => void decide('deny')} disabled={busy}>
            Deny
          </Button>
        </div>
      ) : (
        <Notice tone={pending.state === 'executed' ? 'success' : 'info'}>
          {pending.result ?? pending.state}
        </Notice>
      )}
      <small className="confirm-footnote">
        <ShieldCheck size={13} />
        Single-use · bound to these exact arguments · user token only
      </small>
      {dev && (
        <details className="break-panel">
          <summary>Try to break it · GR-2</summary>
          <div className="row wrap">
            <Button variant="ghost" disabled={active} onClick={() => void breakIt('replay')}>
              Replay confirmation
            </Button>
            <Button variant="ghost" disabled={!active} onClick={() => void breakIt('modify')}>
              Modify args
            </Button>
            <Button variant="ghost" disabled={!active} onClick={() => void breakIt('expire')}>
              Wait to expiry
            </Button>
          </div>
        </details>
      )}
    </section>
  )
}
