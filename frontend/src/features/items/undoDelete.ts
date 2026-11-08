import { toast } from 'sonner'
import { t } from '@/lib/i18n'

const UNDO_MS = 5000

/** Deletions waiting for their toast to end, each with the function that sends it now. */
const waiting = new Map<string, (dismiss?: boolean) => void>()

/** The page is going away or hidden (timers stop in the background): send everything right now. */
function sendAll() {
  for (const send of [...waiting.values()]) send(true)
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendAll()
})
addEventListener('pagehide', sendAll)

/**
 * Delete without confirmation: shows a toast with Undo. `send` runs once, when the toast ends or
 * is dismissed (or at once if the page is hidden); `undo` runs instead if the user undoes.
 * So Undo never needs a server-side restore.
 */
export function deferDelete(id: string, message: string, send: () => void, undo: () => void) {
  const fire = (dismiss = false) => {
    if (!waiting.delete(id)) return
    if (dismiss) toast.dismiss(toastId)
    send()
  }
  const toastId = toast(message, {
    duration: UNDO_MS,
    onAutoClose: () => fire(),
    onDismiss: () => fire(),
    action: {
      label: t('common.undo'),
      onClick: () => {
        waiting.delete(id)
        undo()
      },
    },
  })
  waiting.set(id, fire)
}
