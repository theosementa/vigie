// Options page: the Vigie address and the token created in Vigie (Settings > Browser extension).
// The token is kept in chrome.storage.local (never synced) and only sent to that address.

const $ = (id) => document.getElementById(id)
const msg = (key, subs) => chrome.i18n.getMessage(key, subs)

for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = msg(el.dataset.i18n)

function status(text, kind) {
  const el = $('status')
  el.textContent = text
  el.className = kind || ''
}

/** "https://host[:port]" from what the user typed; http is only accepted for local addresses. */
function parseOrigin(value) {
  let url
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null
  return url.origin
}

async function load() {
  const { baseUrl, token } = await chrome.storage.local.get(['baseUrl', 'token'])
  $('baseUrl').value = baseUrl || ''
  $('token').value = token || ''
}

$('form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const origin = parseOrigin($('baseUrl').value)
  const token = $('token').value.trim()
  if (!origin) return status(msg('badUrl'), 'error')
  if (!token) return status(msg('missingToken'), 'error')
  // Ask for access to this one address only (needs this click, hence done first).
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
  if (!granted) return status(msg('permissionDenied'), 'error')
  const previous = (await chrome.storage.local.get('baseUrl')).baseUrl
  await chrome.storage.local.set({ baseUrl: origin, token })
  if (previous && previous !== origin) {
    await chrome.permissions.remove({ origins: [`${previous}/*`] })
  }
  $('baseUrl').value = origin
  status(msg('saved'), 'ok')
})

$('disconnect').addEventListener('click', async () => {
  const { baseUrl } = await chrome.storage.local.get('baseUrl')
  await chrome.storage.local.remove(['baseUrl', 'token'])
  if (baseUrl) await chrome.permissions.remove({ origins: [`${baseUrl}/*`] })
  await load()
  status(msg('disconnected'), 'ok')
})

void load()
