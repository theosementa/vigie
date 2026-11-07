import { ApiError } from './api'

const NBSP = ' '

/** French copy for every stable backend error code (backend/API.md), plus client-side ones. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E‑mail ou mot de passe incorrect',
  not_invited:
    'Cette adresse n’est pas invitée sur cette instance. Demande une invitation à son administrateur.',
  registration_closed: 'Les inscriptions sont fermées sur cette instance.',
  email_taken: 'Un compte existe déjà avec cette adresse e‑mail.',
  email_domain_not_allowed: 'Ce domaine d’e‑mail n’est pas accepté sur une instance ouverte.',
  wrong_password: 'Mot de passe actuel incorrect.',
  last_admin: `Tu es le dernier administrateur${NBSP}: promeus ou supprime d’abord les autres comptes, ou transmets l’instance.`,
  cannot_delete_self: 'Tu ne peux pas supprimer ton propre compte depuis l’administration. Utilise les réglages.',
  invalid_reset_token:
    'Ce lien a expiré ou a déjà servi. Demande-en un nouveau à l’administrateur.',
  already_in_library: 'Déjà dans ta bibliothèque.',
  not_authenticated: 'Ta session a expiré. Reconnecte-toi.',
  not_found: 'Introuvable.',
  user_not_found: 'Ce compte n’existe plus.',
  invitation_not_found: 'Cette invitation n’existe plus.',
  network_error: 'Impossible de joindre le serveur',
}

export function messageForCode(code: string): string {
  return MESSAGES[code] ?? MESSAGES.network_error
}

export const RATE_LIMITED = (seconds: number | null) =>
  seconds
    ? `Trop de tentatives. Réessaie dans ${seconds}${NBSP}s.`
    : 'Trop de tentatives. Réessaie dans un instant.'

/**
 * French message for any error. `fallback` is used for errors without a known code
 * (validation errors, legacy plain-string details, 5xx).
 */
export function errorMessage(err: unknown, fallback = 'Une erreur est survenue. Réessaie.'): string {
  if (!(err instanceof ApiError)) return MESSAGES.network_error
  if (err.code === 'rate_limited' || err.status === 429) return RATE_LIMITED(err.retryAfter)
  if (err.code && MESSAGES[err.code]) return MESSAGES[err.code]
  return fallback
}
