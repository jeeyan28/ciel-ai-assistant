export type ScenarioId =
  | 'S1'
  | 'S2'
  | 'S3'
  | 'S4'
  | 'S5'
  | 'S6'
  | 'S7'
  | 'S8'
  | 'S9'
  | 'S10'
  | 'S11'
  | 'S12'
  | 'S13'
  | 'S14'
  | 'S15'
export function matchScenario(input: string): ScenarioId {
  const text = input.toLowerCase().trim()
  if (/trigger error|provider_rate_limited|agent_loop_limit|tool_timeout|rate_limited/.test(text))
    return 'S14'
  if (/delete everything|email my boss|send.email|shell.exec/.test(text)) return 'S8'
  if (/vpn|injection/.test(text)) return 'S7'
  if (
    /home ?lab network|private note|private network|search the web|web search|homelab-infra/.test(
      text
    )
  )
    return 'S6'
  if (/yesterday|capture.*postgres/.test(text)) return 'S5'
  if (/remind|renew.*cert|create tasks? from|add.*task|update.*task|mark.*task/.test(text))
    return 'S2'
  if (/save.*note|\/note|capture.*note/.test(text)) return 'S3'
  if (/what.*due|list.*task|this week|\/task|project status/.test(text)) return 'S4'
  if (/scan|secrets|dependencies/.test(text)) return 'S9'
  if (/review.*commit|review.*code|commit message|git diff/.test(text)) return 'S10'
  if (/email|mail|draft.*reply/.test(text)) return 'S11'
  if (/cve-|advisory|threat/.test(text)) return 'S12'
  if (/desk button|device|\/brief/.test(text)) return 'S13'
  if (/tailscale|subnet|search|note.*about|find.*note|what.*note/.test(text)) return 'S1'
  return 'S15'
}
