import { describe, it, expect } from 'vitest';
import { computeThresholdOptions, THRESHOLD_PRESETS } from '../../src/core/thresholds.js';

describe('thresholds', () => {
  describe('THRESHOLD_PRESETS', () => {
    it('exports the expected threshold presets', () => {
      expect(THRESHOLD_PRESETS).toEqual([
        { label: '> 7 days', ms: 7 * 24 * 60 * 60 * 1000 },
        { label: '> 3 days', ms: 3 * 24 * 60 * 60 * 1000 },
        { label: '> 1 day', ms: 1 * 24 * 60 * 60 * 1000 },
        { label: '> 12 hours', ms: 12 * 60 * 60 * 1000 },
        { label: '> 6 hours', ms: 6 * 60 * 60 * 1000 },
        { label: '> 1 hour', ms: 1 * 60 * 60 * 1000 },
      ]);
    });
  });

  describe('computeThresholdOptions', () => {
    it('returns only 1 hour option when all tabs are 2 hours old', () => {
      const now = Date.now();
      const twoHoursAgo = now - (2 * 60 * 60 * 1000);
      const tabs = [
        { lastAccessed: twoHoursAgo },
        { lastAccessed: twoHoursAgo },
        { lastAccessed: twoHoursAgo },
      ];

      const options = computeThresholdOptions(tabs, now);

      expect(options).toEqual([
        {
          label: '> 1 hour',
          thresholdMs: 1 * 60 * 60 * 1000,
          wouldClose: 3,
        },
      ]);
    });

    it('returns all 6 options when tabs span 0 to 10 days', () => {
      const now = Date.now();
      const tabs = [
        { lastAccessed: now },                                    // 0 days
        { lastAccessed: now - (2 * 60 * 60 * 1000) },           // 2 hours
        { lastAccessed: now - (8 * 60 * 60 * 1000) },           // 8 hours
        { lastAccessed: now - (18 * 60 * 60 * 1000) },          // 18 hours
        { lastAccessed: now - (2 * 24 * 60 * 60 * 1000) },      // 2 days
        { lastAccessed: now - (5 * 24 * 60 * 60 * 1000) },      // 5 days
        { lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },     // 10 days
      ];

      const options = computeThresholdOptions(tabs, now);

      expect(options).toEqual([
        {
          label: '> 7 days',
          thresholdMs: 7 * 24 * 60 * 60 * 1000,
          wouldClose: 1, // 10 days
        },
        {
          label: '> 3 days',
          thresholdMs: 3 * 24 * 60 * 60 * 1000,
          wouldClose: 2, // 5, 10 days
        },
        {
          label: '> 1 day',
          thresholdMs: 1 * 24 * 60 * 60 * 1000,
          wouldClose: 3, // 2, 5, 10 days
        },
        {
          label: '> 12 hours',
          thresholdMs: 12 * 60 * 60 * 1000,
          wouldClose: 4, // 18h, 2d, 5d, 10d
        },
        {
          label: '> 6 hours',
          thresholdMs: 6 * 60 * 60 * 1000,
          wouldClose: 5, // 8h, 18h, 2d, 5d, 10d
        },
        {
          label: '> 1 hour',
          thresholdMs: 1 * 60 * 60 * 1000,
          wouldClose: 6, // 2h, 8h, 18h, 2d, 5d, 10d
        },
      ]);
    });

    it('returns empty array when all tabs are 30 minutes old', () => {
      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      const tabs = [
        { lastAccessed: thirtyMinutesAgo },
        { lastAccessed: thirtyMinutesAgo },
      ];

      const options = computeThresholdOptions(tabs, now);

      expect(options).toEqual([]);
    });

    it('options are sorted from longest to shortest threshold', () => {
      const now = Date.now();
      const tabs = [
        { lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
      ];

      const options = computeThresholdOptions(tabs, now);

      // Verify each option has a smaller threshold than the previous
      for (let i = 1; i < options.length; i++) {
        expect(options[i].thresholdMs).toBeLessThan(options[i - 1].thresholdMs);
      }
    });
  });
});
