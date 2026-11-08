import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { Sheet } from '@/components/Sheet'
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
import { useIsMobile } from '@/hooks/useIsMobile'
import type { SavedView } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { defaultViewName, MAX_NAME } from './query'
import { useCreateView, useRenameView } from './queries'
import { ViewDialogsContext, type ViewDialogsApi } from './viewDialogsContext'

type Target = { save: string } | { rename: SavedView }

const FORM_ID = 'view-name-form'

function NameForm({ target, mobile, onClose }: { target: Target; mobile: boolean; onClose: () => void }) {
  const t = useT()
  const create = useCreateView()
  const rename = useRenameView()
  const renaming = 'rename' in target
  const [name, setName] = useState(renaming ? target.rename.name : defaultViewName(target.save))
  const pending = create.isPending || rename.isPending
  const trimmed = name.trim()

  const submit = () => {
    if (!trimmed) return
    if (!renaming) create.mutate({ name: trimmed, query: target.save }, { onSuccess: onClose })
    else if (trimmed === target.rename.name) onClose()
    else rename.mutate({ id: target.rename.id, name: trimmed }, { onSuccess: onClose })
  }

  return (
    <form
      id={FORM_ID}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Input
        autoFocus
        required
        aria-label={t('view.name')}
        value={name}
        maxLength={MAX_NAME}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="h-10 rounded-xl"
      />
      {!mobile && (
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="h-10 rounded-xl" disabled={pending || !trimmed}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      )}
    </form>
  )
}

/** Hosts the "name this view" dialog (desktop) or sheet (phone), for saving and renaming. */
export function ViewDialogsProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const mobile = useIsMobile()
  const [target, setTarget] = useState<Target | null>(null)
  // Keep the last target while the dialog closes, so its content does not blank mid-animation.
  const [last, setLast] = useState<Target | null>(null)
  if (target !== null && target !== last) setLast(target)
  const shown = target ?? last

  const api: ViewDialogsApi = useMemo(
    () => ({ save: (save) => setTarget({ save }), rename: (rename) => setTarget({ rename }) }),
    [],
  )
  const close = () => setTarget(null)
  const title = shown && 'rename' in shown ? t('view.rename.title') : t('view.save.title')
  // keyed so the field restarts from the right name at each opening
  const form = shown && (
    <NameForm key={'rename' in shown ? shown.rename.id : shown.save} target={shown} mobile={mobile} onClose={close} />
  )

  return (
    <ViewDialogsContext.Provider value={api}>
      {children}
      {mobile ? (
        <Sheet
          open={target !== null}
          onOpenChange={(o) => !o && close()}
          title={title}
          footer={
            <button type="submit" form={FORM_ID} className="cta">
              <Icon name="bookmark" small />
              {t('common.save')}
            </button>
          }
        >
          {form}
        </Sheet>
      ) : (
        <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{t('view.name.hint')}</DialogDescription>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      )}
    </ViewDialogsContext.Provider>
  )
}
