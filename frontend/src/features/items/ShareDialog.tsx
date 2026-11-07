import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import type { Item, ShareResult } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useShareItem } from './queries'

const emailSchema = z.string().email()
const formSchema = z.object({
  emails: z.array(emailSchema).min(1, 'Ajoutez au moins une adresse email.').max(20),
  message: z.string().max(500, '500 caractères maximum.'),
})

function splitEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

function ShareForm({ item, onClose }: { item: Item; onClose: () => void }) {
  const share = useShareItem()
  const [emails, setEmails] = useState<string[]>([])
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShareResult | null>(null)

  /** Validate and add the pending text; returns the new list (or null when invalid). */
  const commit = (raw: string): string[] | null => {
    const parts = splitEmails(raw)
    if (parts.length === 0) return emails
    const invalid = parts.find((p) => !emailSchema.safeParse(p).success)
    if (invalid) {
      setError(`« ${invalid} » n’est pas une adresse email valide.`)
      return null
    }
    const next = [...emails]
    for (const p of parts) if (!next.includes(p)) next.push(p)
    setEmails(next)
    setText('')
    setError(null)
    return next
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      if (text.trim() || e.key === ',') e.preventDefault()
      if (text.trim()) commit(text)
    } else if (e.key === 'Backspace' && !text && emails.length) {
      setEmails(emails.slice(0, -1))
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const list = text.trim() ? commit(text) : emails
    if (list === null) return
    const parsed = formSchema.safeParse({ emails: list, message })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(null)
    share.mutate(
      {
        id: item.id,
        input: { emails: parsed.data.emails, message: parsed.data.message.trim() || null },
      },
      {
        onSuccess: (res) => {
          setResult(res)
          if (res.shared.length) toast.success(`Partagé avec ${res.shared.join(', ')}`)
          else toast('Personne n’a reçu ce lien.')
        },
        onError: (err) =>
          setError(errorMessage(err, 'Partage impossible. Réessaie.')),
      },
    )
  }

  if (result) {
    return (
      <div className="space-y-3 text-sm">
        {result.shared.length > 0 && (
          <p className="text-emerald-700 dark:text-emerald-400">
            Partagé avec : {result.shared.join(', ')}
          </p>
        )}
        {result.already_had.length > 0 && (
          <p className="text-muted-foreground">
            L’avait déjà dans sa bibliothèque : {result.already_had.join(', ')}
          </p>
        )}
        {result.not_found.length > 0 && (
          <p className="text-destructive">
            Aucun compte trouvé pour : {result.not_found.join(', ')}
          </p>
        )}
        <Button className="h-10 w-full rounded-xl" onClick={onClose}>
          Terminé
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="share-emails">Destinataires</Label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          {emails.map((em) => (
            <span
              key={em}
              className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-xs font-medium"
            >
              {em}
              <button
                type="button"
                aria-label={`Retirer ${em}`}
                onClick={() => setEmails(emails.filter((x) => x !== em))}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id="share-emails"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => text.trim() && commit(text)}
            placeholder={emails.length ? '' : 'ami@exemple.com'}
            className="min-w-40 flex-1 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground">Entrée ou virgule pour ajouter plusieurs adresses.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="share-message">Message (facultatif)</Label>
        <Textarea
          id="share-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder="Un petit mot pour accompagner le lien"
          className="rounded-xl"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full rounded-xl" disabled={share.isPending}>
        {share.isPending ? 'Envoi…' : 'Partager'}
      </Button>
    </form>
  )
}

export function ShareDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager</DialogTitle>
          <DialogDescription className="line-clamp-2">{item?.resource.title}</DialogDescription>
        </DialogHeader>
        {/* keyed so the form state resets for each item / each opening */}
        {item && <ShareForm key={item.id} item={item} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
