import { useNavigate } from 'react-router-dom'
import { Route, ArrowUpRight, Check, ChevronDown, Play, ArrowRight, BookOpen } from 'lucide-react'
import { useUi } from '../../state/ui.store'
import { flows } from '../buildmap/catalog'
import { IconButton, Button } from '../../design/primitives'
import { useChat } from '../../state/chat.store'
export function FlowExplorer() {
  const ui = useUi(),
    navigate = useNavigate()
  function run(id: string, prompt: string) {
    useChat.getState().stop()
    useChat.getState().set({ current: null })
    ui.set({ flow: id, typingPrompt: prompt, tour: false })
    navigate('/chat')
  }
  return (
    <div className="flow-explorer">
      {ui.tour && (
        <section className="flow-panel" aria-label="Flow Explorer">
          <header>
            <div>
              <Route size={19} />
              <strong>Flow Explorer</strong>
            </div>
            <IconButton label="Collapse Flow Explorer" onClick={() => ui.set({ tour: false })}>
              <ChevronDown size={18} />
            </IconButton>
          </header>
          <p>See how Ciel thinks, acts, and stays within bounds.</p>
          <div className="flow-progress">
            <span>{ui.explored.length} of 14 explored</span>
            <progress max={14} value={ui.explored.length} />
          </div>
          <div className="flow-list">
            {flows.map(f => (
              <div key={f.id} className="flow-item">
                <span className={`flow-check ${ui.explored.includes(f.id) ? 'done' : ''}`}>
                  {ui.explored.includes(f.id) ? <Check size={14} /> : <Play size={11} />}
                </span>
                <div>
                  <strong>{f.title}</strong>
                  <small>{f.detail}</small>
                </div>
                <button
                  onClick={() => run(f.id, f.prompt)}
                  aria-label={`Run ${f.title}`}
                  title="Run it"
                >
                  <ArrowUpRight size={17} />
                </button>
              </div>
            ))}
          </div>
          <footer>
            <Button
              variant="ghost"
              onClick={() => {
                ui.set({ tour: false })
                navigate('/buildmap')
              }}
            >
              <BookOpen size={15} />
              Explore the Build Map
              <ArrowRight size={14} />
            </Button>
          </footer>
        </section>
      )}
      <button
        className="flow-toggle"
        aria-label="Toggle Flow Explorer"
        onClick={() => ui.set({ tour: !ui.tour })}
        aria-expanded={ui.tour}
      >
        <Route size={17} />
        <span>Flow Explorer</span>
        <span className="flow-count">{ui.explored.length}/14</span>
      </button>
    </div>
  )
}
