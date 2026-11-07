import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError, setUnauthorizedHandler } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useMe } from '@/features/auth/useAuth'
import { useTimezoneSync } from '@/features/auth/useTimezoneSync'
import { ItemDialogsProvider } from '@/features/items/ItemDialogsProvider'

const ResponsiveShell = lazy(() =>
  import('@/components/layout/ResponsiveShell').then((m) => ({ default: m.ResponsiveShell })),
)
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('@/features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const LibraryPage = lazy(() =>
  import('@/features/items/LibraryPage').then((m) => ({ default: m.LibraryPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

const AdminPage = lazy(() =>
  import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)

const QueuePage = lazy(() =>
  import('@/features/queue/QueuePage').then((m) => ({ default: m.QueuePage })),
)

const StatsPage = lazy(() =>
  import('@/features/stats/StatsPage').then((m) => ({ default: m.StatsPage })),
)

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
  mutationCache: new MutationCache({
    // Mutations opt in with `meta: { errorMessage }`; the others handle their errors themselves.
    onError: (error, _vars, _ctx, mutation) => {
      const msg = mutation.meta?.errorMessage
      if (typeof msg === 'string' && !(error instanceof ApiError && error.status === 401))
        toast.error(errorMessage(error, msg))
    },
  }),
})

function FullScreenLoader() {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className="flex min-h-dvh items-center justify-center"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  )
}

/** Shell routes: wait for /auth/me, send logged-out users to /login. */
function RequireAuth() {
  const { data: me, isPending } = useMe()
  useTimezoneSync(me)
  if (isPending) return <FullScreenLoader />
  if (!me) return <Navigate to="/login" replace />
  return (
    <ItemDialogsProvider>
      <Outlet />
    </ItemDialogsProvider>
  )
}

/** /login and /register: already logged in -> back to the library. */
function PublicOnly() {
  const { data: me, isPending } = useMe()
  if (isPending) return <FullScreenLoader />
  if (me) return <Navigate to="/" replace />
  return <Outlet />
}

/** Admin-only routes: anyone else goes back to the library. */
function RequireAdmin() {
  const { data: me } = useMe()
  if (me?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}

/** 401 from the API -> drop caches and go to the login page. */
function UnauthorizedRedirect() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.clear()
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate, qc])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <UnauthorizedRedirect />
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
              </Route>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route element={<RequireAuth />}>
                <Route element={<ResponsiveShell />}>
                  <Route index element={<LibraryPage />} />
                  <Route path="queue" element={<QueuePage />} />
                  <Route path="shared" element={<LibraryPage sharedOnly />} />
                  <Route path="stats" element={<StatsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route element={<RequireAdmin />}>
                    <Route path="admin" element={<AdminPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
