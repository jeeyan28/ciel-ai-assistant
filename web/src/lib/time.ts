import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
export const TIMEZONE = 'Asia/Manila'
export const DEMO_NOW = '2026-10-04T09:30:00+08:00'
export function formatDate(value: string | number | Date, pattern = 'd MMM yyyy') {
  return formatInTimeZone(new Date(value), TIMEZONE, pattern)
}
export function relativeDate(value: string | null) {
  if (!value) return 'No due date'
  const date = formatDate(value, 'yyyy-MM-dd')
  if (date === '2026-10-04') return 'Today'
  if (date === '2026-10-05') return 'Tomorrow'
  if (date === '2026-10-03') return 'Yesterday'
  return formatDate(value, 'EEE, d MMM')
}
export function resolveDate(text: string): string {
  const lower = text.toLowerCase()
  const day = lower.includes('friday')
    ? '2026-10-09'
    : lower.includes('yesterday')
      ? '2026-10-03'
      : lower.includes('tomorrow')
        ? '2026-10-05'
        : '2026-10-04'
  const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/)
  let hour = match ? Number(match[1]) % 12 : 9
  if (match?.[3] === 'pm') hour += 12
  const minute = match?.[2] ?? '00'
  return `${day}T${String(hour).padStart(2, '0')}:${minute}:00+08:00`
}
export function localInputToIso(value: string) {
  return value ? fromZonedTime(value, TIMEZONE).toISOString() : null
}
export function taskGroup(due: string | null, status: string) {
  if (status === 'done') return 'Done'
  if (!due) return 'Later'
  const d = formatDate(due, 'yyyy-MM-dd')
  return d < '2026-10-04'
    ? 'Overdue'
    : d === '2026-10-04'
      ? 'Today'
      : d <= '2026-10-10'
        ? 'This week'
        : 'Later'
}
