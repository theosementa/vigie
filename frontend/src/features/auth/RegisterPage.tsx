import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { browserTimeZone } from '@/lib/timezone'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useRegister } from './useAuth'

const schema = z.object({
  display_name: z.string().trim().min(1, 'Nom requis').max(60, '60 caractères maximum'),
  email: z.string().min(1, 'Email requis').email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
})
type Values = z.infer<typeof schema>

export function RegisterPage() {
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
      title="Créer un compte"
      subtitle="Gardez vos articles et vidéos à portée de main."
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to="/login" className="font-medium text-primary">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field
          id="display_name"
          label="Nom affiché"
          autoComplete="name"
          error={errors.display_name?.message}
          {...register('display_name')}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          id="password"
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {err instanceof ApiError && err.status === 409
              ? 'Un compte existe déjà avec cet email.'
              : 'Inscription impossible. Réessayez.'}
          </p>
        )}
        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-base"
          disabled={registerUser.isPending}
        >
          {registerUser.isPending ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>
    </AuthCard>
  )
}
