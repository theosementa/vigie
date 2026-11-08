import { useState } from 'react'
import { z } from 'zod'
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
import { Label } from '@/components/ui/label'
import type { Contact } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { useCreateContact, useRenameContact } from './queries'

/** `null` = closed, `'new'` = adding, a contact = renaming it. */
export type ContactDialogTarget = Contact | 'new' | null

const emailSchema = z.string().email()

function ContactForm({ target, onClose }: { target: Contact | 'new'; onClose: () => void }) {
  const t = useT()
  const create = useCreateContact()
  const rename = useRenameContact()
  const adding = target === 'new'
  const [email, setEmail] = useState('')
  const [name, setName] = useState(adding ? '' : (target.name ?? ''))
  const [error, setError] = useState<string | null>(null)
  const pending = create.isPending || rename.isPending

  const submit = () => {
    const trimmed = name.trim() || null
    if (adding) {
      const address = email.trim().toLowerCase()
      if (!emailSchema.safeParse(address).success) return setError(t('contacts.invalid_email'))
      create.mutate({ email: address, name: trimmed }, { onSuccess: onClose })
    } else if (trimmed === target.name) {
      onClose()
    } else {
      rename.mutate({ id: target.id, name: trimmed }, { onSuccess: onClose })
    }
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {adding && (
        <div className="grid gap-1.5">
          <Label htmlFor="contact-email">{t('contacts.email')}</Label>
          <Input
            id="contact-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            autoFocus
            value={email}
            maxLength={320}
            aria-invalid={error !== null}
            onChange={(e) => {
              setEmail(e.target.value)
              setError(null)
            }}
            className="h-10 rounded-xl"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="contact-name">{t('contacts.name')}</Label>
        <Input
          id="contact-name"
          autoComplete="off"
          autoFocus={!adding}
          value={name}
          maxLength={100}
          placeholder={adding ? t('contacts.name.placeholder') : target.email}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => !adding && e.target.select()}
          className="h-10 rounded-xl"
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" className="h-10 rounded-xl" disabled={pending}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Add a contact, or rename one (modelled on the item RenameDialog). */
export function ContactDialog({
  target,
  onClose,
}: {
  target: ContactDialogTarget
  onClose: () => void
}) {
  const t = useT()
  // Keep the last target while the dialog closes, so its content does not blank mid-animation.
  const [last, setLast] = useState<ContactDialogTarget>(target)
  if (target !== null && target !== last) setLast(target)
  const shown = target ?? last
  const adding = shown === 'new'
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{adding ? t('contacts.add') : t('contacts.rename.title')}</DialogTitle>
          <DialogDescription>
            {adding ? t('contacts.add.hint') : t('contacts.rename.hint')}
          </DialogDescription>
        </DialogHeader>
        {/* keyed so the fields restart from the current values at each opening */}
        {shown && (
          <ContactForm
            key={shown === 'new' ? 'new' : shown.id}
            target={shown}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
