export const ONBOARDING_STORAGE_KEY = 'vigie-onboarded'

/** Has this browser already been through the welcome tour (or signed in)? Storage can be blocked: then it shows every time. */
export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
  } catch {
    // Storage unavailable (private window): the tour simply shows again next time.
  }
}
