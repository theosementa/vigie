/** At most one menu (the "⋯" dropdown or a right-click / long-press context menu) is open at a time. */
const open = new Set<string>()

/** Whether a menu other than `id` is open: the one asking to open must then stay closed. */
export const otherMenuOpen = (id: string) => [...open].some((x) => x !== id)

export function setMenuOpen(id: string, isOpen: boolean) {
  if (isOpen) open.add(id)
  else open.delete(id)
}
