import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useLogin } from './useAuth'

const schema = z.object({
  email: z.string().min(1, 'E‑mail requis').email('E‑mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})
type Values = z.infer<typeof schema>

export function LoginPage() {
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
      title="Vigie"
      subtitle="Connecte-toi pour retrouver ta veille."
      footer={
        <>
          Pas encore de compte{' '}?{' '}
          <Link to="/register" className="font-medium text-primary">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {notice && (
          <p role="status" className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
            {notice}
          </p>
        )}
        <Field
          id="email"
          label="E‑mail"
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
            {errorMessage(login.error, 'Connexion impossible. Réessaie.')}
          </p>
        )}
        <Button type="submit" className="h-11 w-full rounded-xl text-base" disabled={login.isPending}>
          {login.isPending ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>
    </AuthCard>
  )
}
