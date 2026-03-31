// Core classification logic. These are pure functions used by unit tests.
// background.js and popup.js inline equivalent logic since they are
// non-module scripts (manifest v2 background scripts).

/**
 * Determines if a tab is a system tab (browser internal page).
 * @param {Object} tab - Tab object with url property
 * @returns {boolean} True if the tab is a system tab
 */
export function isSystemTab(tab) {
  if (!tab || !tab.url) {
    return false;
  }

  // about:newtab and about:blank are not considered system tabs
  const expirableAboutPages = ['about:newtab', 'about:blank'];
  if (expirableAboutPages.some(page => tab.url === page)) {
    return false;
  }

  const systemPrefixes = ['about:', 'moz-extension:', 'chrome:'];
  
  return systemPrefixes.some(prefix => tab.url.startsWith(prefix));
}

/**
 * Determines if a tab is protected from expiration.
 * @param {Object} tab - Tab object
 * @returns {boolean} True if the tab should not be expired
 */
export function isProtected(tab) {
  return !!(
    tab.pinned ||
    tab.active ||
    tab.audible ||
    isSystemTab(tab)
  );
}

/**
 * Determines if a tab can be expired.
 * @param {Object} tab - Tab object
 * @returns {boolean} True if the tab can be expired
 */
export function isExpirable(tab) {
  return !isProtected(tab);
}
