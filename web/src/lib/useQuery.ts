import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribe } from '../api/demo/control'
import { useDemo } from '../state/demo.store'
export function useQuery<T>(load: () => Promise<T>, key = '') {
  const loader = useRef(load)
  loader.current = load
  const mounted = useRef(true)
  const request = useRef(0)
  const [data, setData] = useState<T | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null)
  const mode = useDemo(s => s.screenState)
  const refresh = useCallback(async () => {
    const id = ++request.current
    try {
      const result = await loader.current()
      if (mounted.current && id === request.current) {
        setData(result)
        setError(null)
      }
    } catch (e) {
      if (mounted.current && id === request.current)
        setError(e instanceof Error ? e.message : 'Unable to load this view.')
    } finally {
      if (mounted.current && id === request.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    mounted.current = true
    setLoading(true)
    void refresh()
    const off = subscribe(() => {
      void refresh()
    })
    return () => {
      mounted.current = false
      off()
    }
  }, [key, refresh])
  return {
    data: mode === 'empty' ? null : data,
    setData,
    loading: loading || mode === 'loading',
    error:
      mode === 'error' ? 'Sample loading failure. Return view state to Normal, then retry.' : error,
    refresh,
  }
}
