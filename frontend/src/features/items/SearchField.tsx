import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'

/** Search input, pushes the value to the URL after a 300 ms debounce. */
export function SearchField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (q: string) => void
  className?: string
}) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, 300)

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Rechercher"
        aria-label="Rechercher"
        className="h-9 rounded-xl border-transparent bg-muted pl-8"
      />
    </div>
  )
}
