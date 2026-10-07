import type { ErrorCode } from '../api/contract'
export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
    public retry_after?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export const CAPS = {
  json: 1024 * 1024,
  chat: 32 * 1024,
  note: 256 * 1024,
  toolResult: 8 * 1024,
  k: 20,
  requests: 60,
  streams: 3,
  streamMs: 120000,
  toolMs: 10000,
  tts: 1000,
}
export const WRITE_TOOLS = new Set(['save_note', 'add_task', 'update_task', 'register_project'])
export function validateTags(tags: string[]) {
  if (tags.length > 10 || tags.some(t => !/^[-a-z0-9_]{1,32}$/.test(t)))
    throw new ApiError(
      'forbidden',
      'Use up to 10 lowercase tags, each 1–32 letters, numbers, hyphens, or underscores.',
      403
    )
}
