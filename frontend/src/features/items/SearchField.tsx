import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Search input, pushes the value to the URL after a 300 ms debounce. */
export function SearchField({
  value,
  onChange,
  className,
  autoFocus,
}: {
  value: string
  onChange: (q: string) => void
  className?: string
  autoFocus?: boolean
}) {
  const t = useT()
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 300)

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  // The URL can change the search from elsewhere (a saved view, back/forward): follow it.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== debounced) setText(value)
  }

  return (
    <label className={cn('in', className)}>
      <Icon name="magnifier" className="xs" />
      <input
        type="search"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
      />
    </label>
  )
}
