/** The Vigie mark: the lighthouse app icon, served from /public. */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{ flex: 'none', objectFit: 'contain' }}
    />
  )
}
