import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/features/auth/Field'
import {
  useChangePassword,
  useDeleteAccount,
  useLogout,
  useLogoutAll,
  useMe,
  useUpdateMe,
} from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/errors'
import { browserTimeZone, timeZoneOptions } from '@/lib/timezone'
import type { User } from '@/lib/api'

const sectionClass = 'rounded-2xl bg-card p-4 ring-1 ring-border'
const headingClass = 'text-xs font-semibold tracking-wide text-muted-foreground uppercase'

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'Prénom requis').max(50, '50 caractères maximum'),
  last_name: z.string().trim().min(1, 'Nom requis').max(50, '50 caractères maximum'),
})
type ProfileValues = z.infer<typeof profileSchema>

function ProfileSection({ me }: { me: User }) {
  const update = useUpdateMe()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: me.first_name, last_name: me.last_name },
  })

  const onSubmit = (values: ProfileValues) =>
    update.mutate(values, {
      onSuccess: (user) => {
        reset({ first_name: user.first_name, last_name: user.last_name })
        toast.success('Nom mis à jour.')
      },
    })

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Compte</h2>
      <p className="mt-2 text-sm text-muted-foreground">{me.email}</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="first_name"
            label="Prénom"
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Field
            id="last_name"
            label="Nom"
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Ton nom s’affiche quand tu envoies un lien à quelqu’un. Il n’est visible par personne
          d’autre.
        </p>
        <Button
          type="submit"
          className="h-10 w-full rounded-xl"
          disabled={!isDirty || update.isPending}
        >
          Enregistrer
        </Button>
      </form>
    </section>
  )
}

function TimezoneSection({ timezone }: { timezone: string }) {
  const update = useUpdateMe()
  const browserTz = browserTimeZone()
  const options = useMemo(() => timeZoneOptions(timezone), [timezone])

  const change = (tz: string) => {
    if (tz === timezone) return
    update.mutate({ timezone: tz }, { onSuccess: () => toast.success('Fuseau horaire mis à jour.') })
  }

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Fuseau horaire</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Détermine les jours, semaines et séries des statistiques.
      </p>
      <Label htmlFor="timezone" className="mt-3">
        Fuseau actuel
      </Label>
      <select
        id="timezone"
        value={timezone}
        disabled={update.isPending}
        onChange={(e) => change(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
      >
        {options.map((tz) => (
          <option key={tz} value={tz}>
            {tz}
          </option>
        ))}
      </select>
      {browserTz !== timezone && (
        <Button
          variant="outline"
          className="mt-3 h-10 w-full rounded-xl"
          disabled={update.isPending}
          onClick={() => change(browserTz)}
        >
          Utiliser celui de mon navigateur ({browserTz})
        </Button>
      )}
    </section>
  )
}

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Mot de passe actuel requis'),
  new_password: z.string().min(8, '8 caractères minimum'),
})
type PasswordValues = z.infer<typeof passwordSchema>

function PasswordSection() {
  const change = useChangePassword()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) })

  const onSubmit = (values: PasswordValues) =>
    change.mutate(values, {
      onSuccess: () => {
        reset()
        toast.success('Mot de passe modifié. Tes autres appareils sont déconnectés.')
      },
    })

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Mot de passe</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3" noValidate>
        <Field
          id="current_password"
          label="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register('current_password')}
        />
        <Field
          id="new_password"
          label="Nouveau mot de passe"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum."
          error={errors.new_password?.message}
          {...register('new_password')}
        />
        {change.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(change.error, 'Modification impossible. Réessaie.')}
          </p>
        )}
        <Button type="submit" className="h-10 w-full rounded-xl" disabled={change.isPending}>
          Changer le mot de passe
        </Button>
      </form>
    </section>
  )
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate()
  const del = useDeleteAccount()
  const [password, setPassword] = useState('')

  const close = (o: boolean) => {
    if (!o) {
      setPassword('')
      del.reset()
    }
    onOpenChange(o)
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={close}
      title="Supprimer mon compte"
      description={
        <>
          Tout sera supprimé immédiatement et définitivement : ta bibliothèque, tes tags, ta file
          d’attente, tes statistiques et tes sessions. Les liens que tu as envoyés restent chez leurs
          destinataires, sans ton nom.
        </>
      }
      confirmLabel="Supprimer définitivement"
      pending={del.isPending}
      error={del.error ? errorMessage(del.error, 'Suppression impossible. Réessaie.') : null}
      onConfirm={() => {
        if (!password) return
        del.mutate(password, { onSuccess: () => navigate('/login', { replace: true }) })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="delete-password">Confirme avec ton mot de passe</Label>
        <Input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl text-base md:text-sm"
        />
      </div>
    </ConfirmDialog>
  )
}

function SessionSection() {
  const logout = useLogout()
  const logoutAll = useLogoutAll()
  const navigate = useNavigate()
  const [confirmAll, setConfirmAll] = useState(false)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>Sessions</h2>
      <div className="mt-3 space-y-2">
        <Button
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
        >
          Se déconnecter
        </Button>
        <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => setConfirmAll(true)}>
          Me déconnecter partout
        </Button>
      </div>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Me déconnecter partout"
        description="Tous tes appareils, y compris celui-ci, seront déconnectés. Tu devras te reconnecter."
        confirmLabel="Me déconnecter partout"
        destructive={false}
        pending={logoutAll.isPending}
        error={logoutAll.error ? errorMessage(logoutAll.error) : null}
        onConfirm={() => logoutAll.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
      />
    </section>
  )
}

function DangerZone() {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-destructive/40">
      <h2 className="text-xs font-semibold tracking-wide text-destructive uppercase">Zone de danger</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Supprimer ton compte efface toutes tes données, sans retour possible.
      </p>
      <Button variant="destructive" className="mt-3 h-11 w-full rounded-xl" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </section>
  )
}

export function SettingsPage() {
  const { data: me } = useMe()
  return (
    <div className="mx-auto max-w-xl space-y-4 p-0 md:p-6">
      {me && <ProfileSection key={`${me.first_name}|${me.last_name}`} me={me} />}
      {me && <TimezoneSection timezone={me.timezone} />}
      <PasswordSection />
      <SessionSection />
      {me?.role === 'admin' && (
        <Link
          to="/admin"
          className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm font-medium ring-1 ring-border md:hidden"
        >
          <ShieldCheck className="size-5" strokeWidth={1.75} />
          Administration
        </Link>
      )}
      <DangerZone />
    </div>
  )
}
