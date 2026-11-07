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
