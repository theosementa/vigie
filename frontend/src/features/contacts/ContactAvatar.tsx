import type { Contact } from '@/lib/api'
import { contactLabel } from './queries'

/** Initial of the contact's name (or address) on the DA's round avatar. */
export function ContactAvatar({ contact }: { contact: Pick<Contact, 'name' | 'email'> }) {
  return (
    <span className="av" aria-hidden="true">
      {contactLabel(contact).charAt(0).toUpperCase()}
    </span>
  )
}
