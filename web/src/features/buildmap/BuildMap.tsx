/** Interactive design reference for the demo endpoints, data shapes, and guardrails. */
import { useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  Search,
  ChevronDown,
  Check,
  ArrowUpRight,
  Database,
  GitBranch,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { endpoints, models, milestones, guardrails, flows, backendMarkdown } from './catalog'
import { useUi, toast } from '../../state/ui.store'
import { useDemo } from '../../state/demo.store'
import {
  PageHeading,
  Button,
  Tabs,
  Input,
  Badge,
  CodeBlock,
  download,
  Notice,
  Skeleton,
  EmptyState,
  ErrorState,
  Lens,
} from '../../design/primitives'
const completed = new Set<string>()
/**
 * Render the searchable catalog with local review markers and guided scenario links.
 * @returns The Build Map page for the current demo screen state.
 */
export default function BuildMap(): ReactElement {
  const [tab, setTab] = useState('endpoints'),
    [query, setQuery] = useState(''),
    [version, setVersion] = useState(0)
  const navigate = useNavigate(),
    mode = useDemo(s => s.screenState)
  const rows = endpoints.filter(e =>
    `${e.method} ${e.path} ${e.screen} ${e.refs}`.toLowerCase().includes(query.toLowerCase())
  )
  function run(flowId: string) {
    const f = flows.find(f => f.id === flowId)
    if (f) {
      useUi.getState().set({ flow: flowId, typingPrompt: f.prompt })
      navigate('/chat')
    }
  }
  return (
    <div className="data-page buildmap-page page-enter" data-version={version}>
      <PageHeading
        title="Build Map"
        description="A design reference for the demo API, data model, and guardrails."
      >
        <Button
          variant="secondary"
          onClick={() => {
            download('FRONTEND_TO_BACKEND.md', backendMarkdown(), 'text/markdown')
            toast('Design reference exported', 'success')
          }}
        >
          <Download size={16} />
          Export design reference
        </Button>
      </PageHeading>
      <Lens
        endpoint="CielApi contract inventory"
        refs="FR-1…23 · GR-1…20"
        milestone="Architecture reference"
      />
      <div className="build-progress">
        <span className="build-progress-icon">
          <GitBranch size={26} />
        </span>
        <div>
          <strong>
            {completed.size} of {endpoints.length} endpoints marked reviewed
          </strong>
          <p>Local review markers. Every endpoint in this demo uses the in-memory adapter.</p>
        </div>
        <progress value={completed.size} max={endpoints.length} />
        <span className="build-percent">
          {Math.round((completed.size / endpoints.length) * 100)}%
        </span>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'endpoints', label: 'Endpoints', count: endpoints.length },
          { id: 'milestones', label: 'Architecture areas', count: milestones.length },
          { id: 'data', label: 'Data model', count: 9 },
          { id: 'guardrails', label: 'Guardrails', count: 20 },
        ]}
      />
      {mode === 'loading' ? (
        <Skeleton rows={7} />
      ) : mode === 'error' ? (
        <ErrorState
          message="Sample Build Map view error."
          retry={() => useDemo.getState().set({ screenState: 'normal' })}
        />
      ) : mode === 'empty' ? (
        <EmptyState
          title="Your map starts here."
          description="The endpoint catalog is bundled with this demo. Restore the normal view to explore it."
          action="Restore map"
          onAction={() => useDemo.getState().set({ screenState: 'normal' })}
        />
      ) : tab === 'endpoints' ? (
        <>
          <div className="filter-bar">
            <div className="search-input">
              <Search size={17} />
              <Input
                aria-label="Search endpoint inventory"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find an endpoint, screen, or guardrail…"
              />
            </div>
            <span className="muted">
              /api/v1 <span className="faint">·</span> health routes at root
            </span>
          </div>
          <div className="endpoint-list">
            <div className="endpoint-heading">
              <span>Method / endpoint</span>
              <span>Used by</span>
              <span>Area</span>
              <span>Reference review</span>
            </div>
            {rows.map(e => (
              <details className="endpoint" key={e.id}>
                <summary>
                  <span>
                    <Badge
                      tone={
                        e.method === 'DELETE'
                          ? 'rose'
                          : e.method === 'POST'
                            ? 'blue'
                            : e.method === 'PATCH'
                              ? 'violet'
                              : 'neutral'
                      }
                    >
                      {e.method}
                    </Badge>
                    <code>{e.path}</code>
                    <ChevronDown size={13} />
                  </span>
                  <span>{e.screen}</span>
                  <span>
                    <Badge>Area {e.milestone}</Badge>
                  </span>
                  <span>
                    <button
                      className={`backend-status ${completed.has(e.id) ? 'done' : ''}`}
                      onClick={event => {
                        event.preventDefault()
                        if (completed.has(e.id)) completed.delete(e.id)
                        else completed.add(e.id)
                        setVersion(v => v + 1)
                      }}
                    >
                      {completed.has(e.id) ? <Check size={12} /> : <span className="status-dot" />}
                      {completed.has(e.id) ? 'Reviewed' : 'Demo adapter'}
                    </button>
                  </span>
                </summary>
                <div className="endpoint-detail">
                  <p className="mono metadata">{e.refs}</p>
                  <div className="endpoint-examples">
                    <CodeBlock label="request">{e.request}</CodeBlock>
                    <CodeBlock label="response / SSE">{e.response}</CodeBlock>
                  </div>
                  {e.note && <p>{e.note}</p>}
                </div>
              </details>
            ))}
          </div>
          {!rows.length && (
            <EmptyState
              title="No endpoint matched."
              description="Try a route name such as notes, tasks, or sessions."
            />
          )}
        </>
      ) : tab === 'milestones' ? (
        <div className="milestone-lanes">
          {milestones.map(([name, scope], i) => {
            const assigned = endpoints.filter(e => e.milestone === i + 1)
            return (
              <section key={name}>
                <div className={`milestone-num ${i < 4 ? 'mvp' : ''}`}>{i + 1}</div>
                <div>
                  <h2>
                    {name}
                    {i < 4 && <Badge tone="blue">Ciel Lite</Badge>}
                  </h2>
                  <p>{scope}</p>
                  <div className="row wrap">
                    {assigned.map(e => (
                      <button
                        key={e.id}
                        className="milestone-endpoint"
                        onClick={() => {
                          setQuery(e.path)
                          setTab('endpoints')
                        }}
                      >
                        {e.method} {e.path}
                        <ArrowUpRight size={11} />
                      </button>
                    ))}
                    {!assigned.length && (
                      <span className="metadata">Deployment or shared design concern.</span>
                    )}
                  </div>
                </div>
                <span className="milestone-count">
                  {assigned.filter(e => completed.has(e.id)).length}/{assigned.length || '—'}
                </span>
              </section>
            )
          })}
        </div>
      ) : tab === 'data' ? (
        <>
          <Notice>
            These data shapes describe screen requirements and demo relationships. They do not
            represent database migrations.
          </Notice>
          <div className="model-grid">
            {models.map(m => (
              <section key={m.name}>
                <div className="row">
                  <Database size={19} />
                  <h2 className="mono">{m.name}</h2>
                </div>
                <ul>
                  {m.columns.split(' · ').map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <div className="model-relation">
                  <GitBranch size={14} />
                  {m.relation}
                </div>
                <button className="text-link" onClick={() => navigate(m.route)}>
                  Seen in {m.route.slice(1)}
                  <ArrowUpRight size={13} />
                </button>
              </section>
            ))}
          </div>
        </>
      ) : (
        <div className="guardrail-list">
          {guardrails.map(([name, flow, detail], i) => (
            <section key={name}>
              <span className="guardrail-icon">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2>
                  <span className="mono">GR-{i + 1}</span>
                  {name}
                </h2>
                <p>{detail}</p>
              </div>
              <Button variant="ghost" onClick={() => run(flow)}>
                Try it
                <ArrowRight size={14} />
              </Button>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
