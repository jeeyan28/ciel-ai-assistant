import { useNavigate } from 'react-router-dom'
import { Sun, ArrowUpRight, FileText, Check, LockKeyhole, CalendarDays } from 'lucide-react'
import { api } from '../../api'
import { useQuery } from '../../lib/useQuery'
import { useUi } from '../../state/ui.store'
import {
  PageHeading,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
  Lens,
  Button,
} from '../../design/primitives'
import { AudioPlayer } from '../voice/AudioPlayer'
export default function Brief() {
  const query = useQuery(() => api.getDailyBrief()),
    navigate = useNavigate()
  const brief = query.data
  return (
    <div className="data-page brief-page page-enter">
      <PageHeading
        title="A calmer start"
        description="Sunday, 4 October 2026 · Your daily brief"
        addon="Daily brief"
      />
      <Lens endpoint="GET /brief/daily · GET /tts" refs="FR-7/8 · D7" milestone="Brief" />
      {query.loading ? (
        <Skeleton rows={7} />
      ) : query.error ? (
        <ErrorState message={query.error} retry={() => void query.refresh()} />
      ) : !brief ? (
        <EmptyState
          title="A quiet morning."
          description="Your next brief will bring yesterday’s notes and today’s work together."
          action="Refresh brief"
          onAction={() => void query.refresh()}
        />
      ) : (
        <>
          <section className="brief-hero">
            <div className="brief-sun">
              <Sun size={44} strokeWidth={1} />
              <span />
            </div>
            <div>
              <h2>Good morning, Kai.</h2>
              <p>
                A few things to carry into the day.
                <br />
                Everything else can wait.
              </p>
            </div>
            <Badge tone="blue">9:30 AM · Manila</Badge>
          </section>
          <div className="brief-columns">
            <section className="brief-section">
              <header>
                <FileText size={19} />
                <h2>Captured yesterday</h2>
                <span>{brief.captured_yesterday.length}</span>
              </header>
              {brief.captured_yesterday.map(n => (
                <button
                  className="brief-note"
                  key={n.id}
                  onClick={() => useUi.getState().set({ noteId: n.id })}
                >
                  <div>
                    <h3>{n.title}</h3>
                    <p>{n.summary}</p>
                    <div className="row">
                      {n.tags.map(t => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
              {!brief.captured_yesterday.length && (
                <p className="muted">No public notes captured yesterday.</p>
              )}
            </section>
            <section className="brief-section">
              <header>
                <CalendarDays size={19} />
                <h2>Due today</h2>
                <span>{brief.due_today.length}</span>
              </header>
              {brief.due_today.map(t => (
                <button
                  className="brief-task"
                  key={t.id}
                  onClick={() => navigate(`/tasks?q=${encodeURIComponent(t.title)}`)}
                >
                  <span className="task-check">
                    <Check size={12} />
                  </span>
                  <div>
                    <strong>{t.title}</strong>
                    <small>{t.project}</small>
                  </div>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!brief.due_today.length && (
                <p className="muted">Nothing scheduled today. Enjoy the breathing room.</p>
              )}
              <Button variant="ghost" onClick={() => navigate('/tasks')}>
                See the week ahead
                <ArrowUpRight size={15} />
              </Button>
            </section>
          </div>
          <section className="reflection">
            <span className="reflection-line" />
            <div>
              <h2>A thought for today</h2>
              <p>{brief.reflection}</p>
            </div>
          </section>
          <AudioPlayer text={`Good morning Kai. ${brief.reflection}`} />
          <p className="privacy-footnote">
            <LockKeyhole size={13} />2 private items excluded: a note and a project (D7). Device
            briefs contain no private material.
          </p>
        </>
      )}
    </div>
  )
}
