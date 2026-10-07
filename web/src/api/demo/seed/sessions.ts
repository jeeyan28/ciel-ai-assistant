import type { Session, Message } from '../../contract'
const rows = [
  [
    'Tailscale routing, explained',
    'What does the subnet router do?',
    'Your Debian mini PC advertises the lab subnet so tailnet clients can reach local services. Approve the route in the admin console and check the return path.',
  ],
  [
    'A quieter maintenance week',
    'What should I work on next?',
    'Start with the restore test, then update the router firmware. The golden retrieval questions can follow once the backup is verified.',
  ],
  [
    'The DNS fix',
    'What caused the DNS outage?',
    'The resolver container retained a stale upstream address. Updating the address restored name resolution; the follow-up is a real DNS-query healthcheck.',
  ],
  [
    'Notes on private routing',
    'How does private routing work?',
    'Private content stays with the local provider for the rest of the session. Web search is blocked once private context is present.',
  ],
  [
    'Preparing the desk button',
    'Can the ESP32 use Tailscale?',
    'The ESP32 cannot run a Tailscale client. It needs local HTTPS access or a subnet-router path. The firmware also needs the trusted root CA.',
  ],
]
export function seedSessions(): { sessions: Session[]; messages: Message[] } {
  const sessions: Session[] = rows.map(([title], i) => ({
    id: `s0${i + 1}`,
    title,
    started_at: `2026-10-0${i < 2 ? 3 : 2}T01:00:00Z`,
    last_message_at: `2026-10-0${i < 2 ? 3 : 2}T01:05:00Z`,
    local_only: false,
  }))
  return {
    sessions,
    messages: rows.flatMap(([, question, answer], i) =>
      (['user', 'assistant'] as const).map((role, j) => ({
        id: crypto.randomUUID(),
        session_id: sessions[i].id,
        role,
        content: j ? answer : question,
        thinking: '',
        tool_calls: [],
        citations: [],
        retrieved: [],
        status: 'done',
        created_at: sessions[i].last_message_at,
      }))
    ),
  }
}
