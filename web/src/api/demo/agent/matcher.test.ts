import { describe, it, expect } from 'vitest'
import { matchScenario } from './matcher'
import { flows } from '../../../features/buildmap/catalog'
describe('scenario matcher', () => {
  it.each(flows.map(f => [f.id, f.prompt]))(
    'matches %s from its Flow Explorer prompt',
    (id, prompt) => expect(matchScenario(prompt)).toBe(id)
  )
  it.each([
    ['Write a commit message', 'S10'],
    ['Draft a reply to #2', 'S11'],
    ['Search the web for the router CVE', 'S6'],
    ['Create tasks from findings', 'S2'],
    ['Hello Ciel', 'S15'],
    ['Review the last commit on homelab-infra', 'S6'],
  ])('routes variant %s', (prompt, id) => expect(matchScenario(prompt)).toBe(id))
})
