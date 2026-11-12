import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import type { MobileLayout } from '@/lib/mobileLayout'

/** Grid / list switch for the library; the value lives on the account (see `lib/mobileLayout`). */
export function LayoutToggle({ value, onChange }: { value: MobileLayout; onChange: (next: MobileLayout) => void }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('layout.toggle')} className="seg full layout-toggle">
      <button type="button" aria-pressed={value === 'grid'} aria-label={t('layout.grid')} title={t('layout.grid')} onClick={() => onChange('grid')}>
        <Icon name="widget-2" small />
      </button>
      <button type="button" aria-pressed={value === 'list'} aria-label={t('layout.list')} title={t('layout.list')} onClick={() => onChange('list')}>
        <Icon name="list" small />
      </button>
    </div>
  )
}
