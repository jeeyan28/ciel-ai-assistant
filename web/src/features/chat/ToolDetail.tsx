import type { ToolCall } from '../../api/contract'
import { Drawer, Badge, CodeBlock, Notice } from '../../design/primitives'
import { formatDate } from '../../lib/time'
export function ToolDetail({ tool, onClose }: { tool: ToolCall | null; onClose: () => void }) {
  return (
    <Drawer open={!!tool} onClose={onClose} title="Tool call detail">
      {tool && (
        <div className="stack">
          <div className="heading-line">
            <h3 className="mono">{tool.tool}</h3>
            <Badge tone={tool.ok === null ? 'gold' : tool.ok ? 'mint' : 'rose'}>
              {tool.ok === null ? 'Awaiting' : tool.ok ? 'Completed' : 'Rejected / error'}
            </Badge>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Tool-call ID</dt>
              <dd className="mono break">{tool.id}</dd>
            </div>
            <div>
              <dt>Turn ID</dt>
              <dd className="mono break">{tool.turn_id}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{tool.duration_ms} ms</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(tool.created_at, 'd MMM yyyy, h:mm a')} · Manila</dd>
            </div>
          </dl>
          {tool.metadata_only && (
            <Notice tone="private">
              Metadata only (D5). Arguments for all writes and private calls are represented by
              their byte length and SHA-256 hash.
            </Notice>
          )}
          <CodeBlock>{JSON.stringify(tool.args, null, 2)}</CodeBlock>
          <div>
            <h3>Result</h3>
            <p className="muted">{tool.summary}</p>
          </div>
          <div className="classification">
            <h3>Field classification</h3>
            <p>
              <Badge tone="mint">Fully logged</Badge>Tool, IDs, duration, result status
            </p>
            <p>
              <Badge tone="gold">Redacted</Badge>Scanner findings
            </p>
            <p>
              <Badge tone="violet">Metadata only</Badge>Private and write arguments
            </p>
            <p>
              <Badge tone="rose">Never logged</Badge>Tokens, secrets, raw private content
            </p>
          </div>
        </div>
      )}
    </Drawer>
  )
}
