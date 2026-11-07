import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StatsPeriod, StatsSummary } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { formatCount, formatMinutes } from './format'
import { useGoals, type Goals } from './goals'
import { StatsCard } from './StatsCard'

const SIZE = 168
const STROKE = 16
const RADII = [76, 56, 36]

/** Full class names (Tailwind only generates classes it can find literally). */
const COLORS = {
  items: { track: 'stroke-chart-1/20', arc: 'stroke-chart-1', dot: 'bg-chart-1' },
  watch: { track: 'stroke-chart-2/20', arc: 'stroke-chart-2', dot: 'bg-chart-2' },
  streak: { track: 'stroke-chart-3/20', arc: 'stroke-chart-3', dot: 'bg-chart-3' },
} as const

interface Ring {
  key: keyof typeof COLORS
  name: string
  ratio: number
  /** Visible value text, e.g. "3 / 5" */
  text: string
}

function RingsGraphic({ rings, label }: { rings: Ring[]; label: string }) {
  const c = SIZE / 2
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} className="shrink-0">
      {rings.map((r, i) => {
        const radius = RADII[i]
        const circumference = 2 * Math.PI * radius
        const ratio = Math.min(Math.max(r.ratio, 0), 1)
        return (
          <g key={r.key} transform={`rotate(-90 ${c} ${c})`}>
            <circle cx={c} cy={c} r={radius} fill="none" strokeWidth={STROKE} className={COLORS[r.key].track} />
            {ratio > 0 && (
              <circle
                cx={c}
                cy={c}
                r={radius}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                className={`ring-fill ${COLORS[r.key].arc}`}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - ratio)}
                style={{ '--ring-c': circumference } as React.CSSProperties}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function GoalForm({
  period,
  goals,
  onSave,
  onCancel,
}: {
  period: StatsPeriod
  goals: Goals
  onSave: (g: Goals) => void
  onCancel: () => void
}) {
  const t = useT()
  const [items, setItems] = useState(String(goals.items))
  const [minutes, setMinutes] = useState(String(goals.minutes))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSave({ items: Number(items), minutes: Number(minutes) })
  }
  const title = t(`stats.goals.of_${period}` as const)
  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-muted/50 p-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="goal-items">{t('stats.items_seen_title')}</Label>
          <Input id="goal-items" type="number" min={1} inputMode="numeric" value={items} onChange={(e) => setItems(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-minutes">{t('stats.goals.minutes')}</Label>
          <Input id="goal-minutes" type="number" min={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm">
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}

/** Apple Health-style concentric rings: items seen, watch time, streak. */
export function RingsCard({ summary }: { summary: StatsSummary }) {
  const t = useT()
  const { goals, setGoals } = useGoals(summary.period)
  const [editing, setEditing] = useState(false)

  const seen = summary.current.articles_read + summary.current.videos_seen
  const watchMin = Math.round(summary.current.watch_seconds / 60)
  const { current: streak, best } = summary.streak
  const streakGoal = Math.max(best, streak)

  const rings: Ring[] = [
    {
      key: 'items',
      name: t('stats.items_seen_title'),
      ratio: seen / goals.items,
      text: `${formatCount(seen)} / ${formatCount(goals.items)}`,
    },
    {
      key: 'watch',
      name: t('stats.watch_time'),
      ratio: watchMin / goals.minutes,
      text: `${formatMinutes(watchMin)} / ${formatMinutes(goals.minutes)}`,
    },
    {
      key: 'streak',
      name: t('kpi.streak'),
      ratio: streakGoal > 0 ? streak / streakGoal : 0,
      text: `${t('kpi.days_n', { count: streak })} · ${t('kpi.record', { best })}`,
    },
  ]
  const label = t('stats.goals.label', {
    rings: rings.map((r) => `${r.name} ${r.text.replace(' / ', ` ${t('stats.goals.of')} `)}`).join(' ; '),
  })

  return (
    <StatsCard
      title={t('stats.goals')}
      className="md:col-span-2 xl:col-span-1"
      action={
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={editing}
          onClick={() => setEditing((v) => !v)}
          className="-my-1 text-accent-ink"
        >
          <Icon name="target" /> {t('stats.goals.edit')}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center xl:flex-col">
        <RingsGraphic rings={rings} label={label} />
        <dl className="w-full max-w-xs space-y-3">
          {rings.map((r) => (
            <div key={r.key} className="flex items-start gap-3">
              <span aria-hidden className={`mt-1 size-3 shrink-0 rounded-full ${COLORS[r.key].dot}`} />
              <div>
                <dt className="text-xs text-muted-foreground">{r.name}</dt>
                <dd className="text-base font-medium tabular-nums">{r.text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      {editing && (
        <GoalForm
          key={summary.period}
          period={summary.period}
          goals={goals}
          onSave={(g) => {
            setGoals(g)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </StatsCard>
  )
}
