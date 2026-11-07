import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { useT, type TFunction } from '@/lib/i18n'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useLogin } from './useAuth'

const makeSchema = (t: TFunction) =>
  z.object({
    email: z.string().min(1, t('auth.validation.email_required')).email(t('auth.validation.email_invalid')),
    password: z.string().min(1, t('auth.validation.password_required')),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>

export function LoginPage() {
  const t = useT()
  const schema = useMemo(() => makeSchema(t), [t])
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = (values: Values) =>
    login.mutate(values, { onSuccess: () => navigate('/', { replace: true }) })

  return (
    <AuthCard
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.footer')}{' '}
          <Link to="/register" className="font-medium text-accent-ink">
            {t('auth.login.register_link')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {notice && (
          <p role="status" className="rounded-xl bg-surface-2 p-3 text-sm">
            {notice}
          </p>
        )}
        <Field
          id="email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="password"
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {login.error && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(login.error, t('auth.login.failed'))}
          </p>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={login.isPending}>
          {login.isPending ? t('auth.login.pending') : t('auth.login.submit')}
        </Button>
      </form>
    </AuthCard>
  )
}
