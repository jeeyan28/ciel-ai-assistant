import { describe, it, expect, vi } from 'vitest'
import { createConfirmation, resolveConfirmation } from './guardrails'
const pending = () =>
  createConfirmation(
    crypto.randomUUID(),
    'session',
    'add_task',
    { title: 'Renew TLS', due_at: '2026-10-09T17:00:00+08:00' },
    1000
  )
describe('confirmation lifecycle', () => {
  it('approves once with exact stored arguments', async () => {
    const p = await pending()
    const execute = vi.fn(async () => 'created')
    expect(await resolveConfirmation(p, 'approve', execute, 2000)).toBe('executed')
    expect(execute).toHaveBeenCalledWith(p.args)
    expect(execute).toHaveBeenCalledTimes(1)
    await expect(resolveConfirmation(p, 'approve', execute, 2100)).rejects.toMatchObject({
      code: 'confirmation_consumed',
      status: 409,
    })
  })
  it('denies without invoking the write handler', async () => {
    const p = await pending(),
      execute = vi.fn(async () => 'created')
    expect(await resolveConfirmation(p, 'deny', execute, 2000)).toBe('denied')
    expect(execute).not.toHaveBeenCalled()
  })
  it('auto-denies at the exact five-minute boundary', async () => {
    const p = await pending(),
      execute = vi.fn(async () => 'created')
    expect(await resolveConfirmation(p, 'approve', execute, 301000)).toBe('expired')
    expect(p.result).toBe('confirmation expired')
    expect(execute).not.toHaveBeenCalled()
  })
  it('rejects modified arguments without executing', async () => {
    const p = await pending(),
      execute = vi.fn(async () => 'created')
    p.args.title = 'Different action'
    await expect(resolveConfirmation(p, 'approve', execute, 2000)).rejects.toMatchObject({
      code: 'confirmation_modified',
    })
    expect(execute).not.toHaveBeenCalled()
  })
  it('atomically prevents simultaneous approvals from duplicating a write', async () => {
    const p = await pending(),
      execute = vi.fn(async () => 'created')
    const results = await Promise.allSettled([
      resolveConfirmation(p, 'approve', execute, 2000),
      resolveConfirmation(p, 'approve', execute, 2000),
    ])
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect(execute).toHaveBeenCalledTimes(1)
  })
  it('detects args mutated while the hash is resolving', async () => {
    const p = await pending(),
      execute = vi.fn(async () => 'created')
    const result = resolveConfirmation(p, 'approve', execute, 2000)
    p.args.title = 'changed during crypto digest'
    await expect(result).rejects.toMatchObject({ code: 'confirmation_modified' })
    expect(execute).not.toHaveBeenCalled()
  })
})
