/**
 * Preset threshold options for tab expiration.
 */
export const THRESHOLD_PRESETS = [
  { label: '> 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '> 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '> 1 day', ms: 1 * 24 * 60 * 60 * 1000 },
  { label: '> 12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '> 6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '> 1 hour', ms: 1 * 60 * 60 * 1000 },
];

/**
 * Computes threshold options based on current tab ages.
 * @param {Array} tabs - Array of tab objects with lastAccessed property
 * @param {number} now - Current timestamp in milliseconds
 * @returns {Array} Array of threshold options with wouldClose counts
 */
export function computeThresholdOptions(tabs, now) {
  const options = [];

  for (const preset of THRESHOLD_PRESETS) {
    const wouldClose = tabs.filter(tab => {
      const age = now - tab.lastAccessed;
      return age > preset.ms;
    }).length;

    if (wouldClose > 0) {
      options.push({
        label: preset.label,
        thresholdMs: preset.ms,
        wouldClose,
      });
    }
  }

  return options;
}
