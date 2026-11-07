import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { useT } from '@/lib/i18n'
import { useAddItem } from './addItemContext'
import { looksLikeUrl } from './url'

/** Desktop header capture: paste or type a link, Enter or « Ajouter » opens the capture with it. */
export function CaptureBar() {
  const t = useT()
  const { open } = useAddItem()
  const [value, setValue] = useState('')
  const go = (url?: string) => {
    open(url?.trim() || undefined)
    setValue('')
  }
  return (
    <form
      className="capture"
      onSubmit={(e) => {
        e.preventDefault()
        go(value)
      }}
    >
      <label className="in">
        <Icon name="link-minimalistic-2" className="xs" />
        <input
          id="capture-field"
          value={value}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          placeholder={t('capture.field')}
          aria-label={t('capture.field')}
          onChange={(e) => setValue(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').trim()
            if (looksLikeUrl(text)) {
              e.preventDefault()
              go(text)
            }
          }}
        />
        <kbd aria-hidden="true">N</kbd>
      </label>
      <button type="submit" className="btn btn-accent">
        <Icon name="add" />
        {t('nav.add')}
      </button>
    </form>
  )
}
