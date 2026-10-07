import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  NotebookPen,
  ListTodo,
  FolderKanban,
  Activity,
  Sun,
  Mail,
  Mic,
  Radio,
  HeartPulse,
  Map,
  Settings,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  LockKeyhole,
  Moon,
  ArrowUpRight,
  ChevronRight,
  Command,
  MoreHorizontal,
  Code2,
  BookOpen,
} from 'lucide-react'
import { Logo } from '../../design/Logo'
import { SageCore } from '../../design/SageCore'
import { Badge, IconButton, Dialog, Kbd, Select, Switch } from '../../design/primitives'
import { useUi } from '../../state/ui.store'
import { useAuth } from '../../state/auth.store'
import { useDemo } from '../../state/demo.store'
import { useChat } from '../../state/chat.store'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import { CommandPalette } from './CommandPalette'
import { FlowExplorer } from '../tour/FlowExplorer'
import type { ErrorCode } from '../../api/contract'
const groups = [
  {
    name: 'Workspace',
    items: [
      { to: '/chat', name: 'Chat', icon: MessageSquare },
      { to: '/notes', name: 'Notes', icon: NotebookPen },
      { to: '/tasks', name: 'Tasks', icon: ListTodo },
    ],
  },
  {
    name: 'Operate',
    items: [
      { to: '/audit', name: 'Audit trail', icon: Activity },
      { to: '/projects', name: 'Projects', icon: FolderKanban, tag: 'Code' },
      { to: '/brief', name: 'Daily brief', icon: Sun, tag: 'Brief' },
    ],
  },
  {
    name: 'Connect',
    items: [
      { to: '/email', name: 'Email', icon: Mail, tag: 'Mail' },
      { to: '/voice', name: 'Voice', icon: Mic, tag: 'Voice' },
      { to: '/device', name: 'Desk device', icon: Radio, tag: 'Device' },
    ],
  },
  {
    name: 'System',
    items: [
      { to: '/system', name: 'Health & limits', icon: HeartPulse },
      { to: '/buildmap', name: 'Build Map', icon: Map },
      { to: '/settings', name: 'Settings', icon: Settings },
    ],
  },
]
export function Shell() {
  const ui = useUi(),
    demo = useDemo(),
    location = useLocation(),
    navigate = useNavigate()
  const { data: sessions } = useQuery(() => api.listSessions())
  const gKey = useRef(false)
  const title =
    groups.flatMap(g => g.items).find(i => location.pathname.startsWith(i.to))?.name ?? 'Workspace'
  const busy = useChat(s => s.busy)
  useEffect(() => {
    document.title = `${title} · Ciel`
    useUi.getState().set({ mobileMenu: false })
  }, [location.pathname, title])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const keys = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.matches('input,textarea,select,[contenteditable="true"]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        useUi.getState().set({ palette: !useUi.getState().palette })
        return
      }
      if (typing || document.querySelector('dialog[open]')) return
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        useUi.getState().set({ devLens: !useUi.getState().devLens })
      }
      if (e.key === '?') useUi.getState().set({ shortcuts: true })
      if (gKey.current) {
        const routes: Record<string, string> = { c: '/chat', n: '/notes', t: '/tasks' }
        if (routes[e.key]) navigate(routes[e.key])
        gKey.current = false
      } else if (e.key === 'g') {
        gKey.current = true
        timer = setTimeout(() => {
          gKey.current = false
        }, 900)
      }
    }
    window.addEventListener('keydown', keys)
    return () => {
      window.removeEventListener('keydown', keys)
      clearTimeout(timer)
    }
  }, [navigate])
  return (
    <div
      className={`app-shell ${ui.collapsed ? 'rail-collapsed' : ''} ${ui.mobileMenu ? 'mobile-menu-open' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
          <IconButton
            label={ui.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => ui.set({ collapsed: !ui.collapsed })}
          >
            {ui.collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </IconButton>
        </div>
        <button className="workspace-select" onClick={() => navigate('/settings')}>
          <span className="workspace-avatar">K</span>
          <span>
            Kai’s workspace<small>Personal · self-hosted</small>
          </span>
          <ChevronRight size={14} />
        </button>
        <nav aria-label="Main navigation">
          {groups.map(group => (
            <div className="nav-group" key={group.name}>
              <div className="nav-label">{group.name}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.name}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  <item.icon size={18} strokeWidth={1.75} />
                  <span>{item.name}</span>
                  {'tag' in item && <small>{item.tag}</small>}
                  {item.to === '/notes' && <span className="nav-dot" />}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-tour">
          <span className="tour-icon">
            <BookOpen size={18} />
          </span>
          <div>
            <strong>Get to know Ciel</strong>
            <span>Explore the complete flow.</span>
          </div>
          <button aria-label="Open Flow Explorer" onClick={() => ui.set({ tour: true })}>
            <ArrowUpRight size={17} />
          </button>
        </div>
        <footer className="sidebar-footer">
          <div className="sidebar-status">
            <SageCore size={28} state={busy ? 'thinking' : 'idle'} />
            <span>
              All systems calm<small>Ready · Groq · llama (demo)</small>
            </span>
            <i />
          </div>
          <div className="sidebar-footer-actions">
            <span>
              v0.1 <span className="faint">/</span> demo
            </span>
            <IconButton
              label={`Switch to ${ui.theme === 'light' ? 'Night Sky' : 'Daylight'}`}
              onClick={() => ui.set({ theme: ui.theme === 'light' ? 'dark' : 'light' })}
            >
              {ui.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </IconButton>
            <IconButton
              label="Lock workspace"
              onClick={() => {
                useChat.getState().stop()
                useAuth.getState().lock()
              }}
            >
              <LockKeyhole size={16} />
            </IconButton>
          </div>
        </footer>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              aria-label="Search everything (Ctrl+K)"
              onClick={() => ui.set({ palette: true })}
            >
              <Search size={16} />
              <span>Search anything</span>
              <Kbd>
                <Command size={10} /> K
              </Kbd>
            </button>
            <span className="topbar-separator" />
            <Badge
              tone="gold"
              title="Canned responses over fake data. No model provider is called."
            >
              <span className="status-dot" />
              Demo replay
            </Badge>
            <IconButton
              label="Toggle Dev Lens (Shift+D)"
              onClick={() => ui.set({ devLens: !ui.devLens })}
            >
              <Code2 size={18} color={ui.devLens ? 'var(--brand-ink)' : undefined} />
            </IconButton>
            <button
              className="profile-avatar"
              onClick={() => navigate('/settings')}
              aria-label="Open your settings"
            >
              K
            </button>
          </div>
        </header>
        {ui.devLens && (
          <div className="dev-toolbar">
            <span>
              <Code2 size={15} />
              Dev Lens
            </span>
            <Select
              aria-label="View state"
              value={demo.screenState}
              onChange={e => demo.set({ screenState: e.target.value as typeof demo.screenState })}
            >
              <option value="normal">Normal view</option>
              <option value="loading">Loading state</option>
              <option value="empty">Empty state</option>
              <option value="error">Error state</option>
            </Select>
            <Switch
              label="Hallucinated citation"
              checked={demo.injectCitation}
              onChange={injectCitation => demo.set({ injectCitation })}
            />
            <Select
              aria-label="Trigger error"
              value=""
              onChange={e => {
                const error = e.target.value as ErrorCode
                demo.set({ error })
                ui.set({ typingPrompt: `Trigger error ${error}`, flow: 'S14' })
                navigate('/chat')
              }}
            >
              <option value="" disabled>
                Trigger error…
              </option>
              {['provider_rate_limited', 'agent_loop_limit', 'tool_timeout', 'rate_limited'].map(
                x => (
                  <option key={x}>{x}</option>
                )
              )}
            </Select>
            <Badge>All endpoints use demo data</Badge>
          </div>
        )}
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Outlet context={{ sessions }} />
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          { to: '/chat', label: 'Chat', icon: MessageSquare },
          { to: '/notes', label: 'Notes', icon: NotebookPen },
          { to: '/tasks', label: 'Tasks', icon: ListTodo },
          { to: '/brief', label: 'Brief', icon: Sun },
        ].map(item => (
          <NavLink key={item.to} to={item.to}>
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => ui.set({ mobileMenu: !ui.mobileMenu })}
          aria-expanded={ui.mobileMenu}
        >
          <MoreHorizontal size={21} />
          <span>More</span>
        </button>
      </nav>
      <CommandPalette />
      <FlowExplorer />
      <Dialog
        title="Keyboard shortcuts"
        open={ui.shortcuts}
        onClose={() => ui.set({ shortcuts: false })}
      >
        <div className="shortcut-list">
          {[
            ['Search everything', 'Ctrl / ⌘', 'K'],
            ['Toggle Dev Lens', 'Shift', 'D'],
            ['Open Chat', 'g', 'c'],
            ['Open Notes', 'g', 'n'],
            ['Open Tasks', 'g', 't'],
            ['Send message', 'Enter', ''],
            ['New line', 'Shift', 'Enter'],
            ['Close dialog', 'Esc', ''],
          ].map(([label, a, b]) => (
            <div key={label}>
              <span>{label}</span>
              <span>
                <Kbd>{a}</Kbd>
                {b && <Kbd>{b}</Kbd>}
              </span>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  )
}
