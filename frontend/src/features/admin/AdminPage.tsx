import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMe } from '@/features/auth/useAuth'
import type { AdminUser, RegistrationMode, ResetLink } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { formatDate, formatDateTime, fullName } from '@/lib/format'
import { useT, type MessageKey } from '@/lib/i18n'
import {
  useAdminSettings,
  useAdminUsers,
  useInvitations,
  useInvite,
  useRemoveInvitation,
  useRemoveUser,
  useResetLink,
  useSetRegistrationMode,
} from './queries'
import { AnalyticsSection } from './AnalyticsSection'

const sectionClass = 'panel'
const headingClass = 'h-label'

const MODES: { value: RegistrationMode; label: MessageKey; help: MessageKey }[] = [
  { value: 'invite', label: 'admin.mode.invite', help: 'admin.mode.invite.help' },
  { value: 'open', label: 'admin.mode.open', help: 'admin.mode.open.help' },
  { value: 'closed', label: 'admin.mode.closed', help: 'admin.mode.closed.help' },
]

function RegistrationSection() {
  const t = useT()
  const { data: settings, error } = useAdminSettings()
  const setMode = useSetRegistrationMode()
  const current = MODES.find((m) => m.value === settings?.registration_mode)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('admin.registration')}</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      {settings && (
        <>
          <div role="group" aria-label={t('admin.registration')} className="seg full mt-3">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={settings.registration_mode === m.value}
                disabled={setMode.isPending}
                onClick={() =>
                  setMode.mutate(m.value, {
                    onSuccess: () => toast.success(t('admin.mode.saved')),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                {t(m.label)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm">{current && t(current.help)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('admin.mode.note')}</p>
        </>
      )}
    </section>
  )
}

function InvitationsSection() {
  const t = useT()
  const { data: invitations = [], error } = useInvitations()
  const invite = useInvite()
  const remove = useRemoveInvitation()
  const [email, setEmail] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value) return
    invite.mutate(value, { onSuccess: () => setEmail('') })
  }

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('admin.invitations')}</h2>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Label htmlFor="invite-email" className="sr-only">
          {t('admin.invite.label')}
        </Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder={t('admin.invite.placeholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-[10px] text-base md:text-sm"
        />
        <Button type="submit" className="h-10 rounded-[10px]" disabled={invite.isPending || !email.trim()}>
          {t('admin.invite')}
        </Button>
      </form>
      {(invite.error || error) && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(invite.error ?? error, t('admin.invite.invalid'))}
        </p>
      )}
      {invitations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('admin.invitations.empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.used_at ? t('admin.invitation.used', { date: formatDate(inv.used_at) }) : t('admin.invitation.pending')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('admin.invitation.remove', { email: inv.email })}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(inv.id, { onError: (e) => toast.error(errorMessage(e)) })
                }
              >
                <Icon name="trash-bin-minimalistic" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ResetLinkDialog({ link, name, onClose }: { link: ResetLink | null; name: string; onClose: () => void }) {
  const t = useT()
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success(t('admin.reset.copied'))
    } catch {
      toast.error(t('admin.reset.copy_failed'))
    }
  }
  return (
    <Dialog open={link !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('admin.reset.title')}</DialogTitle>
          <DialogDescription>
            {link ? t('admin.reset.body', { name, date: formatDateTime(link.expires_at) }) : null}
          </DialogDescription>
        </DialogHeader>
        {link && (
          <div className="flex gap-2">
            <Input
              readOnly
              value={link.url}
              aria-label={t('admin.reset.title')}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 rounded-[10px] text-base md:text-sm"
            />
            <Button className="h-10 rounded-[10px]" onClick={copy}>
              <Icon name="copy" />
              {t('common.copy')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UsersSection({ meId }: { meId: string }) {
  const t = useT()
  const { data: users = [], error } = useAdminUsers()
  const resetLink = useResetLink()
  const remove = useRemoveUser()
  const [link, setLink] = useState<{ link: ResetLink; name: string } | null>(null)
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('admin.users')}</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      <ul className="mt-3 divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="font-medium">{fullName(u)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t(u.role === 'admin' ? 'role.admin.long' : 'role.user')}
                </span>
              </p>
              <p className="truncate text-muted-foreground">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {t('admin.user.meta', { date: formatDate(u.created_at), count: u.item_count })}
              </p>
            </div>
            <div className="flex flex-none gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={resetLink.isPending}
                onClick={() =>
                  resetLink.mutate(u.id, {
                    onSuccess: (l) => setLink({ link: l, name: fullName(u) }),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                {t('admin.reset.title')}
              </Button>
              {u.id !== meId && (
                <Button variant="destructive" size="sm" onClick={() => setToDelete(u)}>
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ResetLinkDialog link={link?.link ?? null} name={link?.name ?? ''} onClose={() => setLink(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => {
          if (!o) {
            setToDelete(null)
            remove.reset()
          }
        }}
        title={t('admin.delete.title')}
        description={
          toDelete && (
            t('admin.delete.body', { name: fullName(toDelete), email: toDelete.email })
          )
        }
        confirmLabel={t('settings.delete.confirm')}
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('admin.delete.done'))
              setToDelete(null)
            },
          })
        }
      />
    </section>
  )
}

export function AdminPage() {
  const { data: me } = useMe()
  return (
    <div className="lib form-page mx-auto max-w-2xl">
      <AnalyticsSection />
      <RegistrationSection />
      <InvitationsSection />
      {me && <UsersSection meId={me.id} />}
    </div>
  )
}
