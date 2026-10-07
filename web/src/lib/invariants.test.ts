import { describe, it, expect } from 'vitest'
import { canonicalize, hashArgs, byteLength } from './hash'
import { resolveDate, formatDate, taskGroup } from './time'
import { verifyCitations, stripUnverified } from './citations'
import { validateTags, CAPS } from './limits'
import { enforceBytes, truncateUtf8, LimitGate, toolAllowed } from '../api/demo/agent/guardrails'
describe('Manila demo clock', () => {
  it('resolves Friday at 5pm to 9 October, never the previous Friday', () =>
    expect(resolveDate('Friday at 5pm')).toBe('2026-10-09T17:00:00+08:00'))
  it('resolves yesterday and midnight without depending on the host timezone', () => {
    expect(resolveDate('yesterday at 12am')).toBe('2026-10-03T00:00:00+08:00')
    expect(resolveDate('tomorrow at 12pm')).toBe('2026-10-05T12:00:00+08:00')
    expect(formatDate('2026-10-03T17:00:00Z', 'yyyy-MM-dd')).toBe('2026-10-04')
  })
  it('groups tasks against the fixed local date', () => {
    expect(taskGroup('2026-10-02T18:00:00+08:00', 'todo')).toBe('Overdue')
    expect(taskGroup('2026-10-04T17:00:00+08:00', 'todo')).toBe('Today')
    expect(taskGroup('2026-10-09T17:00:00+08:00', 'todo')).toBe('This week')
    expect(taskGroup(null, 'done')).toBe('Done')
  })
})
describe('canonical argument hashes', () => {
  it('sorts nested object keys but preserves array order', async () => {
    const a = { z: [{ b: 2, a: 1 }, 'x'], a: true },
      b = { a: true, z: [{ a: 1, b: 2 }, 'x'] }
    expect(canonicalize(a)).toBe(canonicalize(b))
    expect(await hashArgs(a)).toBe(await hashArgs(b))
    expect(await hashArgs({ a: [1, 2] })).not.toBe(await hashArgs({ a: [2, 1] }))
  })
  it('uses actual SHA-256 bytes', async () =>
    expect(await hashArgs({})).toBe(
      '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
    ))
})
describe('verified citations', () => {
  const good = { note_id: 'n01', chunk_id: 'n01-c1', heading: 'Setup', score: 0.95 },
    bad = { note_id: 'n01', chunk_id: 'invented', heading: 'Fake', score: 0.99 }
  it('verifies both note and chunk, not just a note id', () =>
    expect(verifyCitations([good, bad], [good])).toEqual([good]))
  it('strips unknown markers while retaining verified ones', () => {
    const value = stripUnverified('Kept [[n:n01#n01-c1]] forged [[n:n01#invented]]', [good])
    expect(value.text).toBe('Kept [[n:n01#n01-c1]] forged ')
    expect(value.removed).toBe(true)
  })
})
describe('caps and validation', () => {
  it('validates complete tags, including count and length', () => {
    expect(() => validateTags(['networking', 'local-only', 'ciel_2'])).not.toThrow()
    for (const tags of [['Upper'], ['a b'], ['a'.repeat(33)], Array(11).fill('a'), ['']])
      expect(() => validateTags(tags)).toThrow()
  })
  it('counts UTF-8 bytes, including multibyte input at the boundary', () => {
    expect(byteLength('🌤')).toBe(4)
    expect(() => enforceBytes('é'.repeat(CAPS.chat / 2), CAPS.chat)).not.toThrow()
    expect(() => enforceBytes('é'.repeat(CAPS.chat / 2 + 1), CAPS.chat)).toThrow('exceeds')
  })
  it('truncates model-facing tool text without exceeding the cap', () => {
    const result = truncateUtf8('漢'.repeat(6000))
    expect(byteLength(result)).toBeLessThanOrEqual(CAPS.toolResult)
    expect(result).not.toContain('�')
    expect(result).toContain('Truncated')
  })
  it('resets a sliding request window and caps active streams', () => {
    const gate = new LimitGate()
    for (let i = 0; i < 60; i++) gate.request(1000)
    expect(() => gate.request(1001)).toThrow()
    expect(() => gate.request(61001)).not.toThrow()
    gate.open()
    gate.open()
    gate.open()
    expect(() => gate.open()).toThrow()
    gate.close()
    expect(() => gate.open()).not.toThrow()
  })
  it('enforces the four-tool MVP allowlist and sticky privacy', () => {
    expect(toolAllowed('save_note', false, false)).toBeNull()
    expect(toolAllowed('code_review', false, false)).toContain('allowlist')
    expect(toolAllowed('send_email', true, false)).toContain('allowlist')
    expect(toolAllowed('web_search', true, true)).toContain('private session')
  })
})
