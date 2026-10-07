import { LockKeyhole } from 'lucide-react'
import { useId } from 'react'
export type CoreState = 'idle' | 'thinking' | 'tool' | 'awaiting_confirm' | 'error' | 'local'
export function SageCore({ state = 'idle', size = 32 }: { state?: CoreState; size?: number }) {
  const id = useId()
  const color =
    state === 'awaiting_confirm'
      ? '#E9B642'
      : state === 'tool'
        ? '#58CFAB'
        : state === 'error'
          ? '#E5566D'
          : '#6CC7FA'
  return (
    <span
      className={`sage-core ${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Ciel ${state.replace('_', ' ')}`}
    >
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id={id} cx=".3" cy=".22" r=".82">
            <stop stopColor="#F0FCFF" />
            <stop offset=".45" stopColor={color} />
            <stop offset="1" stopColor={state === 'awaiting_confirm' ? '#BF8D2C' : '#369FE1'} />
          </radialGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="34"
          fill={state === 'local' ? 'none' : `url(#${id})`}
          stroke={state === 'local' ? 'var(--violet-500)' : '#7ACDF6'}
          strokeWidth="1"
        />
        <ellipse
          className="core-orbit"
          cx="50"
          cy="50"
          rx="47"
          ry="20"
          transform="rotate(-27 50 50)"
          stroke={color}
          strokeWidth="1.2"
          opacity=".8"
        />
        <circle cx="86" cy="26" r="3" fill={color} />
        <path
          d="M34 27c-7 4-11 10-12 17"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="3"
          opacity=".55"
        />
      </svg>
      {state === 'local' && <LockKeyhole className="core-lock" size={size * 0.28} />}
    </span>
  )
}
