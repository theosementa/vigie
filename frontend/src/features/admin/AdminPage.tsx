import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { formatDate, fullName } from '@/lib/format'
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

const sectionClass = 'rounded-2xl bg-card p-4 ring-1 ring-border'
const headingClass = 'text-xs font-semibold tracking-wide text-muted-foreground uppercase'

const MODES: { value: RegistrationMode; label: string; help: string }[] = [
  { value: 'invite', label: 'Invitation', help: 'Seules les adresses que tu ajoutes peuvent créer un compte' },
  { value: 'open', label: 'Ouvert', help: 'Tout le monde peut s’inscrire' },
  { value: 'closed', label: 'Fermé', help: 'Plus aucune inscription' },
]

function RegistrationSection() {
  const { data: settings, error } = useAdminSettings()
  const setMode = useSetRegistrationMode()
  const current = MODES.find((m) => m.value === settings?.registration_mode)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Inscriptions</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      {settings && (
        <>
          <Tabs
            value={settings.registration_mode}
            onValueChange={(v) =>
              setMode.mutate(v as RegistrationMode, {
                onSuccess: () => toast.success('Mode d’inscription enregistré.'),
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
            className="mt-3"
          >
            <TabsList className="h-9 rounded-xl">
              {MODES.map((m) => (
                <TabsTrigger
                  key={m.value}
                  value={m.value}
                  disabled={setMode.isPending}
                  className="rounded-lg px-4"
                >
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="mt-3 text-sm">{current?.help}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Changer de mode ne touche jamais aux comptes existants.
          </p>
        </>
      )}
    </section>
  )
}

function InvitationsSection() {
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
      <h2 className={headingClass}>Adresses invitées</h2>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <Label htmlFor="invite-email" className="sr-only">
          Adresse e‑mail à inviter
        </Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="off"
          placeholder="ami@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-xl text-base md:text-sm"
        />
        <Button type="submit" className="h-10 rounded-xl" disabled={invite.isPending || !email.trim()}>
          Inviter
        </Button>
      </form>
      {(invite.error || error) && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(invite.error ?? error, 'Adresse invalide.')}
        </p>
      )}
      {invitations.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune adresse invitée pour l’instant.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{inv.email}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.used_at ? `Compte créé le ${formatDate(inv.used_at)}` : 'En attente'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer l’invitation de ${inv.email}`}
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
  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      toast.success('Lien copié.')
    } catch {
      toast.error('Copie impossible. Sélectionne le lien et copie-le à la main.')
    }
  }
  return (
    <Dialog open={link !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lien de réinitialisation</DialogTitle>
          <DialogDescription>
            Transmets ce lien à {name}. Il ne sert qu’une fois
            {link && ` et expire le ${new Date(link.expires_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`}.
          </DialogDescription>
        </DialogHeader>
        {link && (
          <div className="flex gap-2">
            <Input
              readOnly
              value={link.url}
              aria-label="Lien de réinitialisation"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 rounded-xl text-base md:text-sm"
            />
            <Button className="h-10 rounded-xl" onClick={copy}>
              <Icon name="copy" />
              Copier
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UsersSection({ meId }: { meId: string }) {
  const { data: users = [], error } = useAdminUsers()
  const resetLink = useResetLink()
  const remove = useRemoveUser()
  const [link, setLink] = useState<{ link: ResetLink; name: string } | null>(null)
  const [toDelete, setToDelete] = useState<AdminUser | null>(null)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Comptes</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errorMessage(error)}
        </p>
      )}
      <ul className="mt-3 divide-y divide-border">
        {users.map((u) => (
          <li key={u.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{fullName(u)}</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {u.role === 'admin' ? 'Administrateur' : 'Membre'}
              </span>
            </div>
            <p className="truncate text-muted-foreground">{u.email}</p>
            <p className="text-xs text-muted-foreground">
              Créé le {formatDate(u.created_at)} · {u.item_count}{' '}
              {u.item_count > 1 ? 'éléments' : 'élément'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
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
                Lien de réinitialisation
              </Button>
              {u.id !== meId && (
                <Button variant="destructive" size="sm" onClick={() => setToDelete(u)}>
                  Supprimer
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
        title="Supprimer ce compte"
        description={
          toDelete && (
            <>
              Le compte de {fullName(toDelete)} ({toDelete.email}) et toute sa bibliothèque seront
              supprimés immédiatement et définitivement.
            </>
          )
        }
        confirmLabel="Supprimer définitivement"
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success('Compte supprimé.')
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
    <div className="mx-auto max-w-2xl space-y-4 p-0 md:p-6">
      <RegistrationSection />
      <InvitationsSection />
      {me && <UsersSection meId={me.id} />}
    </div>
  )
}
