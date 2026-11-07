import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'
import { ICONS, type IconName } from './icons'

type BaseName<N> = N extends `${infer B}-linear` ? B : N extends `${infer B}-bold` ? B : never
/** Solar icon name without its style suffix, e.g. `layers-minimalistic`. */
export type IconBase = BaseName<IconName>

/**
 * Solar icon, inlined from the generated icons.ts (no request at runtime). `linear` by default,
 * `bold` only for the active tab / nav item. The label belongs to the parent control.
 * Size with `small` (20 px) or a `size-*` class; the `.i` class sets 24 px otherwise.
 */
export function Icon({
  name,
  bold,
  small,
  className,
  ...props
}: { name: IconBase; bold?: boolean; small?: boolean } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const bodyOf = (style: 'bold' | 'linear') => (ICONS as Record<string, string>)[`${name}-${style}`]
  const body = (bold && bodyOf('bold')) || bodyOf('linear')
  const size = small ? 20 : 24
  return (
    <svg
      className={cn('i', small && 's', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      {...props}
      // base-ui's `render` prop may hand an element children; the glyph is the only content.
      children={undefined}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
