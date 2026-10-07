import { demoControl } from './control'
export async function delay(ms: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Stopped', 'AbortError')
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Stopped', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms * demoControl.speed)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
