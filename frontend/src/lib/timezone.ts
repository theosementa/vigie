/** IANA zone of the browser (falls back to UTC when unavailable). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Sorted IANA zones for a picker; always contains `current`, the browser zone and UTC. */
export function timeZoneOptions(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    // older engines: only the known zones below
  }
  return [...new Set([...zones, current, browserTimeZone(), 'UTC'])].sort((a, b) => a.localeCompare(b))
}
