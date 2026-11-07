/* Runs before the first paint (blocking <script> in index.html, served from 'self': the CSP forbids
   inline scripts). Applies the stored theme so there is no flash, and sets <html lang>. */
(function () {
  var root = document.documentElement
  try {
    var theme = localStorage.getItem('vigie-theme')
    if (theme === 'dark' || theme === 'light') root.setAttribute('data-theme', theme)
  } catch (e) {
    /* storage unavailable: follow the system theme */
  }
  try {
    // Zoom lock is on by default (index.html); the settings can turn it off.
    if (localStorage.getItem('vigie-zoom-lock') === '0') {
      var vp = document.querySelector('meta[name="viewport"]')
      if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
    }
  } catch (e) {
    /* storage unavailable: keep the lock */
  }
  var lang = 'en'
  try {
    var stored = localStorage.getItem('vigie-locale')
    if (stored === 'fr' || stored === 'en') lang = stored
    else if (/^fr/i.test(navigator.language || '')) lang = 'fr'
  } catch (e) {
    if (/^fr/i.test(navigator.language || '')) lang = 'fr'
  }
  root.lang = lang
})()
