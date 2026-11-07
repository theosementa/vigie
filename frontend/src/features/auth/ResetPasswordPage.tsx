import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage, messageForCode } from '@/lib/errors'
import { useT, type TFunction } from '@/lib/i18n'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useResetPassword } from './useAuth'

const makeSchema = (t: TFunction) =>
  z
    .object({
      password: z.string().min(8, t('auth.validation.password_min')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: t('auth.validation.password_mismatch'),
    })
type Values = z.infer<ReturnType<typeof makeSchema>>

export function ResetPasswordPage() {
  const t = useT()
  const schema = useMemo(() => makeSchema(t), [t])
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const reset = useResetPassword()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = (values: Values) =>
    reset.mutate(
      { token, password: values.password },
      {
        onSuccess: () =>
          navigate('/login', {
            replace: true,
            state: { notice: t('auth.reset.done') },
          }),
      },
    )

  return (
    <AuthCard
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={
        <Link to="/login" className="font-medium text-accent-ink">
          {t('auth.reset.back')}
        </Link>
      }
    >
      {token ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="password"
            label={t('auth.reset.new_password')}
            type="password"
            autoComplete="new-password"
            hint={t('auth.password.hint')}
            error={errors.password?.message}
            {...register('password')}
          />
          <Field
            id="confirm"
            label={t('auth.reset.confirm')}
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          {reset.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(reset.error, t('auth.reset.failed'))}
            </p>
          )}
          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={reset.isPending}>
            {reset.isPending ? t('auth.reset.pending') : t('auth.reset.submit')}
          </Button>
        </form>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {messageForCode('invalid_reset_token')}
        </p>
      )}
    </AuthCard>
  )
}
