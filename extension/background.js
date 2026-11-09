// Vigie extension service worker (Manifest V3). No remote code: everything runs from this package.
//
// Flow: toolbar click or context-menu entry -> POST {instance}/api/extension/items with the
// user's token (Authorization header, no cookies) -> result shown as a badge on the toolbar icon.

const MENU_ID = 'vigie-save'
const BADGE_MS = 4000

const BADGES = {
  ok: { text: '✓', color: '#2f9e44', message: 'saved' },
  exists: { text: '✓', color: '#1c7ed6', message: 'alreadySaved' },
  error: { text: '!', color: '#e03131', message: 'failed' },
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: chrome.i18n.getMessage('menuTitle'),
      contexts: ['page', 'link'],
    })
  })
})

chrome.action.onClicked.addListener((tab) => {
  void saveFrom(tab.url, tab.id)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return
  // A right-click on a link saves the link, anywhere else the page.
  void saveFrom(info.linkUrl || info.pageUrl || tab?.url, tab?.id)
})

/** Show the outcome on the toolbar icon for a few seconds, with a tooltip that says why. */
function show(kind, tabId, detail) {
  const badge = BADGES[kind]
  const title = detail || chrome.i18n.getMessage(badge.message)
  const target = tabId === undefined ? {} : { tabId }
  chrome.action.setBadgeBackgroundColor({ color: badge.color, ...target })
  chrome.action.setBadgeText({ text: badge.text, ...target })
  chrome.action.setTitle({ title, ...target })
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', ...target })
    chrome.action.setTitle({ title: chrome.i18n.getMessage('actionTitle'), ...target })
  }, BADGE_MS)
}

function needsSetup(tabId) {
  show('error', tabId, chrome.i18n.getMessage('notConfigured'))
  chrome.runtime.openOptionsPage()
}

async function saveFrom(url, tabId) {
  if (!url || !/^https?:\/\//i.test(url)) {
    show('error', tabId, chrome.i18n.getMessage('unsupportedPage'))
    return
  }
  const { baseUrl, token } = await chrome.storage.local.get(['baseUrl', 'token'])
  if (!baseUrl || !token) return needsSetup(tabId)
  const granted = await chrome.permissions.contains({ origins: [`${baseUrl}/*`] })
  if (!granted) return needsSetup(tabId)

  try {
    const response = await fetch(`${baseUrl}/api/extension/items`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    })
    if (response.status === 201) return show('ok', tabId)
    if (response.status === 409) return show('exists', tabId)
    if (response.status === 401) {
      show('error', tabId, chrome.i18n.getMessage('badToken'))
      chrome.runtime.openOptionsPage()
      return
    }
    if (response.status === 429) return show('error', tabId, chrome.i18n.getMessage('tooMany'))
    if (response.status === 422) return show('error', tabId, chrome.i18n.getMessage('unsupportedPage'))
    show('error', tabId, chrome.i18n.getMessage('serverError', [String(response.status)]))
  } catch {
    show('error', tabId, chrome.i18n.getMessage('unreachable'))
  }
}
