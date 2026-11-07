import { Button } from '@/components/ui/button'
import { Icon } from '@/components/Icon'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StatsPeriod } from '@/lib/api'
import { useT, type MessageKey } from '@/lib/i18n'

const CURRENT: Record<StatsPeriod, MessageKey> = {
  week: 'stats.current.week',
  month: 'stats.current.month',
  year: 'stats.current.year',
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
  const t = useT()
  return (
    <div className="space-y-3">
      <Tabs value={period} onValueChange={(v) => onPeriod(v as StatsPeriod)}>
        <TabsList className="h-9 w-full rounded-xl md:w-fit">
          <TabsTrigger value="week" className="rounded-lg px-4">
            {t('stats.period.week')}
          </TabsTrigger>
          <TabsTrigger value="month" className="rounded-lg px-4">
            {t('stats.period.month')}
          </TabsTrigger>
          <TabsTrigger value="year" className="rounded-lg px-4">
            {t('stats.period.year')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon-lg" aria-label={t('stats.previous_period')} onClick={() => onOffset(offset - 1)}>
          <Icon name="alt-arrow-left" />
        </Button>
        <div className="min-w-0 text-center" aria-live="polite">
          <p className="truncate text-lg font-medium capitalize">{label ?? '…'}</p>
          {offset === 0 && <p className="text-xs text-muted-foreground">{t(CURRENT[period])}</p>}
        </div>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={t('stats.next_period')}
          disabled={offset >= 0}
          onClick={() => onOffset(Math.min(offset + 1, 0))}
        >
          <Icon name="alt-arrow-right" />
        </Button>
      </div>
    </div>
  )
}
