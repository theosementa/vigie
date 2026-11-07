import type { ResourceType } from '@/lib/api'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

const LABELS: Record<ResourceType | 'all', string> = {
  all: 'Tous les types',
  article: 'Articles',
  video: 'Vidéos',
}

export function TypeFilter({
  value,
  onChange,
}: {
  value: ResourceType | 'all'
  onChange: (v: ResourceType | 'all') => void
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ResourceType | 'all')}>
      <SelectTrigger className="h-9 w-40 rounded-xl" aria-label="Filtrer par type">
        <span>{LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
          <SelectItem key={k} value={k}>
            {LABELS[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
