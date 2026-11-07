import type { ItemStatus } from '@/lib/api'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function StatusSegmented({
  value,
  onChange,
  className,
}: {
  value: ItemStatus
  onChange: (v: ItemStatus) => void
  className?: string
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as ItemStatus)} className={className}>
      <TabsList className="h-9 rounded-xl">
        <TabsTrigger value="to_watch" className="rounded-lg px-4">
          À voir
        </TabsTrigger>
        <TabsTrigger value="seen" className="rounded-lg px-4">
          Vu
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
