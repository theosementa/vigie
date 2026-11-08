import type { SVGProps } from 'react'
import { cn } from '@/lib/utils'
import { BRANDS, type BrandName } from './brands'

/**
 * Provider logo, inlined from the generated brands.ts (no request at runtime), in the text colour.
 * Decorative: the provider's name is always written next to it.
 */
export function BrandIcon({ name, className, ...props }: { name: BrandName } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      className={cn('i', className)}
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
      children={undefined}
      dangerouslySetInnerHTML={{ __html: BRANDS[name] }}
    />
  )
}
