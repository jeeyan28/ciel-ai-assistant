import type { Json } from '../api/contract'
export function canonicalize(value: Json): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value)
    .sort()
    .map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
    .join(',')}}`
}
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}
export const hashArgs = (args: Json) => sha256(canonicalize(args))
export const byteLength = (s: string) => new TextEncoder().encode(s).byteLength
