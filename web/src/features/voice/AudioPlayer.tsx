import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import { api } from '../../api'
import { Button, Waveform, Badge } from '../../design/primitives'
import { toast } from '../../state/ui.store'
export function AudioPlayer({
  text,
  device = false,
  autoPlay = false,
  label = 'Play brief',
}: {
  text: string
  device?: boolean
  autoPlay?: boolean
  label?: string
}) {
  const [playing, setPlaying] = useState(false),
    [loading, setLoading] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(30)
  const audio = useRef<HTMLAudioElement | null>(null),
    url = useRef<string | null>(null)
  const started = useRef(false)
  async function play() {
    if (audio.current) {
      if (playing) {
        audio.current.pause()
        setPlaying(false)
      } else {
        await audio.current.play()
        setPlaying(true)
      }
      return
    }
    setLoading(true)
    try {
      const blob = device ? await api.briefVoice() : await api.tts(text.slice(0, 1000))
      url.current = URL.createObjectURL(blob)
      const a = new Audio(url.current)
      audio.current = a
      a.addEventListener('loadedmetadata', () => setDuration(Math.min(30, a.duration)))
      a.addEventListener('timeupdate', () => setProgress(a.currentTime))
      a.addEventListener('ended', () => {
        setPlaying(false)
        setProgress(0)
      })
      await a.play()
      setPlaying(true)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Audio playback is unavailable.', 'error')
    } finally {
      setLoading(false)
    }
  }
  const playRef = useRef(play)
  playRef.current = play
  useEffect(() => {
    if (autoPlay && !started.current) {
      started.current = true
      void playRef.current()
    }
  }, [autoPlay])
  useEffect(
    () => () => {
      audio.current?.pause()
      if (url.current) URL.revokeObjectURL(url.current)
      audio.current = null
    },
    []
  )
  return (
    <div className="audio-player">
      <div className="audio-player-head">
        <span className="audio-icon">
          <Volume2 size={21} />
        </span>
        <div>
          <strong>A moment to listen.</strong>
          <small>Demo playback · local calibration tone</small>
        </div>
        <Badge>16 kHz mono WAV</Badge>
      </div>
      <Waveform playing={playing} />
      <div className="audio-progress">
        <span>{Math.floor(progress)}s</span>
        <progress max={duration} value={progress} />
        <span>{Math.round(duration)}s</span>
      </div>
      <div className="row between">
        <Button variant="secondary" onClick={() => void play()} disabled={loading}>
          {playing ? <Pause size={16} /> : <Play size={16} />}{' '}
          {loading ? 'Preparing…' : playing ? 'Pause' : label}
        </Button>
        <small className="muted">Brief capped at ~30 s · ≈ 960 KB</small>
      </div>
      <p className="audio-caption">
        Full text stays here. Playback uses a locally generated calibration tone.
      </p>
    </div>
  )
}
