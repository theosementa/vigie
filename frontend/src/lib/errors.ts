import { ApiError } from './api'
import { t, type MessageKey } from './i18n'

/** Message for a stable backend error code (backend/API.md) or a client-side one, in the current language. */
export function messageForCode(code: string): string {
  const key = `error.${code}`
  return t(key in KNOWN ? (key as MessageKey) : 'error.network_error')
}

// Codes with a dictionary entry; the keys are checked against the dictionary at compile time.
const KNOWN: Partial<Record<MessageKey, true>> = {
  'error.invalid_credentials': true,
  'error.not_invited': true,
  'error.registration_closed': true,
  'error.email_not_allowed': true,
  'error.email_taken': true,
  'error.email_domain_not_allowed': true,
  'error.wrong_password': true,
  'error.last_admin': true,
  'error.cannot_delete_self': true,
  'error.invalid_reset_token': true,
  'error.already_in_library': true,
  'error.not_authenticated': true,
  'error.not_found': true,
  'error.user_not_found': true,
  'error.invitation_not_found': true,
  'error.view_name_taken': true,
  'error.view_empty': true,
  'error.views_limit': true,
  'error.network_error': true,
}

export const RATE_LIMITED = (seconds: number | null) =>
  seconds ? t('error.rate_limited.wait', { count: seconds }) : t('error.rate_limited')

/**
 * Message for any error, in the current language. `fallback` is used for errors without a known
 * code (validation errors, legacy plain-string details, 5xx).
 */
export function errorMessage(err: unknown, fallback = t('error.generic')): string {
  if (!(err instanceof ApiError)) return t('error.network_error')
  if (err.code === 'rate_limited' || err.status === 429) return RATE_LIMITED(err.retryAfter)
  if (err.code && `error.${err.code}` in KNOWN) return messageForCode(err.code)
  return fallback
}
