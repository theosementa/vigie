/** The Vigie mark from the DA: two arcs and a dot, in currentColor. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true" className={className}>
      <path d="M4.5 18.5a12 12 0 0 1 17 0M8.5 14.5a6.4 6.4 0 0 1 9 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="19.5" r="2.4" fill="currentColor" />
    </svg>
  )
}
