import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  ShieldCheck,
  Check,
  AlertCircle,
  ArrowUpRight,
  LockKeyhole,
  Activity,
} from 'lucide-react'
import type { ToolCall } from '../../api/contract'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import {
  PageHeading,
  Button,
  Input,
  Select,
  Badge,
  Skeleton,
  EmptyState,
  ErrorState,
  Lens,
  download,
  Field,
} from '../../design/primitives'
import { formatDate } from '../../lib/time'
import { ToolDetail } from '../chat/ToolDetail'
export default function Audit() {
  const query = useQuery(() => api.auditToolCalls()),
    navigate = useNavigate()
  const [tool, setTool] = useState('all'),
    [status, setStatus] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [selected, setSelected] = useState<ToolCall | null>(null),
    [offset, setOffset] = useState(0)
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        r =>
          (tool === 'all' || r.tool === tool) &&
          (status === 'all' || (status === 'ok' ? r.ok === true : r.ok === false)) &&
          (!from || formatDate(r.created_at, 'yyyy-MM-dd') >= from) &&
          (!to || formatDate(r.created_at, 'yyyy-MM-dd') <= to)
      ),
    [query.data, tool, status, from, to]
  )
  const virtual = rows.length > 100,
    visible = virtual ? rows.slice(offset, offset + 30) : rows
  function exportCsv() {
    const cell = (s: unknown) =>
      `"${String(s ?? '')
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`
    download(
      'ciel-audit.csv',
      [
        ['time', 'tool', 'session_id', 'tool_call_id', 'ok', 'duration_ms', 'args'],
        ...rows.map(r => [
          r.created_at,
          r.tool,
          r.session_id,
          r.id,
          r.ok,
          r.duration_ms,
          JSON.stringify(r.args),
        ]),
      ]
        .map(r => r.map(cell).join(','))
        .join('\r\n'),
      'text/csv'
    )
  }
  return (
    <div className="data-page page-enter">
      <PageHeading
        title="Nothing behind the curtain"
        description="Every tool call, every decision. A record you can inspect."
      >
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={16} />
          Export CSV
        </Button>
      </PageHeading>
      <Lens endpoint="GET /audit/tool-calls" refs="GR-10/15" milestone="Audit" />
      <div className="audit-banner">
        <ShieldCheck size={19} />
        <div>
          <strong>A clear trail, with private details protected.</strong>
          <span>
            Entries last for this tab session. Write and private arguments show metadata only.
          </span>
        </div>
        <Badge tone="mint">D5 enforced</Badge>
      </div>
      <div className="filter-bar audit-filters">
        <Field label="From">
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </Field>
        <Field label="Through">
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </Field>
        <Field label="Tool">
          <Select
            value={tool}
            onChange={e => {
              setTool(e.target.value)
              setOffset(0)
            }}
          >
            <option value="all">Every tool</option>
            {[...new Set(query.data?.map(r => r.tool))].map(t => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome">
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All outcomes</option>
            <option value="ok">Successful</option>
            <option value="error">Errors / rejected</option>
          </Select>
        </Field>
      </div>
      {query.loading ? (
        <Skeleton rows={7} />
      ) : query.error ? (
        <ErrorState message={query.error} retry={() => void query.refresh()} />
      ) : !rows.length ? (
        <EmptyState
          title="A clean slate."
          description="Tool calls will appear here as you use Ciel. Adjust the filters or start a conversation."
          action="Open Chat"
          onAction={() => navigate('/chat')}
        />
      ) : (
        <>
          <div className="collection-meta">
            <span>{rows.length} tool calls · times in Asia/Manila</span>
            <span>
              <Activity size={13} />
              Live in this demo
            </span>
          </div>
          <div
            className="audit-table table-scroll"
            onScroll={e => {
              if (virtual) setOffset(Math.max(0, Math.floor(e.currentTarget.scrollTop / 60) - 3))
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Tool</th>
                  <th>Conversation</th>
                  <th>Outcome</th>
                  <th>Duration</th>
                  <th>Arguments</th>
                </tr>
              </thead>
              <tbody>
                {virtual && offset > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: offset * 60 }} />
                  </tr>
                )}
                {visible.map(row => (
                  <tr key={row.id}>
                    <td>
                      {formatDate(row.created_at, 'd MMM')}
                      <small>{formatDate(row.created_at, 'h:mm a')}</small>
                    </td>
                    <td>
                      <button className="audit-tool" onClick={() => setSelected(row)}>
                        {row.metadata_only ? <LockKeyhole size={13} /> : <Activity size={13} />}
                        <code>{row.tool}</code>
                      </button>
                    </td>
                    <td>
                      <button
                        className="text-link mono"
                        onClick={() => navigate(`/chat/${row.session_id}`)}
                      >
                        {row.session_id.slice(0, 8)}
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                    <td>
                      <Badge tone={row.ok === null ? 'gold' : row.ok ? 'mint' : 'rose'}>
                        {row.ok ? <Check size={12} /> : <AlertCircle size={12} />}{' '}
                        {row.ok === null ? 'Pending' : row.ok ? 'OK' : 'Error'}
                      </Badge>
                    </td>
                    <td className="mono">{row.duration_ms.toLocaleString()} ms</td>
                    <td>
                      <button className="args-preview" onClick={() => setSelected(row)}>
                        {row.metadata_only
                          ? `${row.args.length} bytes · sha256:${String(row.args.sha256).slice(0, 8)}…`
                          : JSON.stringify(row.args).slice(0, 52)}
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {virtual && rows.length > offset + 30 && (
                  <tr aria-hidden="true">
                    <td colSpan={6} style={{ height: (rows.length - offset - 30) * 60 }} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ToolDetail tool={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
