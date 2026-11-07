/**
 * Typed API client. EVERY backend call lives in this file so that integration
 * work only has to touch it. Contract: backend/API.md.
 */

// ---------- Types ----------

export interface User {
  id: string
  email: string
  display_name: string
  /** IANA time zone used to bucket statistics (e.g. "Europe/Paris"). */
  timezone: string
  created_at: string
}

/** Minimal user reference exposed on a shared item. */
export interface UserRef {
  id: string
  display_name: string
  email: string
}

export type ResourceType = 'article' | 'video'
export type ItemStatus = 'to_watch' | 'seen'

export interface Resource {
  id: string
  url: string
  type: ResourceType
  title: string
  description: string | null
  image_url: string | null
  site_name: string | null
  favicon_url: string | null
  author: string | null
  duration_seconds: number | null
  reading_time_minutes: number | null
  published_at: string | null
  fetched_at: string
}

/** Result of POST /resources/preview: a Resource without an id. */
export type ResourcePreview = Omit<Resource, 'id' | 'fetched_at'> & {
  existing_item_id: string | null
}

export interface Tag {
  id: string
  name: string
}

export interface TagWithCount extends Tag {
  item_count: number
}

export interface Item {
  id: string
  status: ItemStatus
  notes: string | null
  created_at: string
  updated_at: string
  seen_at: string | null
  resource: Resource
  tags: Tag[]
  shared_by: UserRef | null
  share_message: string | null
  /** 0-based position in the watch queue, or null when not queued. */
  queue_position: number | null
}

export interface ItemsQuery {
  status?: ItemStatus
  type?: ResourceType
  tag?: string
  q?: string
  shared?: boolean
  queued?: boolean
  cursor?: string
  limit?: number
}

export interface ItemsPage {
  items: Item[]
  next_cursor: string | null
}

export interface CreateItemInput {
  url: string
  type?: ResourceType
  status?: ItemStatus
  notes?: string | null
  tags?: string[]
  /** Add the new item straight to the watch queue (videos only). */
  queue?: boolean
}

export interface UpdateItemInput {
  status?: ItemStatus
  notes?: string | null
  tags?: string[]
  type?: ResourceType
}

export interface ShareInput {
  emails: string[]
  message?: string | null
}

export interface ShareResult {
  shared: string[]
  not_found: string[]
  already_had: string[]
}

export interface QueueList {
  items: Item[]
}

export interface RegisterInput {
  email: string
  password: string
  display_name?: string | null
  timezone?: string
}

export interface UpdateMeInput {
  display_name?: string
  timezone?: string
}

export interface LoginInput {
  email: string
  password: string
}

// ---------- Statistics ----------

export type StatsPeriod = 'week' | 'month' | 'year'
export type TimeseriesMetric = 'seen' | 'added' | 'watch_time' | 'backlog'
export type TimeseriesGranularity = 'day' | 'week' | 'month'

export interface StatsBlock {
  articles_read: number
  videos_seen: number
  items_added: number
  watch_seconds: number
  reading_minutes: number
}

export interface StatsSummary {
  period: StatsPeriod
  offset: number
  timezone: string
  /** First day of the period, "YYYY-MM-DD". */
  start: string
  /** Day after the last day of the period (exclusive), "YYYY-MM-DD". */
  end: string
  current: StatsBlock
  previous: StatsBlock
  top_tags: { name: string; count: number }[]
  top_sources: { site_name: string; count: number }[]
  shares: {
    sent: number
    received: number
    by_user: { user_id: string; display_name: string; count: number }[]
  }
  streak: { current: number; best: number }
  videos_without_duration: number
}

export interface TimeseriesQuery {
  metric: TimeseriesMetric
  granularity: TimeseriesGranularity
  /** "YYYY-MM-DD" */
  from: string
  /** "YYYY-MM-DD", inclusive */
  to: string
}

export interface TimeseriesPoint {
  /** First day of the bucket, "YYYY-MM-DD". */
  bucket: string
  value: number
  /** Only for metric=seen. */
  articles?: number
  videos?: number
}

export interface Timeseries {
  metric: TimeseriesMetric
  granularity: TimeseriesGranularity
  timezone: string
  points: TimeseriesPoint[]
}

// ---------- Core fetch ----------

export const API_BASE = '/api'

/** `detail` of the 409 returned by POST /items when the URL is already in the library. */
export interface ConflictDetail {
  message: string
  item_id: string | null
}

export class ApiError extends Error {
  status: number
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }

  /** Typed conflict payload (duplicate item), or null for any other error. */
  get conflict(): ConflictDetail | null {
    return isConflictDetail(this.detail) ? this.detail : null
  }
}

function isConflictDetail(d: unknown): d is ConflictDetail {
  return typeof d === 'object' && d !== null && !Array.isArray(d) && 'message' in d && 'item_id' in d
}

/** Turn FastAPI's `detail` (string | {message,item_id} | [{msg}]) into a human message. */
function messageFromDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (isConflictDetail(detail)) return String(detail.message)
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m)
    if (msgs.length) return msgs.join(', ')
  }
  return `Erreur ${status}`
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Register the 401 hook (e.g. clear caches + navigate to /login). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

type Params = Record<string, string | number | boolean | undefined | null>

function toQuery(params?: Params): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Params
  /** Skip the 401 redirect hook (login, /auth/me probe). */
  skipUnauthorized?: boolean
  signal?: AbortSignal
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, skipUnauthorized, signal } = opts
  const res = await fetch(`${API_BASE}${path}${toQuery(params)}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (res.status === 401 && !skipUnauthorized) onUnauthorized?.()
  if (res.status === 204) return undefined as T

  const text = await res.text()
  const data: unknown = text ? safeJson(text) : undefined
  if (!res.ok) {
    const detail = (data as { detail?: unknown } | undefined)?.detail
    throw new ApiError(res.status, messageFromDetail(detail, res.status), detail)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ---------- Endpoints ----------

export const api = {
  auth: {
    register: (input: RegisterInput) =>
      request<User>('/auth/register', { method: 'POST', body: input, skipUnauthorized: true }),
    login: (input: LoginInput) =>
      request<User>('/auth/login', { method: 'POST', body: input, skipUnauthorized: true }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<User>('/auth/me', { skipUnauthorized: true }),
    updateMe: (input: UpdateMeInput) => request<User>('/auth/me', { method: 'PATCH', body: input }),
  },
  resources: {
    preview: (url: string, signal?: AbortSignal) =>
      request<ResourcePreview>('/resources/preview', { method: 'POST', body: { url }, signal }),
  },
  items: {
    list: (query: ItemsQuery = {}) =>
      request<ItemsPage>('/items', { params: { ...query } }),
    create: (input: CreateItemInput) => request<Item>('/items', { method: 'POST', body: input }),
    get: (id: string) => request<Item>(`/items/${id}`),
    update: (id: string, input: UpdateItemInput) =>
      request<Item>(`/items/${id}`, { method: 'PATCH', body: input }),
    remove: (id: string) => request<void>(`/items/${id}`, { method: 'DELETE' }),
    refresh: (id: string) => request<Item>(`/items/${id}/refresh`, { method: 'POST' }),
    share: (id: string, input: ShareInput) =>
      request<ShareResult>(`/items/${id}/share`, { method: 'POST', body: input }),
  },
  queue: {
    list: () => request<QueueList>('/queue'),
    add: (itemId: string, position?: number | null) =>
      request<Item>('/queue', { method: 'POST', body: { item_id: itemId, position } }),
    move: (itemId: string, position: number) =>
      request<Item>(`/queue/${itemId}`, { method: 'PATCH', body: { position } }),
    remove: (itemId: string) => request<void>(`/queue/${itemId}`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request<TagWithCount[]>('/tags'),
  },
  stats: {
    summary: (query: { period: StatsPeriod; offset: number }) =>
      request<StatsSummary>('/stats/summary', { params: { ...query } }),
    timeseries: (query: TimeseriesQuery) =>
      request<Timeseries>('/stats/timeseries', { params: { ...query } }),
  },
}
