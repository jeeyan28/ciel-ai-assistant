import type { Task, TaskStatus } from '../../contract'
const rows: [string, TaskStatus, string | null, string][] = [
  ['Rotate DEVICE_TOKEN', 'todo', '2026-10-05T10:00:00+08:00', 'ops'],
  ['Run Postgres restore test', 'doing', '2026-10-06T14:00:00+08:00', 'ops'],
  ['Write eval golden questions', 'todo', '2026-10-07T16:00:00+08:00', 'ciel'],
  ['Update router firmware', 'todo', '2026-10-02T18:00:00+08:00', 'homelab'],
  ['Review SSH config', 'done', '2026-10-01T10:00:00+08:00', 'homelab'],
  ['Sketch ESP32 enclosure', 'todo', '2026-10-12T15:00:00+08:00', 'homelab'],
  ['Check the nightly backup', 'todo', '2026-10-04T11:00:00+08:00', 'ops'],
  ['Finish the weekly review', 'todo', '2026-10-04T17:00:00+08:00', 'ciel'],
  ['Add DNS query healthcheck', 'doing', '2026-10-08T09:00:00+08:00', 'homelab'],
  ['Pin the embedding model', 'done', '2026-10-02T12:00:00+08:00', 'ciel'],
  ['Document VLAN firewall rules', 'todo', null, 'homelab'],
  ['Label the server cables', 'done', '2026-09-30T17:00:00+08:00', 'homelab'],
]
export function seedTasks(): Task[] {
  return rows.map(([title, status, due_at, project], i) => ({
    id: `t${String(i + 1).padStart(2, '0')}`,
    title,
    status,
    due_at,
    project,
    project_id: project === 'ciel' ? 'p01' : project === 'homelab' ? 'p03' : null,
    description: [
      'Check the current setup, record the result, and update the runbook.',
      'Keep changes scoped to the scheduled maintenance window.',
    ][i % 2],
    source: i % 3 === 0 ? 'ciel' : 'manual',
    created_at: '2026-09-29T04:00:00Z',
  }))
}
