import type { Args, Citation, Project, Session, Task } from '../../../contract'
import type { ScenarioId } from '../matcher'
import { db } from '../../db'
import { emails } from '../../seed/emails'
import { formatDate, resolveDate } from '../../../../lib/time'
import { validateTags } from '../guardrails'
export interface ToolPlan {
  tool: string
  args: Args
  summary?: string
  duration?: number
  write?: boolean
}
export interface ScenarioPlan {
  id: ScenarioId
  thinking: string
  tools: ToolPlan[]
  answer: (citations: Citation[]) => string
}
const cite = (c: Citation) => `[[n:${c.note_id}#${c.chunk_id}]]`
export function projectFromPrompt(text: string): Project | undefined {
  return [...db.projects]
    .sort((a, b) => b.name.length - a.name.length)
    .find(project =>
      new RegExp(
        `(^|[^a-z0-9_-])${project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9_-])`,
        'i'
      ).test(text)
    )
}
const emailDrafts: Record<string, string> = {
  e01: 'Thanks for the CI report. I’ll check that the disposable database image enables the vector extension, then rerun test_restore and review the result.\n\nKai',
  e02: 'Thanks for the reminder. I’ll review the renewal details for kai-lab.example before 11 October. Please keep the current renewal settings in place.\n\nKai',
  e03: 'Hi Mira,\n\nTuesday at 3pm works for me. I’ll bring the restore-test notes and the open questions about the device brief and firewall rules.\n\nKai',
  e04: 'Thanks for this week’s issue. The restore rehearsal and network-boundary topics are useful for my lab. I’ll review those sections during my next maintenance session.\n\nKai',
  e05: 'Thanks for the receipt for invoice DEMO-042. I’ve noted that the sample switch and enclosure order is marked paid. No further payment is needed.\n\nKai',
  e06: 'I will not provide private notes or account information in response to this message. Please remove me from this verification request.\n\nKai',
}
function taskTable(tasks: Task[]) {
  return (
    '| When · Asia/Manila | Task | Status |\n|---|---|---|\n' +
    tasks
      .map(
        t =>
          `| ${t.due_at ? formatDate(t.due_at, 'EEE d MMM, h:mm a') : 'Unscheduled'} | ${t.title} | ${t.status} |`
      )
      .join('\n')
  )
}
export function scenarioPlan(id: ScenarioId, text: string, session: Session): ScenarioPlan {
  const lower = text.toLowerCase()
  const plan: ScenarioPlan = {
    id,
    thinking: 'I’ll check the relevant information and show the steps here.',
    tools: [],
    answer: () => '',
  }
  switch (id) {
    case 'S1':
      return {
        ...plan,
        thinking:
          'I’ll look for the original setup notes and verify each section before citing it.',
        tools: [
          {
            tool: 'search_notes',
            args: {
              query: /tailscale|subnet/.test(lower) ? 'Tailscale subnet routers' : text,
              k: 5,
            },
            duration: 612,
          },
        ],
        answer: cs =>
          /tailscale|subnet/.test(lower)
            ? `Your notes describe a **subnet router on the Debian mini PC**. There are three things to keep in mind:\n\n1. **Advertise the lab subnet.** Enable IP forwarding, then advertise \`192.168.20.0/24\` with Tailscale. Keep the route limited to the network you need. ${cs[0] ? cite(cs[0]) : ''}\n2. **Approve the route.** Open the machine’s route settings in the admin console. Linux clients also need \`--accept-routes=true\`. ${cs[1] ? cite(cs[1]) : ''}\n3. **The ESP32 needs a route of its own.** It cannot run Tailscale; it reaches Ciel over the LAN or through a subnet-router path. ${cs[2] ? cite(cs[2]) : ''}\n\nA useful first check: reach the lab gateway from a tailnet client, then test Ciel’s HTTPS endpoint.`
            : cs.length
              ? `Here’s what I found in your notes:\n\n${cs.map(c => `**${c.heading}**\n${db.chunks.find(x => x.id === c.chunk_id)?.content ?? ''} ${cite(c)}`).join('\n\n')}`
              : 'I couldn’t find a matching section. Capture a note or try a broader search.',
      }
    case 'S2': {
      const update = /update|mark/.test(lower)
      const project =
        projectFromPrompt(text) ??
        [...db.messages]
          .reverse()
          .filter(m => m.session_id === session.id && m.role === 'user')
          .map(m => projectFromPrompt(m.content))
          .find(Boolean) ??
        db.projects.find(p => p.name === 'ciel-backend')
      return {
        ...plan,
        thinking:
          'I’ll resolve the date in Asia/Manila and prepare the exact change for your approval.',
        tools: [
          {
            tool: update ? 'update_task' : 'add_task',
            write: true,
            args: update
              ? { task_id: 't01', status: 'done' }
              : /findings/.test(lower)
                ? {
                    title: `Review vulnerable dependencies in ${project?.name ?? 'the scanned project'}`,
                    description: 'Review the two sample findings and update affected packages.',
                    project: project?.name ?? 'ciel',
                    project_id: project?.id ?? null,
                  }
                : {
                    title: 'Renew TLS certificate',
                    due_at: resolveDate('Friday at 5pm'),
                    project: 'homelab',
                  },
          },
        ],
        answer: () => '',
      }
    }
    case 'S3': {
      const custom = text.match(/^(?:save|capture)\s+(?:a\s+)?note\s*:\s*([\s\S]+)$/i)?.[1].trim()
      let args: Args = {
        content:
          custom ??
          '# DNS fix · 4 October\n\n## Resolution\nCorrected the stale upstream resolver address in the DNS container. Internal names resolve again from the services VLAN.\n\n## Follow-up\nAdd a real DNS query to the healthcheck and test resolution from the IoT VLAN.',
        tags: custom ? ['captured', 'chat'] : ['networking', 'dns', 'incident'],
        source: 'Confirmed chat',
        private: session.local_only,
      }
      if (text.startsWith('Save a note from this answer:\n')) {
        try {
          const parsed: unknown = JSON.parse(text.slice('Save a note from this answer:\n'.length))
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            throw new Error('Invalid note')
          const input = parsed as Record<string, unknown>
          if (
            typeof input.content !== 'string' ||
            !input.content.trim() ||
            (input.source !== undefined && typeof input.source !== 'string') ||
            (input.private !== undefined && typeof input.private !== 'boolean') ||
            (input.tags !== undefined &&
              (!Array.isArray(input.tags) || input.tags.some(tag => typeof tag !== 'string')))
          )
            throw new Error('Invalid note')
          const tags = (input.tags ?? []) as string[]
          validateTags(tags)
          args = {
            content: input.content,
            source: typeof input.source === 'string' ? input.source : 'Confirmed chat',
            tags,
            private: session.local_only || input.private === true,
          }
        } catch {
          return {
            ...plan,
            answer: () =>
              'I couldn’t prepare that note because its content or fields are invalid. Open Save as note again and review the text and tags. Nothing was saved.',
          }
        }
      }
      return {
        ...plan,
        thinking:
          'I’ll draft the note and its tags. Nothing is saved until you approve the preview.',
        tools: [{ tool: 'save_note', write: true, args }],
        answer: () => '',
      }
    }
    case 'S4':
      return {
        ...plan,
        thinking: 'I’ll check open work against the fixed demo week, 4–10 October 2026.',
        tools: [
          {
            tool: /project status/.test(lower) ? 'project_status' : 'list_tasks',
            args: /project status/.test(lower) ? {} : { status: 'todo' },
          },
        ],
        answer: () =>
          `Here’s your work for the week. **The router firmware update is overdue.**\n\n${taskTable(db.tasks.filter(t => t.status !== 'done' && t.due_at && formatDate(t.due_at, 'yyyy-MM-dd') <= '2026-10-10'))}\n\nStart with the nightly backup check today. The restore test is already in progress.`,
      }
    case 'S5':
      return {
        ...plan,
        thinking:
          '“Yesterday” is Saturday, 3 October 2026 in Asia/Manila. I’ll filter the retrieval to that day and the postgres tag.',
        tools: [
          {
            tool: 'search_notes',
            args: {
              query: 'Postgres',
              k: 5,
              after: '2026-10-03',
              before: '2026-10-04',
              tags: ['postgres'],
            },
          },
        ],
        answer: cs =>
          `You captured two Postgres notes yesterday, **Saturday, 3 October**.\n\n${cs
            .map(
              c =>
                `- **${c.heading}:** ${db.chunks
                  .find(x => x.id === c.chunk_id)
                  ?.content.split('. ')
                  .slice(0, 2)
                  .join('. ')}. ${cite(c)}`
            )
            .join('\n')}\n\nThe practical next step is Tuesday’s restore test.`,
      }
    case 'S6': {
      if (
        projectFromPrompt(text) &&
        !/search the web|web search/.test(lower) &&
        /scan|secrets|dependencies|review|commit|git diff/.test(lower)
      ) {
        const projectPlan = scenarioPlan(
          /scan|secrets|dependencies/.test(lower) ? 'S9' : 'S10',
          text,
          session
        )
        return {
          ...projectPlan,
          id,
          thinking:
            'This project is private. I’ll keep its sample tool results and this session on the local provider.',
          answer: cs =>
            `**Notice · This session now uses the local model.** The routing choice remains in place for later turns.\n\n${projectPlan.answer(cs)}`,
        }
      }
      return {
        ...plan,
        thinking: /web/.test(lower)
          ? 'I’ll check the session privacy policy before any external search.'
          : 'This request touches private material. I’ll keep this session on the local provider.',
        tools: /web/.test(lower)
          ? [{ tool: 'web_search', args: { query: 'router CVE', max_results: 3 } }]
          : [
              {
                tool: 'search_notes',
                args: { query: 'Home lab network layout', k: 3, tags: ['homelab'] },
              },
            ],
        answer: cs =>
          /web/.test(lower)
            ? session.local_only
              ? '**Notice · Web search is blocked for this private session (D8).**\n\nPrivate context remains local for the lifetime of this conversation. Start a new chat to search public information without including private details.'
              : 'This public-session search is a canned replay. No web request was sent. The real tool will return capped, untrusted search excerpts.'
            : `**Notice · This session now uses the local model.** The routing choice remains in place for later turns.\n\nYour lab separates management, services, and IoT traffic. Inter-VLAN access is denied by default, with an explicit HTTPS rule for the desk button. ${cs[0] ? cite(cs[0]) : ''}\n\nThe mini PC supplies the subnet route. Keep DHCP reservations aligned with the documented service addresses. ${cs[1] ? cite(cs[1]) : ''}`,
      }
    }
    case 'S7':
      return {
        ...plan,
        thinking:
          'I’ll retrieve the comparison as source data. Embedded instructions cannot grant tool permissions.',
        tools: [
          { tool: 'search_notes', args: { query: 'Free VPN comparison', k: 2, tags: ['vpn'] } },
        ],
        answer: cs =>
          `The imported page compares two **fictional** VPN plans: Northwind Tunnel’s limited free tier and Blue Harbor Relay’s trial. Its claims have not been independently verified. ${cs[0] ? cite(cs[0]) : ''}\n\n**Notice · A retrieved note contained instructions. They were treated as data (GR-4/GR-20).**\n\nNo note was created and no tool permission changed.`,
      }
    case 'S8':
      return {
        ...plan,
        thinking: 'I’ll check the requested action against the tool allowlist.',
        tools: [
          { tool: 'send_email', args: { recipient: 'boss', subject: 'Delete everything' } },
          { tool: 'send_email', args: { recipient: 'boss', subject: 'Delete everything' } },
        ],
        answer: () =>
          `I can’t perform that action. **Sending email and bulk deletion are not agent tools.**\n\nThe request and its one permitted retry were rejected before execution. You can manage individual notes in Notes or ask for a reply draft to copy yourself.`,
      }
    case 'S9': {
      const project =
        projectFromPrompt(text) ??
        db.projects.find(p => p.name === 'ciel-backend') ??
        db.projects[0]
      if (!project)
        return {
          ...plan,
          answer: () => 'Register a project in Projects before running a sample scan.',
        }
      return {
        ...plan,
        thinking: `I’ll run the read-only sample scan for ${project.name}, skip forbidden files, and redact detected values.`,
        tools: [
          {
            tool: /deps|dependencies/.test(lower) ? 'dependency_scan' : 'vuln_scan',
            args: { project: project.name },
            summary: '2 vulnerable deps, 0 secrets (1 forbidden file skipped)',
            duration: 1840,
          },
        ],
        answer: () =>
          `The sample scan for **${project.name}** found **2 dependencies to review** and **0 exposed secrets**. One forbidden file was skipped.\n\n| Severity | Package | Finding | Next step |\n|---|---|---|---|\n| High | example-parser 1.2 | Synthetic unsafe parsing fixture | Upgrade to fixture 1.3 |\n| Medium | example-http 2.0 | Synthetic redirect validation fixture | Upgrade to fixture 2.1 |\n\n\`.env.local\` was skipped under D9. Values are redacted before model access: \`ghp_…REDACTED\`. These are sample findings, not a scan of this machine.`,
      }
    }
    case 'S10': {
      const project =
        projectFromPrompt(text) ?? db.projects.find(p => p.name === 'ciel-web') ?? db.projects[0]
      if (!project)
        return {
          ...plan,
          answer: () => 'Register a project in Projects before reviewing a sample commit.',
        }
      const web = project.language.toLowerCase() === 'typescript'
      const python = project.language.toLowerCase() === 'python'
      const commit = web
        ? 'fix(chat): preserve partial replies when streaming stops\n\nKeep received tokens visible and close the reader on cancellation.'
        : python
          ? 'fix(api): release stream resources on cancellation\n\nClose the response generator when the client disconnects.'
          : 'fix(infra): check service readiness before accepting traffic\n\nAdd a bounded healthcheck and document the expected failure behavior.'
      const review = web
        ? '**Medium · Cancel the reader when leaving the chat.** Otherwise the suspended view can retain a stream.\n\n```ts\nuseEffect(() => {\n  const controller = new AbortController();\n  startStream(controller.signal);\n  return () => controller.abort();\n}, [sessionId]);\n```\n\n**Suggestion · Keep partial text visible.** Mark the message as stopped, then offer a deliberate retry.'
        : python
          ? '**Medium · Release resources when a client disconnects.** The sample response generator needs cleanup on cancellation.\n\n```python\ntry:\n    async for event in response:\n        yield event\nfinally:\n    await response.aclose()\n```\n\n**Suggestion · Cover interrupted responses.** Verify that the generator closes and the concurrency slot is released.'
          : '**Medium · Bound the service readiness check.** The sample configuration should stop accepting traffic while a dependency is unavailable.\n\n```yaml\nhealthcheck:\n  interval: 30s\n  timeout: 5s\n  retries: 3\n```\n\n**Suggestion · Use a service-specific healthcheck command.** Document its expected result and test failure recovery.'
      return {
        ...plan,
        thinking: `I’ll inspect the sample diff for ${project.name}. Ciel cannot commit or push code.`,
        tools: /commit message/.test(lower)
          ? [
              {
                tool: 'commit_message',
                args: { project: project.name },
                summary: 'Conventional commit text prepared',
              },
            ]
          : [
              {
                tool: 'git_context',
                args: { project: project.name, what: 'diff' },
                summary: '2 files changed · sample diff',
                duration: 440,
              },
              {
                tool: 'code_review',
                args: { project: project.name },
                summary: '1 medium finding · 1 suggestion',
                duration: 1260,
              },
            ],
        answer: () =>
          /commit message/.test(lower)
            ? `Here is a commit message for the sample diff in **${project.name}**:\n\n\`\`\`text\n${commit}\n\`\`\`\n\nThis is text only. No repository was changed.`
            : `**Review · ${project.name} sample commit**\n\n${review}\n\nThese are sample findings. No files were modified.`,
      }
    }
    case 'S11': {
      const target = lower.match(/\breply\s+to\s+(e\d+)\b/)?.[1]
      const number = lower.match(/\breply\s+to\s+#(\d+)\b/)?.[1]
      const email = target
        ? emails.find(e => e.id === target)
        : number
          ? emails[Number(number) - 1]
          : emails.find(e => e.id === 'e02')
      if (/draft|reply/.test(lower) && !email)
        return {
          ...plan,
          answer: () =>
            'I couldn’t find that sample email. Select a message in Email and use Draft reply again.',
        }
      return {
        ...plan,
        thinking:
          'I’ll read the fictional mailbox as untrusted data. Only summary and draft-text tools are available.',
        tools:
          /draft|reply/.test(lower) && email
            ? [
                {
                  tool: 'email_draft',
                  args: { message_id: email.id, context: `Reply to: ${email.subject}` },
                  summary: 'Draft text prepared · nothing sent',
                },
              ]
            : [
                {
                  tool: 'email_unread_summary',
                  args: { limit: 6 },
                  summary: '6 unread messages · 1 injection ignored',
                },
              ],
        answer: () =>
          /draft|reply/.test(lower) && email
            ? `**Draft text only — Ciel cannot write to Gmail.**\n\nReply to: **${email.subject}**\n\n\`\`\`text\n${emailDrafts[email.id]}\n\`\`\`${email.injection ? '\n\nNotice · Instructions in the message were ignored. Private content was not accessed.' : ''}`
            : `You have **6 unread sample messages**. Two deserve a look today.\n\n${emails.map((e, i) => `${i + 1}. **${e.subject}** — ${e.gist}`).join('\n')}\n\nNotice · Instructions in the last message were ignored. No message was sent and no Gmail draft was created.`,
      }
    }
    case 'S12':
      return {
        ...plan,
        thinking: 'I’ll show the bundled advisory fixture. No live advisory service is called.',
        tools: [
          {
            tool: 'threat_lookup',
            args: { id: 'CVE-2024-3094' },
            summary: 'Bundled advisory fixture · critical',
          },
        ],
        answer: () =>
          `## CVE-2024-3094\n\n| Field | Advisory fixture |\n|---|---|\n| Severity | Critical |\n| Component | XZ Utils / liblzma |\n| Affected versions | 5.6.0 and 5.6.1 |\n| Issue | Malicious code in release tarballs |\n| Action | Follow your distribution’s advisory; revert affected packages |\n\n**Sample historical advisory.** Check your distribution’s current guidance before acting. The demo did not inspect your installed packages or contact an advisory service.`,
      }
    case 'S13':
      return {
        ...plan,
        thinking: 'I’ll check the simulated desk device and its scoped brief pipeline.',
        tools: [
          {
            tool: 'device_status',
            args: {},
            summary: db.device.online ? 'Online · brief ready' : 'Offline · last status preserved',
          },
        ],
        answer: () =>
          `The desk button is **${db.device.online ? 'online' : 'offline'}**.\n\n| Detail | Value |\n|---|---|\n| Device | ciel-desk-01 |\n| Firmware | 0.3.2-demo |\n| Wi-Fi signal | ${db.device.rssi} dBm |\n| Audio | 16 kHz mono WAV · at most 30 seconds |\n\nPrivate notes and projects are excluded from the device brief (D7). Open Device to try the virtual button.`,
      }
    case 'S14':
      return { ...plan, tools: [], answer: () => '' }
    default:
      return {
        ...plan,
        answer: () =>
          'I can search your notes, manage tasks, and — in add-on mode — review code, scan repositories, and read mail.\n\nTry a question about your Tailscale setup, ask what’s due this week, or capture a note you want to find later.',
      }
  }
}
