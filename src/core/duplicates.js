/**
 * Normalizes a URL by removing trailing slash.
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  }
  return url;
}

/**
 * Finds groups of duplicate tabs (same URL and same title).
 * Tabs are grouped by the combination of normalized URL and title.
 * @param {Array} tabs - Array of tab objects
 * @returns {Array} Array of {url, tabs} objects where tabs.length >= 2
 */
export function findDuplicateGroups(tabs) {
  const map = new Map();

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('about:')) continue;

    const key = normalizeUrl(tab.url) + '\0' + (tab.title || '');

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  }

  const groups = [];
  for (const [key, group] of map.entries()) {
    if (group.length < 2) continue;
    const url = key.split('\0')[0];
    groups.push({ url, tabs: group });
  }

  return groups;
}

/**
 * Selects duplicate tabs to close (keeps most recent per group).
 * @param {Array} groups - Array of {url, tabs} from findDuplicateGroups
 * @returns {Array} Flat array of tabs to close
 */
export function selectDuplicatesToClose(groups) {
  const toClose = [];

  for (const group of groups) {
    // Sort by lastAccessed descending (most recent first)
    const sorted = [...group.tabs].sort((a, b) => b.lastAccessed - a.lastAccessed);
    
    // Keep the first (most recent), close the rest
    toClose.push(...sorted.slice(1));
  }

  return toClose;
}
