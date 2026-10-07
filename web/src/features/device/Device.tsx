import { useEffect, useState } from 'react'
import {
  Radio,
  Wifi,
  ShieldCheck,
  KeyRound,
  Power,
  Check,
  X,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import { demoActions, useDemo } from '../../state/demo.store'
import { toast } from '../../state/ui.store'
import {
  PageHeading,
  Button,
  Badge,
  Dialog,
  Notice,
  CodeBlock,
  Skeleton,
  ErrorState,
  EmptyState,
  Lens,
} from '../../design/primitives'
import { AudioPlayer } from '../voice/AudioPlayer'
export default function Device() {
  const query = useQuery(() => api.deviceStatus())
  const [age, setAge] = useState(12),
    [press, setPress] = useState(0),
    [rotate, setRotate] = useState(false),
    [token, setToken] = useState('')
  const device = query.data,
    demo = useDemo()
  useEffect(() => {
    const t = setInterval(() => setAge(a => a + 1), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="data-page device-page page-enter">
      <PageHeading
        title="A small connection"
        description="Your desk button. A brief pause, one press away."
        addon="Device"
      />
      <Lens
        endpoint="GET /device/status · POST /brief/voice"
        refs="FR-19 · GR-17"
        milestone="Device"
      />
      {query.loading ? (
        <Skeleton rows={6} />
      ) : query.error ? (
        <ErrorState
          message={query.error}
          retry={() => {
            if (demo.publicMode) demo.set({ publicMode: false })
            void query.refresh()
          }}
        />
      ) : !device ? (
        <EmptyState
          title="No device connected."
          description="Try the virtual desk button to explore the scoped brief pipeline."
          action="Load demo device"
          onAction={() => {
            demo.set({ screenState: 'normal' })
            void query.refresh()
          }}
        />
      ) : (
        <>
          <div className="device-layout">
            <section className="device-card">
              <header>
                <span className="device-type">
                  <Radio size={22} />
                  Desk companion
                </span>
                <Badge tone={device.online ? 'mint' : 'rose'}>
                  <span className="status-dot" />
                  {device.online ? 'Online' : 'Offline'}
                </Badge>
              </header>
              <div className="virtual-device">
                <div className="device-case">
                  <span className="device-brand">ciel</span>
                  <button
                    className="virtual-button"
                    disabled={!device.online || demo.publicMode}
                    onClick={() => {
                      setPress(n => n + 1)
                      toast('Button pressed · preparing the private-filtered demo brief')
                    }}
                    aria-label="Press virtual desk button"
                  >
                    <Power size={31} strokeWidth={1.25} />
                  </button>
                  <span className={`device-led ${device.online ? 'online' : ''}`} />
                  <span className="device-grille" />
                </div>
              </div>
              <h2>A little clarity, on tap.</h2>
              <p>Press the virtual button to play today’s brief.</p>
              <div className="device-meta">
                <span>
                  <Wifi size={15} />
                  {device.rssi} dBm
                </span>
                <span>ESP32 · {device.firmware}</span>
                <span>Heartbeat {age}s ago</span>
              </div>
              <div className="device-actions">
                <Button variant="secondary" onClick={() => demoActions.offline()}>
                  {device.online ? 'Simulate device offline' : 'Bring device online'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void api
                      .deviceHeartbeat({ device_id: device.device_id })
                      .then(() => {
                        setAge(0)
                        toast('Heartbeat received', 'success')
                      })
                      .catch(e => toast(String(e), 'error'))
                  }
                >
                  <RefreshCw size={15} />
                  Heartbeat
                </Button>
              </div>
            </section>
            <section className="device-scopes">
              <h2>A key with a narrow purpose.</h2>
              <p>
                The device can request audio and report its status. Everything else stays out of
                reach.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Device access</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['/device/*', true],
                    ['/brief/voice', true],
                    ['/tts', true],
                    ['/notes', false],
                    ['/chat', false],
                    ['/sessions/*/confirm', false],
                  ].map(([route, ok]) => (
                    <tr key={String(route)}>
                      <td>
                        <code>{route}</code>
                      </td>
                      <td>
                        <Badge tone={ok ? 'mint' : 'rose'}>
                          {ok ? <Check size={12} /> : <X size={12} />} {ok ? 'Allowed' : '403'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="metadata">
                Device ID <code>{device.device_id}</code>
              </p>
              <p className="metadata">
                Backend uptime {(device.backend_uptime / 86400).toFixed(1)} days · sample
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setToken('')
                  setRotate(true)
                }}
              >
                <KeyRound size={15} />
                Rotate device token
              </Button>
              <Notice>
                <LockKeyhole size={14} />
                Private material is excluded from every device response.
              </Notice>
            </section>
          </div>
          {press > 0 && <AudioPlayer key={press} text="Daily brief" device autoPlay />}
        </>
      )}
      <Dialog open={rotate} onClose={() => setRotate(false)} title="Rotate the demo device token">
        <div className="stack">
          <Notice>Only the virtual token is rotated. No device or deployment is changed.</Notice>
          <p>
            The generated <code>demo token</code> is fictional and stays in this tab. It does not
            update a server or physical device.
          </p>
          <Button
            onClick={() => {
              setToken(`ciel_device_demo_${crypto.randomUUID()}`)
              toast('Fictional device token rotated', 'success')
            }}
          >
            <RefreshCw size={16} />
            Generate demo token
          </Button>
          {token && <CodeBlock label="scoped demo token">{token}</CodeBlock>}
          <p className="muted">
            <ShieldCheck size={14} /> Scope: /device/*, /brief/voice, /tts only.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
