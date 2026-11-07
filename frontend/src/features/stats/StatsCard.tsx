import { useId, type ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Titled card; the heading labels the region for assistive tech. */
export function StatsCard({
  title,
  action,
  className,
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className={cn('rounded-2xl bg-card p-4 ring-1 ring-border', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="h-label">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-muted', className)} />
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT()
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Icon name="restart" /> {t('common.retry')}
      </Button>
    </div>
  )
}

/** Collapsible text alternative to a chart. */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: (string | number)[][]
}) {
  const t = useT()
  return (
    <details className="mt-3 text-sm">
      <summary className="w-fit cursor-pointer rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        {t('stats.table.show')}
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg ring-1 ring-border">
        <table className="w-full text-left text-xs tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-card">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-1.5 font-medium text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-3 py-1.5 font-normal whitespace-nowrap">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-3 py-1.5">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
