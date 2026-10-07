import { useId } from 'react'
export function Logo({
  markOnly = false,
  mono = false,
  size = 38,
}: {
  markOnly?: boolean
  mono?: boolean
  size?: number
}) {
  const id = useId()
  return (
    <span className="logo">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="15" y1="10" x2="49" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#BAEAFF" />
            <stop offset=".5" stopColor="#63C5FA" />
            <stop offset="1" stopColor="#289BE0" />
          </linearGradient>
        </defs>
        <path
          d="M32 7C27 16 10 24 10 39c0 12 9 19 22 19s22-7 22-19C54 24 37 16 32 7Z"
          fill={mono ? 'currentColor' : `url(#${id})`}
        />
        <path
          d="M24 23c-5 5-8 10-8 15"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity=".65"
        />
        <ellipse
          cx="32"
          cy="38"
          rx="29"
          ry="10"
          transform="rotate(-25 32 38)"
          stroke={mono ? 'currentColor' : '#2788BC'}
          strokeWidth="1.4"
        />
        <path
          d="M8 43c9 5 32 1 46-11"
          stroke={mono ? 'currentColor' : '#D9F4FF'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {!markOnly && (
        <span className="wordmark">
          Ciel<span className="wordmark-dot">.</span>
        </span>
      )}
    </span>
  )
}
