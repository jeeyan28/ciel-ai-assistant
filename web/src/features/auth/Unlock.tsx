import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react'
import { Logo } from '../../design/Logo'
import { SageCore } from '../../design/SageCore'
import { Button, Input, IconButton } from '../../design/primitives'
import { DEMO_TOKEN, useAuth } from '../../state/auth.store'
export default function Unlock() {
  const [token, setToken] = useState(''),
    [visible, setVisible] = useState(false),
    [error, setError] = useState(false),
    [absorbing, setAbsorbing] = useState(false)
  const auth = useAuth()
  const navigate = useNavigate()
  if (auth.unlocked && !absorbing) return <Navigate to="/chat" replace />
  function unlock() {
    if (token.length < 32 || token === 'change-me') {
      setError(true)
      return
    }
    setAbsorbing(true)
    setTimeout(
      () => {
        auth.unlock(token)
        navigate('/chat', { replace: true })
      },
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 900
    )
  }
  return (
    <main className="unlock-page">
      <div className="sky-cloud cloud-one" />
      <div className="sky-cloud cloud-two" />
      <div className="unlock-brand">
        <Logo />
        <span>Your personal intelligence.</span>
      </div>
      <section className={`unlock-card ${absorbing ? 'absorbing' : ''} ${error ? 'shake' : ''}`}>
        <SageCore size={100} />
        <h1>Welcome back.</h1>
        <p>A little clarity for your corner of the world.</p>
        <form
          onSubmit={e => {
            e.preventDefault()
            unlock()
          }}
        >
          <label htmlFor="token">Workspace token</label>
          <div className="token-field">
            <KeyRound size={18} />
            <Input
              id="token"
              type={visible ? 'text' : 'password'}
              placeholder="Enter your CIEL_TOKEN"
              value={token}
              autoComplete="off"
              onChange={e => {
                setToken(e.target.value)
                setError(false)
              }}
              aria-invalid={error}
              aria-describedby="token-help"
            />
            <IconButton
              label={visible ? 'Hide token' : 'Show token'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </IconButton>
          </div>
          {error && (
            <p className="field-error" role="alert">
              401 invalid_token · Use at least 32 characters.
            </p>
          )}
          <p id="token-help" className="token-help">
            Held in memory only. Closing or reloading this tab locks Ciel.
          </p>
          <Button type="submit" className="unlock-submit">
            Unlock workspace
            <ArrowRight size={17} />
          </Button>
          <button
            type="button"
            className="text-link demo-token"
            onClick={() => {
              setToken(DEMO_TOKEN)
              setError(false)
            }}
          >
            Use demo token <span>↗</span>
          </button>
        </form>
        <div className="unlock-assurance">
          <ShieldCheck size={16} />
          Your workspace. Your control.
        </div>
      </section>
      <footer className="unlock-footer">
        Self-hosted<span>·</span>No telemetry<span>·</span>v0.1 demo
      </footer>
    </main>
  )
}
