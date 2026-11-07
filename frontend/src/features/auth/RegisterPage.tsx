import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/errors'
import { browserTimeZone } from '@/lib/timezone'
import { AuthCard } from './AuthCard'
import { Field } from './Field'
import { useRegister } from './useAuth'

const schema = z.object({
  first_name: z.string().trim().min(1, 'Prénom requis').max(50, '50 caractères maximum'),
  last_name: z.string().trim().min(1, 'Nom requis').max(50, '50 caractères maximum'),
  email: z.string().min(1, 'E‑mail requis').email('E‑mail invalide'),
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
      subtitle="Garde tes articles et vidéos à portée de main."
      footer={
        <>
          Déjà inscrit{' '}?{' '}
          <Link to="/login" className="font-medium text-primary">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="first_name"
              label="Prénom"
              autoComplete="given-name"
              error={errors.first_name?.message}
              {...register('first_name')}
            />
            <Field
              id="last_name"
              label="Nom"
              autoComplete="family-name"
              error={errors.last_name?.message}
              {...register('last_name')}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Ton nom s’affiche quand tu envoies un lien à quelqu’un, pour qu’il sache de qui il vient.
            Il n’est visible par personne d’autre.
          </p>
        </div>
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
          autoComplete="new-password"
          hint="8 caractères minimum."
          error={errors.password?.message}
          {...register('password')}
        />
        {err && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(err, 'Inscription impossible. Réessaie.')}
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
