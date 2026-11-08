import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/button'
import { useLeaving } from '@/hooks/useLeaving'
import type { Contact } from '@/lib/api'
import { formatAgo } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ContactDialog, type ContactDialogTarget } from './ContactDialog'
import { contactLabel, useContacts, useDeleteContact } from './queries'

export function ContactAvatar({ contact }: { contact: Pick<Contact, 'name' | 'email'> }) {
  return (
    <span className="av" aria-hidden="true">
      {contactLabel(contact).charAt(0).toUpperCase()}
    </span>
  )
}

function ContactRow({
  contact,
  onRename,
  onDelete,
}: {
  contact: Contact
  onRename: (c: Contact) => void
  onDelete: (c: Contact) => void
}) {
  const t = useT()
  const label = contactLabel(contact)
  return (
    <div className="ct">
      <Link to={`/contacts/${contact.id}`} className="open ct-main">
        <ContactAvatar contact={contact} />
        <span className="ct-text">
          <span className="tt">{label}</span>
          <span className="meta">
            {contact.name && <span>{contact.email} · </span>}
            {contact.last_shared_at
              ? t('contacts.last_shared', { when: formatAgo(contact.last_shared_at) })
              : t('contacts.never_shared')}
          </span>
        </span>
      </Link>
      <div className="above ct-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label={`${t('contacts.rename')} ${label}`}
          title={t('contacts.rename')}
          onClick={() => onRename(contact)}
        >
          <Icon name="pen" small />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${t('contacts.delete')} ${label}`}
          title={t('contacts.delete')}
          onClick={() => onDelete(contact)}
        >
          <Icon name="trash-bin-minimalistic" small />
        </button>
      </div>
    </div>
  )
}

/** The private address book: rename, delete, and open the history of each contact. */
export function ContactsPage() {
  const t = useT()
  const { data, isPending, isError, refetch } = useContacts()
  const del = useDeleteContact()
  const [dialog, setDialog] = useState<ContactDialogTarget>(null)
  // The contact stays set while the confirmation fades out, so its text does not blank.
  const [toDelete, setToDelete] = useState<Contact | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const rows = useLeaving(data ?? [])

  if (isPending) {
    return <div role="status" aria-label={t('common.loading')} className="ct-skeleton" />
  }
  if (isError) {
    return (
      <div role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
        <p>{t('contacts.error')}</p>
        <button type="button" onClick={() => refetch()} className="mt-1 font-medium underline">
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="lib form-page mx-auto w-full max-w-xl">
      <div className="flex justify-end">
        <Button className="btn btn-accent btn-sm" onClick={() => setDialog('new')}>
          <Icon name="add" small />
          {t('contacts.add')}
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <div className="ghost">{t('title.contacts')}</div>
          <p>{t('contacts.empty.body')}</p>
        </div>
      ) : (
        <ul className="list">
          {rows.map(({ item: c, leaving }, index) => (
            <li
              key={c.id}
              className={cn('min-w-0', leaving ? 'leaving' : 'enter')}
              style={leaving ? undefined : ({ '--i': index % 8 } as CSSProperties)}
              inert={leaving}
            >
              <ContactRow contact={c} onRename={setDialog} onDelete={(c) => {
                  setToDelete(c)
                  setConfirmOpen(true)
                }} />
            </li>
          ))}
        </ul>
      )}
      <ContactDialog target={dialog} onClose={() => setDialog(null)} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('contacts.delete.title')}
        description={t('contacts.delete.body', {
          name: toDelete ? contactLabel(toDelete) : '',
        })}
        confirmLabel={t('contacts.delete')}
        pending={del.isPending}
        onConfirm={() => {
          if (!toDelete) return
          const id = toDelete.id
          setConfirmOpen(false)
          del.mutate(id, { onSuccess: () => toast(t('contacts.deleted')) })
        }}
      />
    </div>
  )
}
