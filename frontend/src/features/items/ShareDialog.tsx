import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react'
import { Icon } from '@/components/Icon'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Contact, Item, ShareResult } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useT, type TFunction } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ContactAvatar } from '@/features/contacts/ContactAvatar'
import { contactLabel, useContacts, useCreateContact } from '@/features/contacts/queries'
import { useUpdateMe } from '@/features/auth/useAuth'
import { useShareItem } from './queries'

const emailSchema = z.string().email()
const makeFormSchema = (t: TFunction) =>
  z.object({
    emails: z.array(emailSchema).min(1, t('share.emails_required')).max(20),
    message: z.string().max(500, t('share.message_max')),
  })

function splitEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

interface Recipient {
  email: string
  /** The name of the matching contact, when there is one. */
  name: string | null
}

/** Matches `splitEmails` + the `@` test used to tell an address from a name being searched. */
const looksLikeAddress = (text: string) => text.includes('@')

/**
 * After a share: the addresses that are not contacts yet, to keep or skip. Opens in place (the
 * block grows from 0) and closes the same way, staying mounted until the exit has played.
 */
function SaveContactsPrompt({ addresses }: { addresses: string[] }) {
  const t = useT()
  const create = useCreateContact()
  const updateMe = useUpdateMe()
  const [names, setNames] = useState<Record<string, string>>({})
  const [always, setAlways] = useState(false)
  const [phase, setPhase] = useState<'open' | 'closing' | 'gone'>('open')
  const titleId = useId()

  useEffect(() => {
    if (phase !== 'closing') return
    const timer = setTimeout(() => setPhase('gone'), 280)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'gone') return null

  const save = async () => {
    try {
      await Promise.all(
        addresses.map((email) => create.mutateAsync({ email, name: names[email]?.trim() || null })),
      )
      if (always) await updateMe.mutateAsync({ auto_create_contacts: true })
      toast.success(t('share.saveContact.saved'))
      setPhase('closing')
    } catch {
      toast.error(t('share.saveContact.error'))
    }
  }

  const busy = create.isPending || updateMe.isPending
  return (
    <div className={phase === 'closing' ? 'expand leaving' : 'expand'} inert={phase === 'closing'}>
      <div role="group" aria-labelledby={titleId} className="p-1">
        <div className="grid gap-3 rounded-xl border border-line p-3">
          <div className="grid gap-1">
            <p id={titleId} className="font-medium">
              {t('share.saveContact.title')}
            </p>
            <p className="text-xs text-muted-foreground">{t('share.saveContact.body')}</p>
          </div>
          <div className="save-contact-rows">
            {addresses.map((email) => (
              <div key={email} className="save-contact-row">
                <span className="addr" title={email}>
                  {email}
                </span>
                <Input
                  aria-label={`${t('contacts.name')} - ${email}`}
                  autoComplete="off"
                  maxLength={100}
                  value={names[email] ?? ''}
                  placeholder={t('contacts.name')}
                  onChange={(e) => setNames({ ...names, [email]: e.target.value })}
                  className="h-9 rounded-lg"
                />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={always}
              onChange={(e) => setAlways(e.target.checked)}
              className="size-4 accent-[var(--accent-ink)]"
            />
            {t('share.saveContact.always')}
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-lg"
              disabled={busy}
              onClick={() => setPhase('closing')}
            >
              {t('share.saveContact.skip')}
            </Button>
            <Button type="button" className="h-9 rounded-lg" disabled={busy} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShareForm({ item, onClose }: { item: Item; onClose: () => void }) {
  const t = useT()
  const formSchema = useMemo(() => makeFormSchema(t), [t])
  const share = useShareItem()
  const { data: contacts = [] } = useContacts()
  const listId = useId()
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [text, setText] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShareResult | null>(null)

  const emails = recipients.map((r) => r.email)
  const byEmail = useMemo(() => new Map(contacts.map((c) => [c.email, c])), [contacts])

  /** Contacts not chosen yet that match what is typed (by name or address), most recent first. */
  const options = useMemo(() => {
    const q = text.trim().toLowerCase()
    return contacts
      .filter((c) => !emails.includes(c.email))
      .filter((c) => !q || c.email.includes(q) || (c.name ?? '').toLowerCase().includes(q))
  }, [contacts, emails, text])
  const showList = listOpen && options.length > 0
  // Typing a name (no "@") highlights the first match so Enter picks it.
  const current = active >= 0 ? Math.min(active, options.length - 1) : text.trim() && !looksLikeAddress(text) ? 0 : -1

  const add = (items: Recipient[]) => {
    setRecipients((prev) => {
      const next = [...prev]
      for (const r of items) if (!next.some((x) => x.email === r.email)) next.push(r)
      return next
    })
    setText('')
    setActive(-1)
    setError(null)
  }

  const pick = (c: Contact) => {
    add([{ email: c.email, name: c.name }])
    setListOpen(false)
  }

  /** Validate and add the pending text; returns the new list (or null when invalid). */
  const commit = (raw: string): string[] | null => {
    const parts = splitEmails(raw)
    if (parts.length === 0) return emails
    const invalid = parts.find((p) => !emailSchema.safeParse(p).success)
    if (invalid) {
      setError(t('share.invalid_email', { email: invalid }))
      return null
    }
    add(parts.map((email) => ({ email, name: byEmail.get(email)?.name ?? null })))
    return [...new Set([...emails, ...parts])]
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (options.length === 0) return
      e.preventDefault()
      if (!showList) return setListOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + options.length) % options.length)
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault()
      e.stopPropagation() // closes the list, not the dialog
      setListOpen(false)
    } else if (e.key === 'Enter') {
      if (showList && current >= 0) {
        e.preventDefault()
        pick(options[current])
      } else if (text.trim()) {
        e.preventDefault()
        commit(text)
      }
    } else if (e.key === ',' || e.key === ' ' || e.key === ';') {
      // Spaces belong to a name being searched; they only separate addresses.
      if (looksLikeAddress(text)) {
        e.preventDefault()
        commit(text)
      } else if (e.key !== ' ') {
        e.preventDefault()
      }
    } else if (e.key === 'Backspace' && !text && recipients.length) {
      setRecipients(recipients.slice(0, -1))
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const list = text.trim() ? commit(text) : emails
    if (list === null) return
    const parsed = formSchema.safeParse({ emails: list, message })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(null)
    share.mutate(
      {
        id: item.id,
        input: { emails: parsed.data.emails, message: parsed.data.message.trim() || null },
      },
      {
        onSuccess: (res) => {
          setResult(res)
          toast.success(t('share.shared_with', { names: res.sent.join(', ') }))
        },
        onError: (err) =>
          setError(errorMessage(err, t('share.failed'))),
      },
    )
  }

  if (result) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-ok">{t('share.result.sent', { names: result.sent.join(', ') })}</p>
        <p className="text-muted-foreground">{t('share.result.note')}</p>
        {result.unknown_contacts.length > 0 && (
          <SaveContactsPrompt addresses={result.unknown_contacts} />
        )}
        <Button className="h-10 w-full rounded-xl" onClick={onClose}>
          {t('common.done')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="share-emails">{t('share.recipients')}</Label>
        <div className="combo">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            {recipients.map((r) => (
              <span
                key={r.email}
                title={r.email}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs font-medium"
              >
                <span className="truncate">{r.name || r.email}</span>
                <button
                  type="button"
                  aria-label={t('tags.remove', { name: r.name || r.email })}
                  onClick={() => setRecipients(recipients.filter((x) => x.email !== r.email))}
                  className="rounded-full p-0.5 hover:bg-line"
                >
                  <Icon name="close" className="size-3" />
                </button>
              </span>
            ))}
            <input
              id="share-emails"
              type="text"
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showList && current >= 0 ? `${listId}-${current}` : undefined}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setActive(-1)
                setListOpen(true)
              }}
              onFocus={() => setListOpen(true)}
              onKeyDown={onKeyDown}
              onBlur={() => {
                setListOpen(false)
                if (looksLikeAddress(text)) commit(text)
              }}
              placeholder={recipients.length ? '' : t('admin.invite.placeholder')}
              className="min-w-40 flex-1 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>
          {/* Kept mounted and faded: the list never pops in or out. */}
          <ul
            id={listId}
            role="listbox"
            aria-label={t('share.suggestions')}
            className="combo-list"
            data-open={showList}
            // A click on an option must not blur the field first.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((c, i) => (
              <li
                key={c.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                className="combo-opt"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(c)}
              >
                <ContactAvatar contact={c} />
                <span className="min-w-0">
                  <span className="tt block">{contactLabel(c)}</span>
                  {c.name && <span className="meta block">{c.email}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">{t('share.hint')}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="share-message">{t('share.message')}</Label>
        <Textarea
          id="share-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder={t('share.message.placeholder')}
          className="rounded-xl"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full rounded-xl" disabled={share.isPending}>
        {share.isPending ? t('share.sending') : t('share.submit')}
      </Button>
    </form>
  )
}

export function ShareDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const t = useT()
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('item.share')}</DialogTitle>
          <DialogDescription className="line-clamp-2">{item?.resource.title}</DialogDescription>
        </DialogHeader>
        {/* keyed so the form state resets for each item / each opening */}
        {item && <ShareForm key={item.id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
