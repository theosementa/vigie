import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { useT, type TFunction } from '@/lib/i18n'
import { browserTimeZone } from '@/lib/timezone'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useRegister } from './useAuth'

const makeSchema = (t: TFunction) =>
  z.object({
    first_name: z.string().trim().min(1, t('auth.validation.first_name_required')).max(50, t('auth.validation.max_50')),
    last_name: z.string().trim().min(1, t('auth.validation.last_name_required')).max(50, t('auth.validation.max_50')),
    email: z.string().min(1, t('auth.validation.email_required')).email(t('auth.validation.email_invalid')),
    password: z.string().min(8, t('auth.validation.password_min')),
  })
type Values = z.infer<ReturnType<typeof makeSchema>>

export function RegisterPage() {
  const t = useT()
  const schema = useMemo(() => makeSchema(t), [t])
  const navigate = useNavigate()
  const registerUser = useRegister()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = (values: Values) =>
    registerUser.mutate(
      { ...values, timezone: browserTimeZone() },
      { onSuccess: () => navigate('/', { replace: true }) },
    )

  const err = registerUser.error
  return (
    <AuthCard
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <>
          {t('auth.register.footer')}{' '}
          <Link to="/login" className="font-medium text-accent-ink">
            {t('auth.register.login_link')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            {t('auth.name_note')}
          </p>
        </div>
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
          autoComplete="new-password"
          hint={t('auth.password.hint')}
          error={errors.password?.message}
          {...register('password')}
        />
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(err, t('auth.register.failed'))}
          </p>
        )}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-base"
          disabled={registerUser.isPending}
        >
          {registerUser.isPending ? t('auth.register.pending') : t('auth.register.submit')}
        </Button>
      </form>
    </AuthCard>
  )
}
