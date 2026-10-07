import { useEffect, useRef, useState } from 'react'
import { Mail, ShieldCheck, ArrowUpRight, Copy, Search, TriangleAlert, PenLine } from 'lucide-react'
import { emails } from '../../api/demo/seed/emails'
import type { Email as EmailRecord } from '../../api/contract'
import { useDemo } from '../../state/demo.store'
import { toast } from '../../state/ui.store'
import {
  PageHeading,
  Badge,
  Input,
  Button,
  Notice,
  CodeBlock,
  Skeleton,
  EmptyState,
  ErrorState,
  Lens,
} from '../../design/primitives'
import { formatDate } from '../../lib/time'
import { api } from '../../api'
export default function Email() {
  const [selected, setSelected] = useState<EmailRecord>(emails[0]),
    [search, setSearch] = useState(''),
    [draft, setDraft] = useState(''),
    [drafting, setDrafting] = useState(false)
  const draftController = useRef<AbortController | null>(null)
  useEffect(() => () => draftController.current?.abort(), [])
  const mode = useDemo(s => s.screenState)
  const filtered =
    mode === 'empty'
      ? []
      : emails.filter(e => `${e.subject} ${e.from}`.toLowerCase().includes(search.toLowerCase()))
  async function createDraft() {
    draftController.current?.abort()
    const controller = new AbortController()
    draftController.current = controller
    setDrafting(true)
    try {
      let output = ''
      for await (const event of api.chat(
        { message: `Draft a reply to ${selected.id}: ${selected.subject}` },
        controller.signal
      )) {
        if (event.event === 'token') output += event.data.text
        if (event.event === 'tool_result' && !event.data.ok) throw new Error(event.data.summary)
        if (event.event === 'error') throw new Error(event.data.error.message)
      }
      if (controller.signal.aborted) return
      setDraft(output.match(/```text\n([\s\S]*?)```/)?.[1]?.trim() ?? output)
      toast('Draft text prepared. Nothing was sent.', 'success')
    } catch (e) {
      if (!controller.signal.aborted)
        toast(e instanceof Error ? e.message : 'Draft unavailable.', 'error')
    } finally {
      if (!controller.signal.aborted) setDrafting(false)
    }
  }
  return (
    <div className="data-page email-page page-enter">
      <PageHeading
        title="A quieter inbox"
        description="The gist of what arrived. The choice of what happens next."
        addon="Email"
      >
        <Badge tone="mint">
          <ShieldCheck size={13} />
          Read-only
        </Badge>
      </PageHeading>
      <Lens
        endpoint="POST /chat → email_unread_summary / email_draft"
        refs="FR-13/14 · GR-9"
        milestone="Email"
      />
      <div className="email-summary">
        <Mail size={21} />
        <span>
          <strong>6 unread messages.</strong> Two deserve a look today.
        </span>
        <Badge>Last 7 days · sample</Badge>
      </div>
      {mode === 'loading' ? (
        <Skeleton rows={7} />
      ) : mode === 'error' ? (
        <ErrorState
          message="The sample mailbox is unavailable. Re-authorization would be required for an expired real OAuth token."
          retry={() => useDemo.getState().set({ screenState: 'normal' })}
        />
      ) : (
        <div className="mail-layout">
          <section className="mail-list">
            <div className="search-input">
              <Search size={16} />
              <Input
                aria-label="Search mailbox"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Find a message…"
              />
            </div>
            {filtered.map(e => (
              <button
                className={`mail-item ${selected.id === e.id ? 'selected' : ''}`}
                key={e.id}
                onClick={() => {
                  draftController.current?.abort()
                  setDrafting(false)
                  setSelected(e)
                  setDraft('')
                }}
              >
                <div>
                  <strong>{e.from}</strong>
                  <time>{formatDate(e.date, 'd MMM')}</time>
                </div>
                <h3>{e.subject}</h3>
                <p>{e.gist}</p>
                {e.injection ? (
                  <Badge tone="rose">
                    <TriangleAlert size={11} />
                    Instruction ignored
                  </Badge>
                ) : e.urgency === 'high' ? (
                  <Badge tone="gold">Needs a look</Badge>
                ) : (
                  <span className="mail-priority">
                    {e.urgency === 'low' ? 'For later' : 'For your awareness'}
                  </span>
                )}
              </button>
            ))}
            {!filtered.length && (
              <EmptyState
                title="Nothing to catch up on."
                description="Try another search, or enjoy a clear inbox."
              />
            )}
          </section>
          {filtered.length > 0 && (
            <article className="mail-detail">
              <div className="mail-ribbon">
                <ShieldCheck size={13} />
                Untrusted content · displayed as plain text
              </div>
              <h2>{selected.subject}</h2>
              <div className="mail-sender">
                <span className="sender-avatar">{selected.from[0]}</span>
                <div>
                  <strong>{selected.from}</strong>
                  <small>To Kai · {formatDate(selected.date, 'd MMM yyyy, h:mm a')}</small>
                </div>
              </div>
              <div className="mail-gist">
                <span>CIEL’S GIST</span>
                <p>{selected.gist}</p>
              </div>
              <pre className="mail-body">{selected.body}</pre>
              {selected.injection && (
                <Notice tone="error">
                  This message contains instructions aimed at an assistant; ignored. No action was
                  taken.
                </Notice>
              )}
              <Button variant="secondary" onClick={() => void createDraft()} disabled={drafting}>
                <PenLine size={16} />
                {drafting ? 'Preparing draft…' : 'Draft a reply'}
                <ArrowUpRight size={13} />
              </Button>
              {drafting && <Skeleton rows={2} />}{' '}
              {draft && (
                <div className="mail-draft">
                  <h3>Ready to copy, if you choose.</h3>
                  <CodeBlock label="reply draft">{draft}</CodeBlock>
                  <Notice>
                    Draft text only — Ciel cannot write to Gmail. No send or draft scopes exist.
                  </Notice>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(draft)
                        .then(() => toast('Draft copied', 'success'))
                        .catch(() => {})
                    }
                  >
                    <Copy size={15} />
                    Copy draft
                  </Button>
                </div>
              )}
            </article>
          )}
        </div>
      )}
      <p className="privacy-footnote">
        <ShieldCheck size={13} />
        Fictional mailbox. No Gmail connection, send permission, or tracking pixels.
      </p>
    </div>
  )
}
