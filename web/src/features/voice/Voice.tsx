import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Square, ArrowUpRight, BookmarkPlus, ShieldCheck, MicOff } from 'lucide-react'
import { api } from '../../api'
import { SAMPLE_TRANSCRIPT } from '../../api/demo/DemoApi'
import { useUi, toast } from '../../state/ui.store'
import {
  PageHeading,
  Button,
  Badge,
  Waveform,
  Textarea,
  Switch,
  Skeleton,
  Notice,
  EmptyState,
  Lens,
} from '../../design/primitives'
import { AudioPlayer } from './AudioPlayer'
import { useDemo } from '../../state/demo.store'
export default function Voice() {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'ready'>('idle'),
    [seconds, setSeconds] = useState(0),
    [transcript, setTranscript] = useState(''),
    [denied, setDenied] = useState(false)
  const navigate = useNavigate(),
    mode = useDemo(s => s.screenState)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (state !== 'recording') return
    const timer = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [state])
  async function toggle() {
    if (state === 'transcribing') return
    if (state === 'recording') {
      setState('transcribing')
      try {
        const result = await api.transcribe(new Blob(['demo audio'], { type: 'audio/webm' }), {
          save_as_note: false,
        })
        if (alive.current) {
          setTranscript(result.transcript)
          setState('ready')
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Transcription unavailable', 'error')
        if (alive.current) setState('idle')
      }
    } else {
      setSeconds(0)
      setState('recording')
    }
  }
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body && !e.repeat && !denied) {
        e.preventDefault()
        setSeconds(0)
        setState('recording')
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body && state === 'recording') {
        e.preventDefault()
        void toggle()
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  })
  return (
    <div className="data-page voice-page page-enter">
      <PageHeading
        title="Say what’s on your mind"
        description="A thought is worth keeping, however it arrives."
        addon="Voice"
      />
      <Lens endpoint="POST /voice · GET /tts" refs="FR-1/21" milestone="Voice" />
      {denied || mode === 'error' ? (
        <EmptyState
          title="Your microphone needs permission."
          description="This demo does not request microphone permission. Continue with a sample transcript."
          action="Use sample transcript"
          onAction={() => {
            setDenied(false)
            useDemo.getState().set({ screenState: 'normal' })
            setTranscript(SAMPLE_TRANSCRIPT)
            setState('ready')
          }}
        />
      ) : (
        <section className={`voice-capture ${state === 'recording' ? 'recording' : ''}`}>
          <div className="voice-orbits">
            <button
              className="voice-button"
              onClick={() => void toggle()}
              disabled={state === 'transcribing'}
              aria-label={state === 'recording' ? 'Stop recording' : 'Start simulated recording'}
            >
              {state === 'recording' ? <Square size={30} /> : <Mic size={37} strokeWidth={1.5} />}
            </button>
          </div>
          <h2>
            {state === 'recording'
              ? 'Listening to your thought.'
              : state === 'transcribing'
                ? 'Making sense of it…'
                : 'A little less typing.'}
          </h2>
          <p>
            {state === 'recording'
              ? `${seconds}s · Tap again when you’re finished.`
              : 'Tap to start, or hold Space outside an input to talk.'}
          </p>
          <Waveform playing={state === 'recording'} />
          <Badge tone="blue">Simulated microphone · no audio is captured</Badge>
        </section>
      )}
      {state === 'transcribing' || mode === 'loading' ? (
        <Skeleton rows={3} />
      ) : (
        state === 'ready' &&
        mode !== 'empty' && (
          <section className="transcript-panel">
            <header>
              <h2>Your words, ready to use.</h2>
              <Badge>Taglish sample</Badge>
            </header>
            <Textarea
              aria-label="Edit transcript"
              rows={5}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
            />
            <div className="row wrap">
              <Button
                onClick={() => {
                  useUi.getState().set({ typingPrompt: transcript })
                  navigate('/chat')
                }}
              >
                Ask Ciel
                <ArrowUpRight size={15} />
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  useUi.getState().set({ capture: `# Voice capture\n\n${transcript}` })
                }
              >
                <BookmarkPlus size={16} />
                Review & save as note
              </Button>
            </div>
          </section>
        )
      )}
      <div className="voice-notes">
        <ShieldCheck size={18} />
        <p>
          Review your transcript before it becomes a note or a message. This demo replays a sample
          and does not record audio.
        </p>
      </div>
      <Switch label="Simulate microphone permission denied" checked={denied} onChange={setDenied} />
      {denied && (
        <Notice>
          <MicOff size={14} /> No browser permission was requested by this simulation.
        </Notice>
      )}
      <AudioPlayer text={transcript || SAMPLE_TRANSCRIPT} label="Listen to sample" />
    </div>
  )
}
