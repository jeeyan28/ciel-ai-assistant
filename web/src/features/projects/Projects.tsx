import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  FolderGit2,
  LockKeyhole,
  ArrowUpRight,
  GitBranch,
  ShieldCheck,
  GitCommit,
  Trash2,
} from 'lucide-react'
import { api } from '../../api'
import type { Project } from '../../api/contract'
import { useQuery } from '../../lib/useQuery'
import { useUi, toast } from '../../state/ui.store'
import {
  PageHeading,
  Button,
  Badge,
  Dialog,
  Input,
  Select,
  Field,
  Switch,
  Notice,
  Skeleton,
  EmptyState,
  ErrorState,
  Lens,
} from '../../design/primitives'
export default function Projects() {
  const query = useQuery(() => api.listProjects())
  const navigate = useNavigate()
  const [open, setOpen] = useState(false),
    [name, setName] = useState('sandbox'),
    [path, setPath] = useState('/data/projects/sandbox'),
    [language, setLanguage] = useState('Python'),
    [isPrivate, setPrivate] = useState(false),
    [error, setError] = useState<string | null>(null),
    [deleting, setDeleting] = useState<Project | null>(null)
  function chat(prompt: string) {
    useUi.getState().set({ typingPrompt: prompt })
    navigate('/chat')
  }
  async function save() {
    try {
      await api.registerProject({ name, path, language, private: isPrivate })
      setOpen(false)
      toast('Project registered', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.')
    }
  }
  return (
    <div className="data-page page-enter">
      <PageHeading
        title="Things you’re building"
        description="A closer look at your code, with the boundaries in place."
        addon="Projects"
      >
        <Button
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          <Plus size={17} />
          Register project
        </Button>
      </PageHeading>
      <Lens endpoint="GET /projects · POST /projects" refs="FR-6 · GR-5" milestone="Projects" />
      <div className="project-intro">
        <FolderGit2 size={23} />
        <span>
          Read-only by design. Ciel reviews, explains, and suggests. You stay in control of every
          change.
        </span>
      </div>
      {query.loading ? (
        <Skeleton />
      ) : query.error ? (
        <ErrorState message={query.error} retry={() => void query.refresh()} />
      ) : !query.data?.length ? (
        <EmptyState
          title="Something new starts here."
          description="Register a project to explore its history, scan dependencies, and review code."
          action="Register project"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="project-grid">
          {query.data.map(p => (
            <article className="project-card" key={p.id}>
              <header>
                <span className="project-folder">
                  <FolderGit2 size={27} />
                </span>
                <div className="row">
                  {p.private && (
                    <Badge tone="violet">
                      <LockKeyhole size={12} />
                      Private
                    </Badge>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Unregister ${p.name}`}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </header>
              <h2>{p.name}</h2>
              <p className="mono project-path">{p.path}</p>
              <div className="row">
                <span className={`language-dot ${p.language.toLowerCase()}`} />
                <span>{p.language}</span>
                <span className="faint">·</span>
                <span className="muted">
                  {p.id === 'p01' ? 3 : p.id === 'p03' ? 5 : 1} open tasks · sample
                </span>
              </div>
              <div className="project-scan">
                <ShieldCheck size={16} />
                {p.last_scan}
              </div>
              {p.private && (
                <p className="private-project-note">
                  <LockKeyhole size={13} />
                  Every session with this project stays local.
                </p>
              )}
              <div className="project-actions">
                <button onClick={() => chat(`Review the last commit on ${p.name}`)}>
                  <GitBranch size={15} />
                  Review
                  <ArrowUpRight size={12} />
                </button>
                <button onClick={() => chat(`Scan ${p.name} dependencies`)}>
                  <ShieldCheck size={15} />
                  Scan
                  <ArrowUpRight size={12} />
                </button>
                <button onClick={() => chat(`Write a commit message for ${p.name}`)}>
                  <GitCommit size={15} />
                  Commit text
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Notice>
        Registration accepts four fictional paths under <code>/data/projects/</code>. This demo does
        not access directories on disk.
      </Notice>
      <Dialog title="Register a project" open={open} onClose={() => setOpen(false)}>
        <form
          className="stack"
          onSubmit={e => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label="Project name">
            <Input required value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field
            label="Directory"
            help="Demo directories: ciel-backend, ciel-web, homelab-infra, sandbox"
          >
            <Input required value={path} onChange={e => setPath(e.target.value)} />
          </Field>
          <Field label="Language">
            <Select value={language} onChange={e => setLanguage(e.target.value)}>
              {['Python', 'TypeScript', 'YAML', 'Rust', 'Go'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </Select>
          </Field>
          <Switch
            label="Private project"
            description="Force the local provider for this project and its conversations."
            checked={isPrivate}
            onChange={setPrivate}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit">Register project</Button>
        </form>
      </Dialog>
      <Dialog title="Unregister project?" open={!!deleting} onClose={() => setDeleting(null)}>
        <div className="stack">
          <p>
            Remove <strong>{deleting?.name}</strong> from Ciel’s registered projects? Files on disk
            are unaffected.
          </p>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting)
                void api
                  .deleteProject(deleting.id)
                  .then(() => {
                    setDeleting(null)
                    toast('Project unregistered', 'success')
                  })
                  .catch(e => toast(String(e), 'error'))
            }}
          >
            Unregister project
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
