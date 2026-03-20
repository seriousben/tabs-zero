import { isProtected } from './classify.js';
import { findDuplicateGroups, selectDuplicatesToClose } from './duplicates.js';

/**
 * Gets tabs to expire based on threshold and duplicate rules.
 * @param {Object} options - Configuration options
 * @param {Array} options.allTabs - All tabs to consider
 * @param {number} options.thresholdMs - Age threshold in milliseconds
 * @param {number} options.now - Current timestamp
 * @param {number} options.duplicateMultiplier - Multiplier for duplicate threshold (default 0.5)
 * @returns {Array} Array of {tab, reason, age} objects sorted by age descending
 */
export function getTabsToExpire({ allTabs, thresholdMs, now, duplicateMultiplier = 0.5 }) {
  const result = [];

  // Filter out protected tabs first
  const expirableTabs = allTabs.filter(tab => !isProtected(tab));

  // Find duplicate groups
  const duplicateGroups = findDuplicateGroups(expirableTabs);
  const duplicateTabs = selectDuplicatesToClose(duplicateGroups);
  const duplicateTabIds = new Set(duplicateTabs.map(tab => tab.id));

  // Calculate duplicate threshold
  const duplicateThresholdMs = thresholdMs * duplicateMultiplier;

  // Process each expirable tab
  for (const tab of expirableTabs) {
    const age = now - tab.lastAccessed;
    
    if (duplicateTabIds.has(tab.id)) {
      // Duplicate tab: use multiplied threshold
      if (age > duplicateThresholdMs) {
        result.push({
          tab,
          reason: 'duplicate',
          age,
        });
      }
    } else {
      // Non-duplicate tab: use normal threshold
      if (age > thresholdMs) {
        result.push({
          tab,
          reason: 'stale',
          age,
        });
      }
    }
  }

  // Sort by age descending (oldest first)
  result.sort((a, b) => b.age - a.age);

  return result;
}
