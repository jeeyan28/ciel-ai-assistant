import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import type { Citation, Note } from '../api/contract'
import { useUi } from '../state/ui.store'
import { CopyButton, CodeBlock } from '../design/primitives'
import { ImageOff, LockKeyhole } from 'lucide-react'
import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map(c =>
      typeof c === 'string' || typeof c === 'number'
        ? String(c)
        : isValidElement<{ children?: ReactNode }>(c)
          ? nodeText(c.props.children)
          : ''
    )
    .join('')
}
export function SafeMarkdown({
  text,
  citations = [],
  streaming = false,
  highlight,
}: {
  text: string
  citations?: Citation[]
  streaming?: boolean
  highlight?: string
}) {
  let safe = text.replace(/\[\[n:([^\]#]+)#([^\]]+)\]\]/g, (_m: string, n: string, c: string) => {
    const i = citations.findIndex(v => v.note_id === n && v.chunk_id === c)
    return i < 0 ? '' : `[${i + 1}](/__citation/${i})`
  })
  if (streaming) safe = safe.replace(/\[\[n:[^\]]*$/, '')
  return (
    <div className="markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        components={{
          img: () => (
            <span className="blocked-image">
              <ImageOff size={14} />
              External image blocked
            </span>
          ),
          a: ({ href, children }) => {
            const m = href?.match(/^\/__citation\/(\d+)$/)
            const c = m ? citations[Number(m[1])] : undefined
            if (c) return <CitationChip citation={c} number={Number(m![1]) + 1} />
            return (
              <span className="inert-link">
                {children}
                <span className="link-url">
                  {href && nodeText(children) !== href ? ` (${href})` : ''}
                </span>
                {href && <CopyButton text={href} label="Copy URL" />}
              </span>
            )
          },
          pre: ({ children }) => <CodeBlock label="code">{nodeText(children).trimEnd()}</CodeBlock>,
          h2: ({ children }) => (
            <h2
              className={nodeText(children) === highlight ? 'matched-section' : undefined}
              id={nodeText(children)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')}
            >
              {children}
            </h2>
          ),
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {safe}
      </Markdown>
    </div>
  )
}

function CitationChip({ citation, number }: { citation: Citation; number: number }) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState<Note | null>(null),
    [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!open || note || failed) return
    let live = true
    void api
      .getNote(citation.note_id)
      .then(value => {
        if (live) setNote(value)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [open, note, failed, citation.note_id])
  return (
    <span
      className="citation-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="citation-chip"
        aria-label={'Open citation ' + number + ': ' + citation.heading}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() =>
          useUi.getState().set({ noteId: citation.note_id, noteSection: citation.heading })
        }
      >
        {(note?.private || citation.note_id === 'n10') && <LockKeyhole size={10} />}
        <span>{number}</span>
      </button>
      {open && (
        <span className="citation-popover" role="tooltip">
          <strong>
            {note?.title ?? (failed ? 'Source details unavailable' : 'Loading source…')}
          </strong>
          <span>{citation.heading}</span>
          <span>
            Relevance {citation.score.toFixed(2)}
            {note ? ' · ' + (note.origin === 'model' ? 'model-written' : 'written by you') : ''}
            {note?.private ? ' · local-only' : ''}
          </span>
        </span>
      )}
    </span>
  )
}
