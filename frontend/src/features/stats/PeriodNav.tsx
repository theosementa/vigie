import { Button } from '@/components/ui/button'
import { Icon } from '@/components/Icon'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StatsPeriod } from '@/lib/api'

const CURRENT: Record<StatsPeriod, string> = {
  week: 'Cette semaine',
  month: 'Ce mois-ci',
  year: 'Cette année',
}

/** Segmented Semaine | Mois | Année plus arrows to move through time (next disabled on the current period). */
export function PeriodNav({
  period,
  offset,
  label,
  onPeriod,
  onOffset,
}: {
  period: StatsPeriod
  offset: number
  /** Localized range, or null while it is unknown */
  label: string | null
  onPeriod: (p: StatsPeriod) => void
  onOffset: (offset: number) => void
}) {
  return (
    <div className="space-y-3">
      <Tabs value={period} onValueChange={(v) => onPeriod(v as StatsPeriod)}>
        <TabsList className="h-9 w-full rounded-xl md:w-fit">
          <TabsTrigger value="week" className="rounded-lg px-4">
            Semaine
          </TabsTrigger>
          <TabsTrigger value="month" className="rounded-lg px-4">
            Mois
          </TabsTrigger>
          <TabsTrigger value="year" className="rounded-lg px-4">
            Année
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon-lg" aria-label="Période précédente" onClick={() => onOffset(offset - 1)}>
          <Icon name="alt-arrow-left" />
        </Button>
        <div className="min-w-0 text-center" aria-live="polite">
          <p className="truncate text-lg font-semibold capitalize">{label ?? '…'}</p>
          {offset === 0 && <p className="text-xs text-muted-foreground">{CURRENT[period]}</p>}
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Période suivante"
          disabled={offset >= 0}
          onClick={() => onOffset(Math.min(offset + 1, 0))}
        >
          <Icon name="alt-arrow-right" />
        </Button>
      </div>
    </div>
  )
}
