import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

/** Typed fetch client generated from the backend contract (`npm run gen:api`). */
export const client = createClient<paths>({ baseUrl: '', credentials: 'include' })
export type Schemas = components['schemas']

/** `detail` of the 409 returned by POST /items when the URL is already in the library. */
export interface ConflictDetail {
  message: string
  item_id: string | null
}

export class ApiError extends Error {
  status: number
  detail: unknown
  /** Stable backend error code (`detail.code`), or 'network_error' when the server was unreachable. */
  code: string | null
  /** `Retry-After` (seconds) on a 429. */
  retryAfter: number | null
  constructor(status: number, message: string, detail?: unknown, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.code = codeFromDetail(detail) ?? (status === 0 ? 'network_error' : null)
    this.retryAfter = retryAfter
  }

  /** Typed conflict payload (duplicate item), or null for any other error. */
  get conflict(): ConflictDetail | null {
    return isConflictDetail(this.detail) ? this.detail : null
  }
}

function isRecord(d: unknown): d is Record<string, unknown> {
  return typeof d === 'object' && d !== null && !Array.isArray(d)
}

function codeFromDetail(d: unknown): string | null {
  return isRecord(d) && typeof d.code === 'string' ? d.code : null
}

function isConflictDetail(d: unknown): d is ConflictDetail {
  return isRecord(d) && 'message' in d && 'item_id' in d
}

/** Turn FastAPI's `detail` (string | {code,message} | [{msg}]) into a message for logs. The UI translates `code`. */
function messageFromDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (isRecord(detail) && 'message' in detail) return String(detail.message)
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (isRecord(d) && 'msg' in d ? String(d.msg) : null))
      .filter((m): m is string => !!m)
    if (msgs.length) return msgs.join(', ')
  }
  return `HTTP ${status}`
}

let onUnauthorized: (() => void) | null = null

/** Register the 401 hook (clear caches, go to /login). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

interface Result<T> {
  data?: T
  error?: unknown
  response: Response
}

/**
 * Unwrap an openapi-fetch result: the data, or an ApiError carrying the status, the backend `code`
 * and `Retry-After`. `skipUnauthorized` is for calls where a 401 is an answer (login, /me probe).
 */
export async function ok<T = void>(
  request: Promise<Result<T>>,
  { skipUnauthorized = false }: { skipUnauthorized?: boolean } = {},
): Promise<T> {
  let result: Result<T>
  try {
    result = await request
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, 'Network error')
  }
  const { response, data, error } = result
  if (response.status === 401 && !skipUnauthorized) onUnauthorized?.()
  if (!response.ok || (error !== undefined && error !== '')) {
    const detail = isRecord(error) ? error.detail : undefined
    const ra = Number(response.headers.get('Retry-After'))
    throw new ApiError(
      response.status,
      messageFromDetail(detail, response.status),
      detail,
      Number.isFinite(ra) && ra > 0 ? ra : null,
    )
  }
  return data as T
}
