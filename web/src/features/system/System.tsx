import { useEffect, useState } from 'react'
import {
  Activity,
  Database,
  BrainCircuit,
  Cloud,
  Check,
  ShieldCheck,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import { useDemo } from '../../state/demo.store'
import { limitGate } from '../../api/demo/agent/guardrails'
import {
  PageHeading,
  Badge,
  Switch,
  Select,
  CodeBlock,
  Notice,
  Sparkline,
  Skeleton,
  ErrorState,
  EmptyState,
  Dialog,
  Button,
  Lens,
} from '../../design/primitives'
const limits = [
  ['JSON body', '1 MB', '1,048,576 bytes'],
  ['Chat message', '32 KB', '32,768 UTF-8 bytes'],
  ['Note content', '256 KB', '262,144 UTF-8 bytes'],
  ['Tool result → LLM', '8 KB', '8,192 UTF-8 bytes'],
  ['Search results', 'k ≤ 20', 'Default k = 5'],
  ['SSE duration', '120 s', 'Partial text preserved'],
  ['Tool timeout', '10 s', 'One call, bounded'],
  ['Request rate', '60 / min', 'Per user token'],
  ['Concurrent SSE', '3', '429 on the fourth'],
  ['TTS text', '1,000 chars', '16 kHz mono WAV'],
]
export default function System() {
  const demo = useDemo()
  const health = useQuery(() => api.healthz()),
    ready = useQuery(() => api.readyz())
  const [cache, setCache] = useState(30),
    [usage, setUsage] = useState(0),
    [evalOpen, setEvalOpen] = useState(false)
  useEffect(() => {
    const timer = setInterval(() => {
      setCache(c => (c === 1 ? 30 : c - 1))
      setUsage(limitGate.requests.filter(t => Date.now() - t < 60000).length)
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  const providerModel =
    demo.provider === 'Groq'
      ? 'llama (demo placeholder)'
      : demo.provider === 'Gemini'
        ? 'gemini (demo placeholder)'
        : 'qwen3:8b'
  return (
    <div className="data-page system-page page-enter">
      <PageHeading
        title="Steady, by design"
        description="The pulse of your workspace, and the boundaries that keep it calm."
      >
        <Badge tone={demo.notReady ? 'rose' : 'mint'}>
          <Activity size={13} />
          {demo.notReady ? 'Needs attention' : 'Systems operational'}
        </Badge>
      </PageHeading>
      <Lens
        endpoint="GET /healthz · GET /readyz"
        refs="GR-13/14/18"
        milestone="Health and limits"
      />
      {demo.screenState === 'empty' ? (
        <EmptyState
          title="Waiting for a pulse."
          description="Health results will appear when the first probe returns."
          action="Run health probes"
          onAction={() => demo.set({ screenState: 'normal' })}
        />
      ) : (
        <div className="health-grid">
          <section className="health-card">
            <div className="row between">
              <Activity size={21} />
              <Badge tone={health.error ? 'rose' : 'mint'}>
                {health.error ? 'Unavailable' : '200 OK'}
              </Badge>
            </div>
            <h2>Alive and listening.</h2>
            <p>
              <code>GET /healthz</code> · process liveness
            </p>
            {health.loading ? (
              <Skeleton rows={1} />
            ) : health.error ? (
              <ErrorState message={health.error} retry={() => void health.refresh()} />
            ) : (
              <div className="health-latency">
                <span>
                  12 ms <small>sample</small>
                </span>
                <Sparkline label="Sample liveness latency" />
              </div>
            )}
          </section>
          <section className="health-card">
            <div className="row between">
              <Database size={21} />
              <Badge tone={ready.error ? 'rose' : 'mint'}>
                {ready.error ? '503 not_ready' : '200 Ready'}
              </Badge>
            </div>
            <h2>Ready for your work.</h2>
            <p>
              <code>GET /readyz</code> · dependencies
            </p>
            {ready.loading ? (
              <Skeleton rows={1} />
            ) : (
              <div className="readiness-checks">
                <span>
                  <Database size={14} />
                  Postgres
                  <Badge tone={demo.notReady ? 'rose' : 'mint'}>
                    {demo.notReady ? 'Down' : 'Ready'}
                  </Badge>
                </span>
                <span>
                  <BrainCircuit size={14} />
                  Embedder<Badge tone="mint">Loaded</Badge>
                </span>
              </div>
            )}
            {ready.error && <p className="error-text">{ready.error}</p>}
          </section>
          <section className="health-card">
            <div className="row between">
              <Cloud size={21} />
              <Badge tone={demo.providerDown ? 'rose' : 'blue'}>
                {demo.providerDown ? 'Down' : 'Up'} · sample
              </Badge>
            </div>
            <h2>{demo.provider} · provider</h2>
            <p>Reported, independent of readiness.</p>
            <div className="provider-cache">
              <Clock size={14} />
              Cached status · refresh in {cache}s
            </div>
            <small className="muted">No provider request is made in this demo.</small>
          </section>
        </div>
      )}
      <div className="system-controls">
        <Switch
          label="Simulate Postgres unavailable"
          description="Readiness returns 503 not_ready."
          checked={demo.notReady}
          onChange={notReady => demo.set({ notReady })}
        />
        <Switch
          label="Simulate provider down"
          description="Readiness stays healthy. No restart loop."
          checked={demo.providerDown}
          onChange={providerDown => demo.set({ providerDown })}
        />
      </div>
      <div className="system-columns">
        <section className="limits-panel">
          <div className="section-heading">
            <h2>Room to work. Limits to trust.</h2>
            <Badge>Published caps</Badge>
          </div>
          <table className="limits-table">
            <thead>
              <tr>
                <th>Boundary</th>
                <th>Limit</th>
                <th>Behavior</th>
              </tr>
            </thead>
            <tbody>
              {limits.map(([name, limit, desc]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="mono">{limit}</td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="usage-meter">
            <div>
              <span>Requests in the last minute</span>
              <strong>{usage} / 60</strong>
            </div>
            <progress max={60} value={usage} />
            <small>{limitGate.active} of 3 streams active</small>
          </div>
        </section>
        <div className="stack">
          <section className="provider-config">
            <h2>Sample provider settings.</h2>
            <p>
              Inspect illustrative provider configuration. This demo does not read environment
              variables.
            </p>
            <Select
              aria-label="Provider configuration preview"
              value={demo.provider}
              onChange={e => demo.set({ provider: e.target.value })}
            >
              {['Groq', 'Gemini', 'Ollama'].map(p => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <CodeBlock label=".env preview">{`CIEL_LLM_PROVIDER=${demo.provider.toLowerCase()}\nCIEL_LLM_MODEL=${providerModel}\nCIEL_TIMEZONE=Asia/Manila`}</CodeBlock>
            <Notice>Private projects force Ollama. The demo never contacts these providers.</Notice>
            <p className="metadata">Embedder: nomic-embed-text-v1.5 · 768 dimensions</p>
          </section>
          <section className="eval-card">
            <div className="row between">
              <ShieldCheck size={21} />
              <Badge>Sample results</Badge>
            </div>
            <h2>Evidence of a useful answer.</h2>
            <div className="eval-metrics">
              <div>
                <strong>
                  8<span>/10</span>
                </strong>
                <small>Retrieval hit@5</small>
              </div>
              <div>
                <strong>0.64</strong>
                <small>Mean reciprocal rank</small>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setEvalOpen(true)}>
              Read the sample report
              <ArrowUpRight size={14} />
            </Button>
          </section>
        </div>
      </div>
      <Dialog
        open={evalOpen}
        onClose={() => setEvalOpen(false)}
        title="Evaluation snapshot · sample"
      >
        <div className="stack">
          <Notice>
            Illustrative metrics for the seeded corpus. This is not a measured model evaluation.
          </Notice>
          <table>
            <thead>
              <tr>
                <th>Domain</th>
                <th>Sample result</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Knowledge retrieval', '8 / 10 hit@5'],
                ['Work tools', '5 / 5 flows completed'],
                ['Coding', '4 / 5 sample checks'],
                ['Email', '5 / 5 read-only boundaries'],
                ['Security', '5 / 5 guardrail fixtures'],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Grade the post-verification answer. Retrieval metrics are deterministic; run
            answer-quality evaluation three times per change and flag regressions outside the
            observed range.
          </p>
          <div className="row">
            <Check size={17} />
            <span>The displayed metrics are illustrative sample data.</span>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
