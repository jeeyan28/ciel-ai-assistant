import { Component, Suspense, useEffect, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './state/auth.store'
import { useUi } from './state/ui.store'
import { Shell } from './features/shell/Shell'
import Unlock from './features/auth/Unlock'
import {
  Chat,
  Notes,
  Tasks,
  Projects,
  Audit,
  Brief,
  Voice,
  Email,
  Device,
  System,
  BuildMap,
  Settings,
} from './routes'
import { Skeleton, Toasts, Button } from './design/primitives'
const NoteOverlays = lazy(() =>
  import('./features/notes/NoteOverlays').then(m => ({ default: m.NoteOverlays }))
)
function Protected() {
  const unlocked = useAuth(s => s.unlocked)
  return unlocked ? <Shell /> : <Navigate to="/unlock" replace />
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>A small interruption.</h1>
        <p>Ciel could not render this view. Reload to start a fresh demo.</p>
        <Button onClick={() => window.location.reload()}>Reload workspace</Button>
      </main>
    ) : (
      this.props.children
    )
  }
}
export default function App() {
  const { theme, density, reducedMotion, noteId, capture } = useUi()
  const unlocked = useAuth(s => s.unlocked)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.density = density
    document.documentElement.dataset.reducedMotion = String(reducedMotion)
  }, [theme, density, reducedMotion])
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="route-loading">
            <Skeleton rows={6} />
          </div>
        }
      >
        <Routes>
          <Route path="/unlock" element={<Unlock />} />
          <Route element={<Protected />}>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="chat" element={<Chat />} />
            <Route path="chat/:sessionId" element={<Chat />} />
            <Route path="notes" element={<Notes />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="projects" element={<Projects />} />
            <Route path="audit" element={<Audit />} />
            <Route path="brief" element={<Brief />} />
            <Route path="voice" element={<Voice />} />
            <Route path="email" element={<Email />} />
            <Route path="device" element={<Device />} />
            <Route path="system" element={<System />} />
            <Route path="buildmap" element={<BuildMap />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Route>
        </Routes>
        {unlocked && (noteId !== null || capture !== null) && <NoteOverlays />}
      </Suspense>
      <Toasts />
    </ErrorBoundary>
  )
}
