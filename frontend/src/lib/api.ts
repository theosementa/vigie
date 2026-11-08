/**
 * Typed API layer. EVERY backend call lives in this file. It sits on the generated client
 * (src/api/client.ts, from the OpenAPI contract) and keeps the shapes the screens use; all types
 * come from the generated schema (`npm run gen:api`). Contract: backend/API.md.
 */
import { client, ok, type Schemas } from '@/api/client'
import type { paths } from '@/api/schema'

export { ApiError, setUnauthorizedHandler, type ConflictDetail } from '@/api/client'

export const API_BASE = '/api'

// ---------- Types (derived from the contract) ----------

export type User = Schemas['UserOut']
export type UserRole = User['role']
export type Locale = Schemas['Locale']
export type Theme = Schemas['Theme']
export type MobileLayout = Schemas['MobileLayout']
export type UserRef = Schemas['UserRef']
export type RegistrationMode = Schemas['SettingsOut']['registration_mode']

export type Resource = Schemas['ResourceOut']
export type ResourceType = Resource['type']
export type ResourcePreview = Schemas['PreviewOut']
export type Tag = Schemas['TagRef']
export type TagWithCount = Schemas['TagOut']
export type Item = Schemas['ItemOut']
export type ItemStatus = Item['status']
export type ItemEvent = Schemas['ItemEventOut']
export type ItemsPage = Schemas['ItemList']
export type QueueList = Schemas['QueueOut']
export type ShareResult = Schemas['ShareOut']
export type Contact = Schemas['ContactOut']
export type ContactHistoryEntry = Schemas['HistoryEntry']
export type ContactHistoryPage = Schemas['HistoryPage']
export type RefreshResult = Schemas['RefreshOut']

/** Query of GET /items; empty values are dropped before the request. */
export type ItemsQuery = NonNullable<paths['/api/items']['get']['parameters']['query']>

export type LengthBucket = NonNullable<ItemsQuery['length']>

/** `status` and `queue` have server defaults, so the screens may omit them. */
export type CreateItemInput = Omit<Schemas['ItemCreate'], 'status' | 'queue'> &
  Partial<Pick<Schemas['ItemCreate'], 'status' | 'queue'>>
export type UpdateItemInput = Schemas['ItemUpdate']
export type ShareInput = Schemas['ShareIn']

export type RegisterInput = Schemas['RegisterIn']
export type LoginInput = Schemas['LoginIn']
export type UpdateMeInput = Schemas['ProfileUpdate']
export type ChangePasswordInput = Schemas['PasswordChangeIn']
export type ResetPasswordInput = Schemas['ResetIn']
export type Device = Schemas['SessionOut']

// ---------- Administration ----------

export type AdminSettings = Schemas['SettingsOut']
export type Invitation = Schemas['InvitationOut']
export type AdminUser = Schemas['AdminUserOut']
export type ResetLink = Schemas['ResetLinkOut']
export type AdminAnalytics = Schemas['AnalyticsOut']
export type AnalyticsDays = 7 | 30 | 90

// ---------- Statistics ----------

export type StatsSummary = Schemas['SummaryOut']
export type StatsBlock = Schemas['StatsBlock']
export type StatsPeriod = StatsSummary['period']
export type Timeseries = Schemas['TimeseriesOut']
export type TimeseriesPoint = Schemas['TimeseriesPoint']
export type TimeseriesMetric = Timeseries['metric']
export type TimeseriesGranularity = Timeseries['granularity']
export type TimeseriesQuery = {
  metric: TimeseriesMetric
  granularity: TimeseriesGranularity
  /** "YYYY-MM-DD" */
  from: string
  /** "YYYY-MM-DD", inclusive */
  to: string
}

// ---------- Endpoints ----------

/** Drop undefined, null and '' so they never reach the query string. */
function clean<T extends object>(query: T): T {
  return Object.fromEntries(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as T
}

const skip = { skipUnauthorized: true }

export const api = {
  auth: {
    register: (input: RegisterInput) => ok(client.POST('/api/auth/register', { body: input }), skip),
    login: (input: LoginInput) => ok(client.POST('/api/auth/login', { body: input }), skip),
    logout: () => ok(client.POST('/api/auth/logout')),
    logoutAll: () => ok(client.POST('/api/auth/logout-all')),
    changePassword: (input: ChangePasswordInput) => ok(client.POST('/api/auth/password', { body: input })),
    resetPassword: (input: ResetPasswordInput) => ok(client.POST('/api/auth/reset', { body: input }), skip),
    deleteMe: (password: string) => ok(client.DELETE('/api/auth/me', { body: { password } })),
    me: () => ok(client.GET('/api/auth/me'), skip),
    updateMe: (input: UpdateMeInput) => ok(client.PATCH('/api/auth/me', { body: input })),
    sessions: () => ok(client.GET('/api/auth/sessions')),
    revokeSession: (id: string) =>
      ok(client.DELETE('/api/auth/sessions/{session_id}', { params: { path: { session_id: id } } })),
  },
  resources: {
    preview: (url: string, signal?: AbortSignal) =>
      ok(client.POST('/api/resources/preview', { body: { url }, signal })),
  },
  items: {
    list: (query: ItemsQuery = {}) => ok(client.GET('/api/items', { params: { query: clean(query) } })),
    create: (input: CreateItemInput) =>
      ok(client.POST('/api/items', { body: input as Schemas['ItemCreate'] })),
    get: (id: string) => ok(client.GET('/api/items/{item_id}', { params: { path: { item_id: id } } })),
    update: (id: string, input: UpdateItemInput) =>
      ok(client.PATCH('/api/items/{item_id}', { params: { path: { item_id: id } }, body: input })),
    remove: (id: string, { keepalive }: { keepalive?: boolean } = {}) =>
      ok(client.DELETE('/api/items/{item_id}', { params: { path: { item_id: id } }, keepalive })),
    refresh: (id: string) =>
      ok(client.POST('/api/items/{item_id}/refresh', { params: { path: { item_id: id } } })),
    share: (id: string, input: ShareInput) =>
      ok(client.POST('/api/items/{item_id}/share', { params: { path: { item_id: id } }, body: input })),
    events: (id: string) =>
      ok(client.GET('/api/items/{item_id}/events', { params: { path: { item_id: id } } })),
  },
  queue: {
    list: () => ok(client.GET('/api/queue')),
    add: (itemId: string, position?: number | null) =>
      ok(client.POST('/api/queue', { body: { item_id: itemId, position } })),
    move: (itemId: string, position: number) =>
      ok(client.PATCH('/api/queue/{item_id}', { params: { path: { item_id: itemId } }, body: { position } })),
    remove: (itemId: string) =>
      ok(client.DELETE('/api/queue/{item_id}', { params: { path: { item_id: itemId } } })),
  },
  admin: {
    getSettings: () => ok(client.GET('/api/admin/settings')),
    setRegistrationMode: (registration_mode: RegistrationMode) =>
      ok(client.PATCH('/api/admin/settings', { body: { registration_mode } })),
    invitations: () => ok(client.GET('/api/admin/invitations')),
    invite: (email: string) => ok(client.POST('/api/admin/invitations', { body: { email } })),
    removeInvitation: (id: string) =>
      ok(client.DELETE('/api/admin/invitations/{invitation_id}', { params: { path: { invitation_id: id } } })),
    analytics: (days: AnalyticsDays) =>
      ok(client.GET('/api/admin/analytics', { params: { query: { days } } })),
    users: () => ok(client.GET('/api/admin/users')),
    removeUser: (id: string) =>
      ok(client.DELETE('/api/admin/users/{user_id}', { params: { path: { user_id: id } } })),
    resetLink: (id: string) =>
      ok(client.POST('/api/admin/users/{user_id}/reset-link', { params: { path: { user_id: id } } })),
  },
  tags: {
    list: () => ok(client.GET('/api/tags')),
  },
  contacts: {
    list: () => ok(client.GET('/api/contacts')),
    create: (input: { email: string; name?: string | null }) =>
      ok(client.POST('/api/contacts', { body: input })),
    rename: (id: string, name: string | null) =>
      ok(client.PATCH('/api/contacts/{contact_id}', { params: { path: { contact_id: id } }, body: { name } })),
    remove: (id: string) =>
      ok(client.DELETE('/api/contacts/{contact_id}', { params: { path: { contact_id: id } } })),
    history: (id: string, before?: string, limit = 30) =>
      ok(
        client.GET('/api/contacts/{contact_id}/history', {
          params: { path: { contact_id: id }, query: { before, limit } },
        }),
      ),
  },
  stats: {
    summary: (query: { period: StatsPeriod; offset: number }) =>
      ok(client.GET('/api/stats/summary', { params: { query } })),
    timeseries: (query: TimeseriesQuery) =>
      ok(client.GET('/api/stats/timeseries', { params: { query } })),
  },
}
