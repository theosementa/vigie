import { useGoals } from '@/features/stats/goals'
import { useStatsSummary } from '@/features/stats/queries'

/** Weekly figures shared by the phone scope and the desktop strip. */
export function useWeek() {
  const { data: summary, isError } = useStatsSummary('week', 0)
  const { goals } = useGoals('week')
  if (!summary) return { week: null, isError }
  const seen = summary.current.articles_read + summary.current.videos_seen
  const prevSeen = summary.previous.articles_read + summary.previous.videos_seen
  return {
    isError,
    week: {
      seen,
      prevSeen,
      goalSeen: goals.items,
      watchMinutes: Math.round(summary.current.watch_seconds / 60),
      goalMinutes: goals.minutes,
      videosSeen: summary.current.videos_seen,
      videosWithoutDuration: summary.videos_without_duration,
      streak: summary.streak.current,
      best: summary.streak.best,
    },
  }
}
