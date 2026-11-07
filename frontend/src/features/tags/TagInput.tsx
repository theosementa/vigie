import { useState, type KeyboardEvent } from 'react'
import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { useTags } from '@/features/items/queries'

/** Tag editor of the DA: `.tag` chips and a « + Tag » field. Enter or comma adds, Backspace on empty removes the last. */
export function TagInput({
  value,
  onChange,
  id,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  id?: string
}) {
  const t = useT()
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
    .filter((tag) => !has(tag.name) && tag.name.toLowerCase().includes(needle))
    .slice(0, 6)

  return (
    <div className="tags tag-in">
      {value.map((name) => (
        <span key={name} className="tag">
          #{name}
          <button type="button" aria-label={t('tags.remove', { name })} onClick={() => onChange(value.filter((v) => v !== name))}>
            <Icon name="close" className="xs" />
          </button>
        </span>
      ))}
      <input
        id={id}
        className="tag add"
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
        placeholder={t('tags.add')}
        aria-label={t('item.tags')}
        autoCapitalize="none"
        autoComplete="off"
      />
      {focused && suggestions.length > 0 && (
        <ul role="listbox" aria-label={t('tags.suggestions')} className="suggest">
          {suggestions.map((tag) => (
            <li key={tag.id} role="option" aria-selected={false}>
              <button
                type="button"
                // mousedown (not click) so the input keeps focus and blur does not commit first
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(tag.name)
                }}
              >
                #{tag.name}
                <span className="sub">{tag.item_count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
