import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun,
  Moon,
  ShieldCheck,
  KeyRound,
  RotateCcw,
  Route,
  Check,
  LockKeyhole,
  ExternalLink,
} from 'lucide-react'
import { useUi, toast } from '../../state/ui.store'
import { useAuth } from '../../state/auth.store'
import { useDemo } from '../../state/demo.store'
import { useChat } from '../../state/chat.store'
import {
  PageHeading,
  Button,
  Switch,
  Select,
  Input,
  Field,
  Dialog,
  Notice,
  Badge,
  CopyButton,
  Lens,
  Skeleton,
  EmptyState,
  ErrorState,
} from '../../design/primitives'
import { Logo } from '../../design/Logo'
export default function Settings() {
  const ui = useUi(),
    demo = useDemo(),
    navigate = useNavigate()
  const [reset, setReset] = useState(false),
    [rotate, setRotate] = useState(false),
    [token, setToken] = useState(''),
    [error, setError] = useState('')
  function resetAll() {
    useChat.getState().stop()
    demo.reset()
    useChat.getState().set({ current: null })
    setReset(false)
    toast('Demo reset. A fresh workspace is ready.', 'success')
    navigate('/chat')
  }
  return (
    <div className="data-page settings-page page-enter">
      <PageHeading
        title="Make a little space for you"
        description="A few preferences. Your workspace, the way you like it."
      />
      <Lens endpoint="In-memory preferences" refs="FR-20 · GR-17" milestone="Preferences" />
      {demo.screenState === 'loading' ? (
        <Skeleton rows={6} />
      ) : demo.screenState === 'empty' ? (
        <EmptyState
          title="A fresh set of preferences."
          description="Return to normal view to set up your workspace."
          action="Show preferences"
          onAction={() => demo.set({ screenState: 'normal' })}
        />
      ) : demo.screenState === 'error' ? (
        <ErrorState
          message="Sample settings view error."
          retry={() => demo.set({ screenState: 'normal' })}
        />
      ) : (
        <>
          <section className="settings-section">
            <div className="settings-label">
              <h2>Appearance</h2>
              <p>Choose the light around your work.</p>
            </div>
            <div className="settings-content">
              <div className="theme-options">
                <button
                  className={ui.theme === 'light' ? 'selected' : ''}
                  onClick={() => ui.set({ theme: 'light' })}
                >
                  <span className="theme-preview day">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <Sun size={15} />
                    Daylight{ui.theme === 'light' && <Check size={15} />}
                  </span>
                </button>
                <button
                  className={ui.theme === 'dark' ? 'selected' : ''}
                  onClick={() => ui.set({ theme: 'dark' })}
                >
                  <span className="theme-preview night">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <Moon size={15} />
                    Night Sky{ui.theme === 'dark' && <Check size={15} />}
                  </span>
                </button>
              </div>
              <div className="setting-line">
                <div>
                  <strong>Density</strong>
                  <small>A little more room, or a closer view.</small>
                </div>
                <Select
                  aria-label="Interface density"
                  value={ui.density}
                  onChange={e => ui.set({ density: e.target.value as typeof ui.density })}
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </Select>
              </div>
              <Switch
                label="Reduce motion"
                description="Use static states and short, quiet fades."
                checked={ui.reducedMotion}
                onChange={reducedMotion => ui.set({ reducedMotion })}
              />
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-label">
              <h2>Your Ciel</h2>
              <p>Start small, or see the whole picture.</p>
            </div>
            <div className="settings-content">
              <div className="setting-line">
                <div>
                  <strong>Available tools</strong>
                  <small>MVP uses exactly four tools.</small>
                </div>
                <Select
                  aria-label="Available tools mode"
                  value={demo.addOns ? 'all' : 'mvp'}
                  onChange={e => demo.set({ addOns: e.target.value === 'all' })}
                >
                  <option value="all">All add-ons</option>
                  <option value="mvp">MVP only</option>
                </Select>
              </div>
              <div className="tool-allowlist">
                {['save_note', 'search_notes', 'add_task', 'list_tasks'].map(t => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <Switch
                label="Public demo policy"
                description="Disable virtual device endpoints with 403. All data remains fictional."
                checked={demo.publicMode}
                onChange={publicMode => demo.set({ publicMode })}
              />
              <div className="setting-line">
                <div>
                  <strong>Timezone</strong>
                  <small>Fixed demo timezone.</small>
                </div>
                <span className="timezone">Asia/Manila · UTC+08</span>
              </div>
              <div className="setting-line">
                <div>
                  <strong>Demo clock</strong>
                  <small>Relative dates resolve from this moment.</small>
                </div>
                <span>4 Oct 2026 · 9:30 AM</span>
              </div>
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-label">
              <h2>Privacy & access</h2>
              <p>The boundaries are part of the product.</p>
            </div>
            <div className="settings-content">
              <div className="privacy-points">
                <p>
                  <ShieldCheck size={18} />
                  No telemetry, remote fonts, or third-party scripts.
                </p>
                <p>
                  <LockKeyhole size={18} />
                  Your token lives only in memory. Reloading locks Ciel.
                </p>
                <p>
                  <ShieldCheck size={18} />
                  Private notes stay local. Device briefs exclude them.
                </p>
              </div>
              <Notice>
                This demo keeps fictional data in this tab’s memory. Reloading restores the sample
                workspace.
              </Notice>
              <div className="setting-line">
                <div>
                  <strong>Workspace token</strong>
                  <small>Rotate the token without writing it to browser storage.</small>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setToken('')
                    setError('')
                    setRotate(true)
                  }}
                >
                  <KeyRound size={15} />
                  Rotate token
                </Button>
              </div>
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-label">
              <h2>Explore again</h2>
              <p>A safe place to try things.</p>
            </div>
            <div className="settings-content">
              <div className="setting-line">
                <div>
                  <strong>Guided flows</strong>
                  <small>14 ways to understand the whole system.</small>
                </div>
                <Button variant="secondary" onClick={() => ui.set({ tour: true, explored: [] })}>
                  <Route size={15} />
                  Replay tour
                </Button>
              </div>
              <div className="setting-line">
                <div>
                  <strong>Reset demo data</strong>
                  <small>Restore the notes, tasks, and conversations you started with.</small>
                </div>
                <Button variant="danger" onClick={() => setReset(true)}>
                  <RotateCcw size={15} />
                  Reset demo
                </Button>
              </div>
            </div>
          </section>
          <section className="settings-about">
            <Logo />
            <div>
              <strong>Your personal intelligence.</strong>
              <p>v0.1 demo · MIT license · Self-hosted</p>
            </div>
            <span className="inert-doc">
              <ExternalLink size={13} />
              docs/api.md
              <CopyButton text="docs/api.md" label="Copy path" />
            </span>
          </section>
        </>
      )}
      <Dialog title="Start fresh?" open={reset} onClose={() => setReset(false)}>
        <div className="stack">
          <p>
            Your demo notes, tasks, approvals, and tour progress will return to the seed. Changes
            made in this tab will be removed.
          </p>
          <div className="row">
            <Button variant="secondary" onClick={() => setReset(false)}>
              Keep exploring
            </Button>
            <Button variant="danger" onClick={resetAll}>
              Reset demo data
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog title="Rotate your workspace token" open={rotate} onClose={() => setRotate(false)}>
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault()
            if (!useAuth.getState().unlock(token)) {
              setError('Use at least 32 characters; change-me is rejected.')
              return
            }
            setRotate(false)
            setToken('')
            toast('Token replaced in memory', 'success')
          }}
        >
          <Notice>
            Enter a replacement workspace token of at least <code>32 characters</code>. This demo
            validates its format and keeps it in memory.
          </Notice>
          <Field label="New workspace token">
            <Input
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={e => setToken(e.target.value)}
            />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit">Use new token</Button>
        </form>
      </Dialog>
    </div>
  )
}
