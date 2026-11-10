// Vigie extension service worker (Manifest V3). No remote code: everything runs from this package.
//
// Flow: toolbar click or context-menu entry -> POST {instance}/api/extension/items with the
// user's token (Authorization header, no cookies) -> result shown as a badge on the toolbar icon.

const MENU_ID = 'vigie-save'
const DASHBOARD_ID = 'vigie-dashboard'
const BADGE_MS = 4000

// The toolbar icon of a page that is already in the library: the lighthouse with a green bookmark.
const SAVED_ICON = { 16: 'icons/saved-16.png', 32: 'icons/saved-32.png' }
const DEFAULT_ICON = { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' }

const BADGES = {
  error: { text: '!', color: '#e03131', message: 'failed' },
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: chrome.i18n.getMessage('menuTitle'),
      contexts: ['page', 'link'],
    })
    // Also in the right-click menu of the toolbar icon.
    chrome.contextMenus.create({
      id: DASHBOARD_ID,
      title: chrome.i18n.getMessage('dashboardTitle'),
      contexts: ['action', 'page'],
    })
  })
})

chrome.action.onClicked.addListener((tab) => {
  void saveFrom(tab.url, tab.id)
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === DASHBOARD_ID) return void openDashboard(tab?.id)
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
    if (tabId !== undefined) chrome.tabs.get(tabId).then((tab) => refreshSaved(tabId, tab.url)).catch(() => {})
  }, BADGE_MS)
}

/** Persistent state of a tab: the bookmark icon while its page is in the library. */
function markSaved(tabId, saved) {
  chrome.action.setIcon({ path: saved ? SAVED_ICON : DEFAULT_ICON, tabId }).catch(() => {})
  chrome.action.setTitle({
    title: chrome.i18n.getMessage(saved ? 'alreadySaved' : 'actionTitle'),
    tabId,
  }).catch(() => {})
}

/** Ask the instance whether this tab's page is already saved; silent on any failure. */
async function refreshSaved(tabId, url) {
  if (!url || !/^https?:\/\//i.test(url)) return markSaved(tabId, false)
  const { baseUrl, token } = await chrome.storage.local.get(['baseUrl', 'token'])
  if (!baseUrl || !token) return
  if (!(await chrome.permissions.contains({ origins: [`${baseUrl}/*`] }))) return
  try {
    const response = await fetch(`${baseUrl}/api/extension/items/saved?url=${encodeURIComponent(url)}`, {
      credentials: 'omit',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return
    const { saved } = await response.json()
    markSaved(tabId, saved === true)
  } catch {
    // offline or unreachable: leave the icon as it is
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) void refreshSaved(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId).then((tab) => refreshSaved(tabId, tab.url)).catch(() => {})
})

/** Open the user's Vigie instance in a new tab. */
async function openDashboard(tabId) {
  const { baseUrl } = await chrome.storage.local.get('baseUrl')
  if (!baseUrl) return needsSetup(tabId)
  chrome.tabs.create({ url: baseUrl })
}

function needsSetup(tabId) {
  show('error', tabId, chrome.i18n.getMessage('notConfigured'))
  chrome.runtime.openOptionsPage()
}

/** The page is already in the library: a second click takes it out. */
async function removeFrom(baseUrl, token, url, tabId) {
  const response = await fetch(`${baseUrl}/api/extension/items?url=${encodeURIComponent(url)}`, {
    method: 'DELETE',
    credentials: 'omit',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 204) return markSaved(tabId, false)
  if (response.status === 429) return show('error', tabId, chrome.i18n.getMessage('tooMany'))
  show('error', tabId, chrome.i18n.getMessage('serverError', [String(response.status)]))
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
    if (response.status === 201) return markSaved(tabId, true)
    if (response.status === 409) return removeFrom(baseUrl, token, url, tabId)
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
