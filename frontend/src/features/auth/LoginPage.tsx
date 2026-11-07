import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useLogin } from './useAuth'

const schema = z.object({
  email: z.string().min(1, 'Email requis').email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
  const navigate = useNavigate()
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
      title="Radar"
      subtitle="Connectez-vous pour retrouver votre veille."
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-medium text-primary">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        {login.error && (
          <p role="alert" className="text-sm text-destructive">
            {login.error instanceof ApiError && login.error.status === 401
              ? 'Email ou mot de passe incorrect.'
              : 'Connexion impossible. Réessayez.'}
          </p>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </AuthCard>
  )
}
