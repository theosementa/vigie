import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTags } from '@/features/items/queries'

/** Tag editor: chips + input. Enter or comma adds, Backspace on empty removes the last. Autocomplete from existing tags. */
export function TagInput({
  value,
  onChange,
  className,
  placeholder = 'Ajouter un tag',
  id,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  className?: string
  placeholder?: string
  id?: string
}) {
  const [text, setText] = useState('')
  const { data: allTags = [] } = useTags()
  const [focused, setFocused] = useState(false)

  const has = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase())

  const commit = (raw: string) => {
    const names = raw
      .split(',')
      .map((n) => n.replace(/^#/, '').trim())
      .filter(Boolean)
    const next = [...value]
    for (const n of names) if (!next.some((v) => v.toLowerCase() === n.toLowerCase())) next.push(n)
    if (next.length !== value.length) onChange(next)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit(text)
    } else if (e.key === 'Backspace' && text === '' && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const needle = text.trim().replace(/^#/, '').toLowerCase()
  const suggestions = allTags
    .filter((t) => !has(t.name) && t.name.toLowerCase().includes(needle))
    .slice(0, 6)

  return (
    <div
      className={cn(
        'relative flex flex-wrap items-center gap-1.5 rounded-xl border border-input bg-transparent p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium text-secondary-foreground"
        >
          #{t}
          <button
            type="button"
            aria-label={`Retirer ${t}`}
            onClick={() => onChange(value.filter((v) => v !== t))}
            className="rounded-full p-0.5 hover:bg-black/10"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => {
          const v = e.target.value
          if (v.includes(',')) commit(v)
          else setText(v)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          if (text.trim()) commit(text)
        }}
        placeholder={value.length === 0 ? placeholder : ''}
        aria-label="Tags"
        autoCapitalize="none"
        className="min-w-24 flex-1 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />
      {focused && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Suggestions de tags"
          className="absolute top-full right-0 left-0 z-50 mt-1 max-h-44 overflow-y-auto rounded-xl bg-popover p-1 text-sm shadow-lg ring-1 ring-foreground/10"
        >
          {suggestions.map((t) => (
            <li key={t.id} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown (not click) so the input keeps focus and blur does not commit first
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(t.name)
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left hover:bg-muted"
              >
                #{t.name}
                <span className="text-xs text-muted-foreground">{t.item_count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
