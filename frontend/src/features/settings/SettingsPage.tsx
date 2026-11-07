import { useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useLogout, useMe, useUpdateMe } from '@/features/auth/useAuth'
import { browserTimeZone, timeZoneOptions } from '@/lib/timezone'
import { useNavigate } from 'react-router-dom'

function TimezoneSection({ timezone }: { timezone: string }) {
  const update = useUpdateMe()
  const browserTz = browserTimeZone()
  const options = useMemo(() => timeZoneOptions(timezone), [timezone])

  const change = (tz: string) => {
    if (tz === timezone) return
    update.mutate({ timezone: tz }, { onSuccess: () => toast.success('Fuseau horaire mis à jour.') })
  }

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Fuseau horaire
      </h2>
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

export function SettingsPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-xl space-y-4 p-0 md:p-6">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Compte</h2>
        <p className="mt-2 text-sm">
          {me && `${me.display_name} · ${me.email}`}
        </p>
      </section>
      {me && <TimezoneSection timezone={me.timezone} />}
      <Button
        variant="destructive"
        className="h-11 w-full rounded-xl"
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/login') })}
      >
        Se déconnecter
      </Button>
    </div>
  )
}
