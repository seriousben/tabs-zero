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
 * Finds groups of duplicate tabs (same URL).
 * @param {Array} tabs - Array of tab objects
 * @returns {Array} Array of {url, tabs} objects where tabs.length >= 2
 */
export function findDuplicateGroups(tabs) {
  // Group tabs by normalized URL
  const urlMap = new Map();

  for (const tab of tabs) {
    // Skip tabs without URL or with about: URLs
    if (!tab.url || tab.url.startsWith('about:')) {
      continue;
    }

    const normalizedUrl = normalizeUrl(tab.url);
    
    if (!urlMap.has(normalizedUrl)) {
      urlMap.set(normalizedUrl, []);
    }
    
    urlMap.get(normalizedUrl).push(tab);
  }

  // Filter to only groups with 2 or more tabs
  const groups = [];
  for (const [url, tabs] of urlMap.entries()) {
    if (tabs.length >= 2) {
      groups.push({ url, tabs });
    }
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
