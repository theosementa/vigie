import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { errorMessage } from '@/lib/errors'
import { formatAgo } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { type ApiToken, type CreatedApiToken } from '@/lib/api'
import { useCreateToken, useRevokeToken, useTokens } from './tokens'

/** The secret of a token just created: shown once, with the address to paste next to it. */
function NewToken({ created }: { created: CreatedApiToken }) {
  const t = useT()
  const copy = () =>
    navigator.clipboard
      ?.writeText(created.token)
      .then(() => toast.success(t('settings.extension.copied')))
      .catch(() => undefined)
  return (
    <div className="mt-3 rounded-[10px] border border-border p-3" role="status">
      <p className="text-sm font-medium">{t('settings.extension.created')}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all text-xs">{created.token}</code>
        <Button variant="outline" size="sm" onClick={copy}>
          {t('settings.extension.copy')}
        </Button>
      </div>
      <p className="mt-2 break-all text-xs text-muted-foreground">
        {t('settings.extension.url', { url: window.location.origin })}
      </p>
    </div>
  )
}

function TokenList() {
  const t = useT()
  const { data: tokens, isError } = useTokens()
  const revoke = useRevokeToken()
  const [target, setTarget] = useState<ApiToken | null>(null)
  if (isError) return <p className="mt-2 text-sm text-muted-foreground">{t('settings.extension.error')}</p>
  if (!tokens || tokens.length === 0) return null
  return (
    <>
      <ul className="mt-3 divide-y divide-border" aria-label={t('settings.extension')}>
        {tokens.map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{k.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {k.prefix}… ·{' '}
                {k.last_used_at
                  ? t('settings.extension.last_used', { when: formatAgo(k.last_used_at) })
                  : t('settings.extension.never_used')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('settings.extension.revoke_label', { name: k.name })}
              onClick={() => setTarget(k)}
            >
              {t('settings.extension.revoke')}
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t('settings.extension.revoke_title')}
        description={t('settings.extension.revoke_body')}
        confirmLabel={t('settings.extension.revoke')}
        pending={revoke.isPending}
        error={revoke.error ? errorMessage(revoke.error) : null}
        onConfirm={() => target && revoke.mutate(target.id, { onSuccess: () => setTarget(null) })}
      />
    </>
  )
}

export function ExtensionSection() {
  const t = useT()
  const create = useCreateToken()
  const [name, setName] = useState('')
  const [created, setCreated] = useState<CreatedApiToken | null>(null)
  const [touched, setTouched] = useState(false)
  const empty = name.trim() === ''

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (empty) return
    create.mutate(name.trim(), {
      onSuccess: (token) => {
        setCreated(token)
        setName('')
        setTouched(false)
      },
    })
  }

  return (
    <section className="panel">
      <h2 className="h-label">{t('settings.extension')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('settings.extension.hint')}</p>
      <form className="mt-3 space-y-2" onSubmit={submit} noValidate>
        <Label htmlFor="token-name">{t('settings.extension.name')}</Label>
        <Input
          id="token-name"
          value={name}
          maxLength={60}
          placeholder={t('settings.extension.name_placeholder')}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={touched && empty}
          className="h-10 rounded-[10px] text-base md:text-sm"
        />
        {touched && empty && <p className="text-sm text-destructive">{t('settings.extension.name_required')}</p>}
        {create.error && (
          <p className="text-sm text-destructive">{errorMessage(create.error, t('settings.extension.create_failed'))}</p>
        )}
        <Button type="submit" variant="outline" className="h-10 w-full rounded-[10px]" disabled={create.isPending}>
          {t('settings.extension.create')}
        </Button>
      </form>
      {created && <NewToken created={created} />}
      <TokenList />
    </section>
  )
}
