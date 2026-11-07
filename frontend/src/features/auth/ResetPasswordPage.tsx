import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage, messageForCode } from '@/lib/errors'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useResetPassword } from './useAuth'

const schema = z
  .object({
    password: z.string().min(8, '8 caractères minimum'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Les deux mots de passe ne correspondent pas',
  })
type Values = z.infer<typeof schema>

export function ResetPasswordPage() {
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
            state: { notice: 'Mot de passe modifié. Tu peux te connecter.' },
          }),
      },
    )

  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle="Choisis un nouveau mot de passe pour ton compte."
      footer={
        <Link to="/login" className="font-medium text-primary">
          Retour à la connexion
        </Link>
      }
    >
      {token ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Field
            id="password"
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            hint="8 caractères minimum."
            error={errors.password?.message}
            {...register('password')}
          />
          <Field
            id="confirm"
            label="Confirmation"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...register('confirm')}
          />
          {reset.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(reset.error, 'Réinitialisation impossible. Réessaie.')}
            </p>
          )}
          <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={reset.isPending}>
            {reset.isPending ? 'Enregistrement…' : 'Changer mon mot de passe'}
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
