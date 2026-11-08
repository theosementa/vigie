import { Icon } from '@/components/Icon'
import type { ResourceType } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { TYPE_ICON } from './metadata'

/**
 * The type choice of an item: chips that wrap onto as many lines as needed, so it never runs off a
 * narrow screen however many types there are (a segmented control cannot).
 */
export function TypePicker({
  value,
  types,
  onChange,
  labelledBy,
  label,
}: {
  value: ResourceType
  types: ResourceType[]
  onChange: (type: ResourceType) => void
  /** id of a visible heading, or `label` for an invisible one. */
  labelledBy?: string
  label?: string
}) {
  const t = useT()
  return (
    <div className="type-picker" role="group" aria-labelledby={labelledBy} aria-label={label}>
      {types.map((type) => (
        <button key={type} type="button" className="chip" aria-pressed={value === type} onClick={() => onChange(type)}>
          <Icon name={TYPE_ICON[type]} />
          {t(`type.${type}`)}
        </button>
      ))}
    </div>
  )
}
