import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Item } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { siteOf } from './metadata'
import { useUpdateItem } from './queries'

function RenameForm({ item, onClose }: { item: Item; onClose: () => void }) {
  const t = useT()
  const update = useUpdateItem()
  const [value, setValue] = useState(item.resource.title)

  const submit = (title: string) => {
    if (title.trim() === item.resource.title) return onClose()
    update.mutate(
      { id: item.id, input: { title } },
      { onSuccess: onClose, onError: () => toast.error(t('item.rename.error')) },
    )
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
    >
      <Input
        autoFocus
        aria-label={t('item.rename.title')}
        value={value}
        maxLength={500}
        placeholder={siteOf(item.resource)}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="h-10 rounded-xl"
      />
      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          className="h-10 rounded-xl sm:mr-auto"
          disabled={update.isPending}
          onClick={() => submit('')}
        >
          {t('item.rename.reset')}
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-10 rounded-xl" disabled={update.isPending}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function RenameDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useT()
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('item.rename.title')}</DialogTitle>
          <DialogDescription>{t('item.rename.hint')}</DialogDescription>
        </DialogHeader>
        {/* keyed so the field restarts from the current title at each opening */}
        {item && <RenameForm key={item.id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
