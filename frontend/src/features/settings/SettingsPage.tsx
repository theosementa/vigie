import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
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
  useRevokeSession,
  useSessions,
  useUpdateMe,
} from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/errors'
import { formatAgo } from '@/lib/format'
import { browserTimeZone, timeZoneOptions } from '@/lib/timezone'
import type { Locale, Theme, User } from '@/lib/api'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { useLocalePreference } from '@/hooks/useLocale'
import { useTheme } from '@/hooks/useTheme'
import { useMobileLayout, type MobileLayout } from '@/lib/mobileLayout'
import { useHiddenTypes } from '@/lib/hiddenTypes'
import { RESOURCE_TYPES, TYPE_ICON } from '@/features/items/metadata'
import { useZoomLock } from '@/lib/zoomLock'
import type { IconBase } from '@/components/Icon'

const sectionClass = 'panel'
const headingClass = 'h-label'

const makeProfileSchema = (t: TFunction) =>
  z.object({
    first_name: z.string().trim().min(1, t('auth.validation.first_name_required')).max(50, t('auth.validation.max_50')),
    last_name: z.string().trim().min(1, t('auth.validation.last_name_required')).max(50, t('auth.validation.max_50')),
  })
type ProfileValues = z.infer<ReturnType<typeof makeProfileSchema>>

function ProfileSection({ me }: { me: User }) {
  const t = useT()
  const profileSchema = useMemo(() => makeProfileSchema(t), [t])
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
        toast.success(t('settings.name_updated'))
      },
    })

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('settings.account')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{me.email}</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field
            id="first_name"
            label={t('auth.first_name')}
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Field
            id="last_name"
            label={t('auth.last_name')}
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('auth.name_note')}</p>
        <Button
          type="submit"
          className="h-10 w-full rounded-[10px]"
          disabled={!isDirty || update.isPending}
        >
          {t('common.save')}
        </Button>
      </form>
    </section>
  )
}

const THEMES: { value: Theme; label: MessageKey; icon: IconBase }[] = [
  { value: 'dark', label: 'theme.dark', icon: 'moon' },
  { value: 'light', label: 'theme.light', icon: 'sun-2' },
  { value: 'system', label: 'theme.system', icon: 'monitor' },
]
const LOCALES: { value: Locale; label: MessageKey }[] = [
  { value: 'auto', label: 'locale.auto' },
  { value: 'fr', label: 'locale.fr' },
  { value: 'en', label: 'locale.en' },
]

/** Theme (Sombre / Clair / Système) and language: applied at once, saved on the account. */
const LAYOUTS: { value: MobileLayout; label: MessageKey }[] = [
  { value: 'list', label: 'layout.list' },
  { value: 'grid', label: 'layout.grid' },
]

function AppearanceSection() {
  const t = useT()
  const { theme, setTheme } = useTheme()
  const { preference, setPreference } = useLocalePreference()
  const [layout, setLayout] = useMobileLayout()
  const [hidden, setHidden] = useHiddenTypes()
  const [zoomLock, setZoomLock] = useZoomLock()
  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('settings.appearance')}</h2>
      <p id="theme-label" className="mt-3 text-sm font-medium">
        {t('theme.label')}
      </p>
      <div role="group" aria-labelledby="theme-label" className="seg full mt-2">
        {THEMES.map((o) => (
          <button key={o.value} type="button" aria-pressed={theme === o.value} onClick={() => setTheme(o.value)}>
            <Icon name={o.icon} small />
            {t(o.label)}
          </button>
        ))}
      </div>
      <p id="locale-label" className="mt-3 text-sm font-medium">
        {t('locale.label')}
      </p>
      <div role="group" aria-labelledby="locale-label" className="seg full mt-2">
        {LOCALES.map((o) => (
          <button key={o.value} type="button" aria-pressed={preference === o.value} onClick={() => setPreference(o.value)}>
            {t(o.label)}
          </button>
        ))}
      </div>
      <h3 className="h-label mt-5">{t('settings.preferences')}</h3>
      <p id="layout-label" className="mt-2 text-sm font-medium">
        {t('layout.label')}
      </p>
      <div role="group" aria-labelledby="layout-label" className="seg full mt-2">
        {LAYOUTS.map((o) => (
          <button key={o.value} type="button" aria-pressed={layout === o.value} onClick={() => setLayout(o.value)}>
            {t(o.label)}
          </button>
        ))}
      </div>
      <p id="types-label" className="mt-4 text-sm font-medium">
        {t('types.label')}
      </p>
      <p className="text-xs text-muted-foreground">{t('types.help')}</p>
      <ul aria-labelledby="types-label" className="mt-1 divide-y divide-border">
        {RESOURCE_TYPES.map((type) => {
          const on = !hidden.includes(type)
          // At least one type has to stay on, or there would be nothing left to add.
          const last = on && hidden.length >= RESOURCE_TYPES.length - 1
          return (
            <li key={type} className="flex items-center justify-between gap-3 py-2.5">
              <span id={`type-${type}`} className="flex items-center gap-2 text-sm">
                <Icon name={TYPE_ICON[type]} small />
                {t(`type.${type}`)}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`type-${type}`}
                disabled={last}
                className="disabled:opacity-50"
                onClick={() => setHidden(on ? [...hidden, type] : hidden.filter((h) => h !== type))}
              >
                <span className={on ? 'switch on' : 'switch'} />
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p id="zoom-label" className="text-sm font-medium">
            {t('zoom.label')}
          </p>
          <p className="text-xs text-muted-foreground">{t('zoom.help')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={zoomLock}
          aria-labelledby="zoom-label"
          onClick={() => setZoomLock(!zoomLock)}
        >
          <span className={zoomLock ? 'switch on' : 'switch'} />
        </button>
      </div>
    </section>
  )
}

function TimezoneSection({ timezone }: { timezone: string }) {
  const t = useT()
  const update = useUpdateMe()
  const browserTz = browserTimeZone()
  const options = useMemo(() => timeZoneOptions(timezone), [timezone])

  const change = (tz: string) => {
    if (tz === timezone) return
    update.mutate({ timezone: tz }, { onSuccess: () => toast.success(t('settings.timezone.updated')) })
  }

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('settings.timezone')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.timezone.hint')}</p>
      <Label htmlFor="timezone" className="mt-3">
        {t('settings.timezone.current')}
      </Label>
      <select
        id="timezone"
        value={timezone}
        disabled={update.isPending}
        onChange={(e) => change(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-[10px] border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
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
          className="mt-3 h-10 w-full rounded-[10px]"
          disabled={update.isPending}
          onClick={() => change(browserTz)}
        >
          {t('settings.timezone.use_browser', { tz: browserTz })}
        </Button>
      )}
    </section>
  )
}

const makePasswordSchema = (t: TFunction) =>
  z.object({
    current_password: z.string().min(1, t('settings.password.current_required')),
    new_password: z.string().min(8, t('auth.validation.password_min')),
  })
type PasswordValues = z.infer<ReturnType<typeof makePasswordSchema>>

function PasswordSection() {
  const t = useT()
  const passwordSchema = useMemo(() => makePasswordSchema(t), [t])
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
        toast.success(t('settings.password.changed'))
      },
    })

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('auth.password')}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-3 space-y-3" noValidate>
        <Field
          id="current_password"
          label={t('settings.password.current')}
          type="password"
          autoComplete="current-password"
          error={errors.current_password?.message}
          {...register('current_password')}
        />
        <Field
          id="new_password"
          label={t('auth.reset.new_password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.password.hint')}
          error={errors.new_password?.message}
          {...register('new_password')}
        />
        {change.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(change.error, t('settings.password.failed'))}
          </p>
        )}
        <Button type="submit" className="h-10 w-full rounded-[10px]" disabled={change.isPending}>
          {t('settings.password.submit')}
        </Button>
      </form>
    </section>
  )
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT()
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
      title={t('settings.delete.title')}
      description={t('settings.delete.body')}
      confirmLabel={t('settings.delete.confirm')}
      pending={del.isPending}
      error={del.error ? errorMessage(del.error, t('settings.delete.failed')) : null}
      onConfirm={() => {
        if (!password) return
        del.mutate(password, { onSuccess: () => navigate('/login', { replace: true }) })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="delete-password">{t('settings.delete.password')}</Label>
        <Input
          id="delete-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-10 rounded-[10px] text-base md:text-sm"
        />
      </div>
    </ConfirmDialog>
  )
}

/** Every device signed in to the account: this one first, the others can be signed out. */
function DeviceList() {
  const t = useT()
  const { data: devices, isError } = useSessions()
  const revoke = useRevokeSession()
  if (isError) return <p className="mt-2 text-sm text-muted-foreground">{t('settings.devices.error')}</p>
  if (!devices) return null
  const sorted = [...devices].sort((a, b) => Number(b.current) - Number(a.current))
  return (
    <ul className="mt-3 divide-y divide-border" aria-label={t('settings.devices')}>
      {sorted.map((d) => (
        <li key={d.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="truncate">{d.device}</span>
              {d.current && <span className="badge">{t('settings.devices.current')}</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t('settings.devices.last_seen', { when: formatAgo(d.last_seen_at) })}
              {d.ip && ` · ${d.ip}`}
            </p>
          </div>
          {!d.current && (
            <Button
              variant="outline"
              size="sm"
              disabled={revoke.isPending}
              aria-label={t('settings.devices.revoke_label', { device: d.device })}
              onClick={() => revoke.mutate(d.id)}
            >
              {t('settings.devices.revoke')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function SessionSection() {
  const t = useT()
  const logout = useLogout()
  const logoutAll = useLogoutAll()
  const navigate = useNavigate()
  const [confirmAll, setConfirmAll] = useState(false)

  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('settings.sessions')}</h2>
      <p className="mt-2 text-sm font-medium">{t('settings.devices')}</p>
      <DeviceList />
      <div className="mt-3 space-y-2">
        <Button
          variant="outline"
          className="h-10 w-full rounded-[10px]"
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
        >
          {t('settings.logout')}
        </Button>
        <Button variant="outline" className="h-10 w-full rounded-[10px]" onClick={() => setConfirmAll(true)}>
          {t('settings.logout_all')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t('settings.logout_all')}
        description={t('settings.logout_all.body')}
        confirmLabel={t('settings.logout_all')}
        destructive={false}
        pending={logoutAll.isPending}
        error={logoutAll.error ? errorMessage(logoutAll.error) : null}
        onConfirm={() => logoutAll.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
      />
    </section>
  )
}

const BUILD_NUMBER: string = import.meta.env.VITE_BUILD_NUMBER || 'dev'

/** Unregisters the service worker and empties its caches, then reloads on the latest build. */
async function resetAppCache() {
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((registrations ?? []).map((r) => r.unregister()))
    await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  } finally {
    window.location.reload()
  }
}

function AboutSection() {
  const t = useT()
  const [pending, setPending] = useState(false)
  return (
    <section className={sectionClass}>
      <h2 className={headingClass}>{t('settings.about')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.about.build', { build: BUILD_NUMBER })}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.about.reset.hint')}</p>
      <Button
        variant="outline"
        className="mt-3 h-10 w-full rounded-[10px]"
        disabled={pending}
        onClick={() => {
          setPending(true)
          void resetAppCache()
        }}
      >
        {t('settings.about.reset')}
      </Button>
    </section>
  )
}

function DangerZone() {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <section className="panel">
      <h2 className="h-label" style={{ color: 'var(--over)' }}>{t('settings.danger')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.danger.body')}</p>
      <Button variant="destructive" className="mt-3 h-10 w-full rounded-[10px]" onClick={() => setOpen(true)}>
        {t('settings.delete.title')}
      </Button>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </section>
  )
}

export function SettingsPage() {
  const t = useT()
  const { data: me } = useMe()
  return (
    <div className="lib form-page mx-auto max-w-xl">
      {me && <ProfileSection key={`${me.first_name}|${me.last_name}`} me={me} />}
      <AppearanceSection />
      {me && <TimezoneSection timezone={me.timezone} />}
      <PasswordSection />
      <SessionSection />
      <AboutSection />
      {me?.role === 'admin' && (
        <Link
          to="/admin"
          className="panel flex items-center gap-3 text-sm font-medium md:hidden"
        >
          <Icon name="shield-check" className="size-5" />
          {t('nav.admin')}
        </Link>
      )}
      <DangerZone />
    </div>
  )
}
