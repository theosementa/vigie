import { useEffect, useState, type ReactNode, type TouchEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { markOnboardingSeen } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

const STEPS = ['intro', 'capture', 'pile', 'final'] as const
type Step = (typeof STEPS)[number]
const LAST = STEPS.length - 1
/** A horizontal drag shorter than this (px) is a tap or a scroll, not a swipe. */
const SWIPE_MIN = 48

/** The illustration area: same height on every step so the text below never moves. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-56 w-full max-w-sm items-center justify-center rounded-3xl bg-surface-2 px-6">
      {children}
    </div>
  )
}

function Line({ className }: { className?: string }) {
  return <span className={cn('block h-2 rounded-full bg-line', className)} />
}

function AppIcon({ size }: { size: number }) {
  return (
    <img
      src="/app-icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="rounded-[22.37%] ring-1 ring-line"
    />
  )
}

function IntroVisual() {
  return (
    <Stage>
      <AppIcon size={128} />
    </Stage>
  )
}

function CaptureVisual() {
  const t = useT()
  return (
    <Stage>
      <div className="w-full space-y-2">
        <div className="flex h-11 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-line">
          <Icon name="link-minimalistic-2" small className="text-muted-foreground" />
          <Line className="w-32" />
        </div>
        <Icon name="arrow-down" small className="mx-auto text-muted-foreground" />
        <div className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <div className="grid size-14 flex-none place-items-center rounded-xl bg-surface-2 text-muted-foreground">
            <Icon name="play" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <Line className="w-full" />
            <Line className="w-2/3" />
            <span className="inline-flex rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-on-accent">
              {t('item.status.to_watch')}
            </span>
          </div>
        </div>
      </div>
    </Stage>
  )
}

function PileVisual() {
  const rows = [true, true, false]
  return (
    <Stage>
      <ul className="w-full space-y-2">
        {rows.map((seen, i) => (
          <li
            key={i}
            className="flex h-12 items-center gap-3 rounded-xl bg-surface px-3 ring-1 ring-line"
          >
            <span
              className={cn(
                'grid size-6 flex-none place-items-center rounded-full',
                seen ? 'bg-accent text-on-accent' : 'ring-1 ring-line',
              )}
            >
              {seen && <Icon name="check" className="size-4" />}
            </span>
            <div className={cn('flex-1 space-y-1.5', seen && 'opacity-50')}>
              <Line className="w-full" />
              <Line className="w-1/2" />
            </div>
          </li>
        ))}
      </ul>
    </Stage>
  )
}

function FinalVisual() {
  return (
    <Stage>
      <AppIcon size={96} />
    </Stage>
  )
}

const VISUALS: Record<Step, () => ReactNode> = {
  intro: IntroVisual,
  capture: CaptureVisual,
  pile: PileVisual,
  final: FinalVisual,
}

/** First visit: what Vigie is in three screens, then sign up or sign in. */
export function OnboardingPage() {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [touchX, setTouchX] = useState<number | null>(null)
  const isLast = index === LAST

  const go = (next: number) => setIndex(Math.min(LAST, Math.max(0, next)))

  // Having seen the end is enough: a reload goes straight to the login page from now on.
  useEffect(() => {
    if (isLast) markOnboardingSeen()
  }, [isLast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(LAST, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onTouchStart = (e: TouchEvent) => setTouchX(e.touches[0].clientX)
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX === null) return
    const delta = e.changedTouches[0].clientX - touchX
    setTouchX(null)
    if (Math.abs(delta) >= SWIPE_MIN) go(index + (delta < 0 ? 1 : -1))
  }

  return (
    // Phone: the page itself. Desktop: the same screens in a centred modal-style card.
    <div className="pt-safe pb-safe flex min-h-dvh items-center justify-center bg-bg md:p-8">
    <div
      role="region"
      aria-label={t('onboarding.label')}
      className="flex min-h-dvh w-full flex-col md:h-[680px] md:min-h-0 md:max-w-xl md:overflow-hidden md:rounded-3xl md:bg-surface md:ring-1 md:ring-line"
    >
      <header className="flex h-14 items-center justify-end px-4">
        <Button
          variant="ghost"
          size="lg"
          className={cn('text-muted-foreground', isLast && 'invisible')}
          tabIndex={isLast ? -1 : 0}
          onClick={() => go(LAST)}
        >
          {t('onboarding.skip')}
        </Button>
      </header>

      <main
        className="flex flex-1 items-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex w-full items-stretch"
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: 'transform var(--dur-slow) var(--ease)',
          }}
        >
          {STEPS.map((step, i) => {
            const Visual = VISUALS[step]
            return (
              <section
                key={step}
                aria-hidden={i !== index}
                inert={i !== index}
                aria-label={t('onboarding.step', { current: i + 1, total: STEPS.length })}
                className="flex w-full flex-none flex-col items-center gap-6 px-6 py-4 text-center"
              >
                <Visual />
                <div className="max-w-sm space-y-3">
                  <h1 className="text-2xl font-medium tracking-tight">
                    {t(`onboarding.${step}.title`)}
                  </h1>
                  <p className="text-base text-muted-foreground">{t(`onboarding.${step}.body`)}</p>
                </div>
                {step === 'final' && (
                  <div className="w-full max-w-sm space-y-3">
                    <Link
                      to="/register"
                      className={cn(buttonVariants(), 'h-11 w-full rounded-xl text-base')}
                    >
                      {t('auth.register.submit')}
                    </Link>
                    <Link
                      to="/login"
                      className={cn(
                        buttonVariants({ variant: 'secondary' }),
                        'h-11 w-full rounded-xl text-base',
                      )}
                    >
                      {t('auth.login.submit')}
                    </Link>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </main>

      <footer className="flex flex-col items-center gap-4 px-4 pt-2 pb-6">
        <div className="flex items-center gap-1" role="group" aria-label={t('onboarding.step', { current: index + 1, total: STEPS.length })}>
          {STEPS.map((step, i) => (
            <button
              key={step}
              type="button"
              aria-label={t('onboarding.go_to_step', { n: i + 1 })}
              aria-current={i === index ? 'step' : undefined}
              onClick={() => go(i)}
              className="grid h-6 place-items-center px-1"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all',
                  i === index ? 'w-6 bg-accent-ink' : 'w-2 bg-line',
                )}
                style={{ transitionDuration: 'var(--dur-base)', transitionTimingFunction: 'var(--ease)' }}
              />
            </button>
          ))}
        </div>
        <div className="flex h-11 w-full max-w-sm items-center justify-between gap-3">
          <Button
            variant="ghost"
            className={cn('h-11 rounded-xl px-4 text-base', index === 0 && 'invisible')}
            tabIndex={index === 0 ? -1 : 0}
            onClick={() => go(index - 1)}
          >
            {t('onboarding.back')}
          </Button>
          <Button
            className={cn('h-11 rounded-xl px-6 text-base', isLast && 'invisible')}
            tabIndex={isLast ? -1 : 0}
            onClick={() => go(index + 1)}
          >
            {t('onboarding.next')}
          </Button>
        </div>
      </footer>
    </div>
    </div>
  )
}
