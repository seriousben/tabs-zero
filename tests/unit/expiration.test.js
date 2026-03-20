import { describe, it, expect } from 'vitest';
import { getTabsToExpire } from '../../src/core/expiration.js';

describe('expiration', () => {
  describe('getTabsToExpire', () => {
    it('returns 5 stale tabs when 5 older than threshold out of 10', () => {
      const now = Date.now();
      const thresholdMs = 24 * 60 * 60 * 1000; // 1 day
      const allTabs = [
        // 5 tabs older than 1 day
        { id: 1, url: 'https://old1.com', lastAccessed: now - (2 * 24 * 60 * 60 * 1000) },
        { id: 2, url: 'https://old2.com', lastAccessed: now - (3 * 24 * 60 * 60 * 1000) },
        { id: 3, url: 'https://old3.com', lastAccessed: now - (5 * 24 * 60 * 60 * 1000) },
        { id: 4, url: 'https://old4.com', lastAccessed: now - (7 * 24 * 60 * 60 * 1000) },
        { id: 5, url: 'https://old5.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
        // 5 tabs newer than 1 day
        { id: 6, url: 'https://new1.com', lastAccessed: now - (12 * 60 * 60 * 1000) },
        { id: 7, url: 'https://new2.com', lastAccessed: now - (6 * 60 * 60 * 1000) },
        { id: 8, url: 'https://new3.com', lastAccessed: now - (1 * 60 * 60 * 1000) },
        { id: 9, url: 'https://new4.com', lastAccessed: now },
        { id: 10, url: 'https://new5.com', lastAccessed: now },
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now });

      expect(result).toHaveLength(5);
      result.forEach(item => {
        expect(item.reason).toBe('stale');
        expect(item.tab.id).toBeLessThanOrEqual(5);
      });
    });

    it('handles duplicate tabs with multiplier', () => {
      const now = Date.now();
      const thresholdMs = 24 * 60 * 60 * 1000; // 1 day
      const duplicateMultiplier = 0.5; // 12 hours for duplicates

      const allTabs = [
        // Two duplicate tabs, both within 1 day but older copy exceeds 12 hours
        { id: 1, url: 'https://example.com', lastAccessed: now - (18 * 60 * 60 * 1000) }, // 18 hours
        { id: 2, url: 'https://example.com', lastAccessed: now - (6 * 60 * 60 * 1000) },  // 6 hours
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now, duplicateMultiplier });

      expect(result).toHaveLength(1);
      expect(result[0].tab.id).toBe(1);
      expect(result[0].reason).toBe('duplicate');
      expect(result[0].age).toBe(18 * 60 * 60 * 1000);
    });

    it('never returns pinned tabs', () => {
      const now = Date.now();
      const thresholdMs = 1 * 60 * 60 * 1000; // 1 hour
      const allTabs = [
        { id: 1, url: 'https://old.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000), pinned: true },
        { id: 2, url: 'https://old2.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now });

      expect(result).toHaveLength(1);
      expect(result[0].tab.id).toBe(2);
    });

    it('never returns active tabs', () => {
      const now = Date.now();
      const thresholdMs = 1 * 60 * 60 * 1000; // 1 hour
      const allTabs = [
        { id: 1, url: 'https://old.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000), active: true },
        { id: 2, url: 'https://old2.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now });

      expect(result).toHaveLength(1);
      expect(result[0].tab.id).toBe(2);
    });

    it('never returns system tabs', () => {
      const now = Date.now();
      const thresholdMs = 1 * 60 * 60 * 1000; // 1 hour
      const allTabs = [
        { id: 1, url: 'about:preferences', lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
        { id: 2, url: 'https://old.com', lastAccessed: now - (10 * 24 * 60 * 60 * 1000) },
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now });

      expect(result).toHaveLength(1);
      expect(result[0].tab.id).toBe(2);
    });

    it('sorts results by age descending (oldest first)', () => {
      const now = Date.now();
      const thresholdMs = 1 * 60 * 60 * 1000; // 1 hour
      const allTabs = [
        { id: 1, url: 'https://old1.com', lastAccessed: now - (2 * 60 * 60 * 1000) }, // 2 hours
        { id: 2, url: 'https://old2.com', lastAccessed: now - (5 * 60 * 60 * 1000) }, // 5 hours
        { id: 3, url: 'https://old3.com', lastAccessed: now - (3 * 60 * 60 * 1000) }, // 3 hours
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now });

      expect(result).toHaveLength(3);
      expect(result[0].tab.id).toBe(2); // 5 hours (oldest)
      expect(result[1].tab.id).toBe(3); // 3 hours
      expect(result[2].tab.id).toBe(1); // 2 hours (newest of expired)
    });

    it('works with custom duplicateMultiplier', () => {
      const now = Date.now();
      const thresholdMs = 24 * 60 * 60 * 1000; // 1 day
      const duplicateMultiplier = 0.25; // 6 hours for duplicates

      const allTabs = [
        { id: 1, url: 'https://example.com', lastAccessed: now - (8 * 60 * 60 * 1000) }, // 8 hours
        { id: 2, url: 'https://example.com', lastAccessed: now - (2 * 60 * 60 * 1000) }, // 2 hours
      ];

      const result = getTabsToExpire({ allTabs, thresholdMs, now, duplicateMultiplier });

      expect(result).toHaveLength(1);
      expect(result[0].tab.id).toBe(1);
      expect(result[0].reason).toBe('duplicate');
    });
  });
});
