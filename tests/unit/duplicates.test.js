import { describe, it, expect } from 'vitest';
import { findDuplicateGroups, selectDuplicatesToClose } from '../../src/core/duplicates.js';

describe('duplicates', () => {
  describe('findDuplicateGroups', () => {
    it('returns 1 group with 3 tabs when 3 tabs have same URL and title', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Example', lastAccessed: 100 },
        { id: 2, url: 'https://example.com', title: 'Example', lastAccessed: 200 },
        { id: 3, url: 'https://example.com', title: 'Example', lastAccessed: 300 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(1);
      expect(groups[0].url).toBe('https://example.com');
      expect(groups[0].tabs).toHaveLength(3);
      expect(groups[0].tabs).toEqual(expect.arrayContaining(tabs));
    });

    it('returns no groups when tabs have different URLs', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', lastAccessed: 100 },
        { id: 2, url: 'https://google.com', lastAccessed: 200 },
        { id: 3, url: 'https://github.com', lastAccessed: 300 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(0);
    });

    it('excludes about: URLs from duplicate detection', () => {
      const tabs = [
        { id: 1, url: 'about:blank', lastAccessed: 100 },
        { id: 2, url: 'about:blank', lastAccessed: 200 },
        { id: 3, url: 'https://example.com', lastAccessed: 300 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(0);
    });

    it('does not group tabs with same URL but different titles', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Page A', lastAccessed: 100 },
        { id: 2, url: 'https://example.com', title: 'Page B', lastAccessed: 200 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(0);
    });

    it('normalizes URLs with trailing slash', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Example', lastAccessed: 100 },
        { id: 2, url: 'https://example.com/', title: 'Example', lastAccessed: 200 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(1);
      expect(groups[0].tabs).toHaveLength(2);
    });

    it('excludes tabs with no url', () => {
      const tabs = [
        { id: 1, lastAccessed: 100 },
        { id: 2, lastAccessed: 200 },
        { id: 3, url: 'https://example.com', lastAccessed: 300 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(0);
    });

    it('does not group tabs with same title but different URLs', () => {
      const tabs = [
        { id: 1, url: 'https://a.com/page1', title: 'Same Title', lastAccessed: 100 },
        { id: 2, url: 'https://b.com/page2', title: 'Same Title', lastAccessed: 200 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(0);
    });

    it('groups tabs with same URL and title', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', title: 'Same', lastAccessed: 100 },
        { id: 2, url: 'https://example.com', title: 'Same', lastAccessed: 200 },
        { id: 3, url: 'https://example.com', title: 'Different', lastAccessed: 300 },
      ];

      const groups = findDuplicateGroups(tabs);

      expect(groups).toHaveLength(1);
      expect(groups[0].tabs).toHaveLength(2);
      expect(groups[0].tabs.map(t => t.id)).toEqual(expect.arrayContaining([1, 2]));
    });
  });

  describe('selectDuplicatesToClose', () => {
    it('keeps most recent tab and returns 2 older ones', () => {
      const tabs = [
        { id: 1, url: 'https://example.com', lastAccessed: 100 },
        { id: 2, url: 'https://example.com', lastAccessed: 300 }, // most recent
        { id: 3, url: 'https://example.com', lastAccessed: 200 },
      ];

      const groups = [{ url: 'https://example.com', tabs }];
      const toClose = selectDuplicatesToClose(groups);

      expect(toClose).toHaveLength(2);
      expect(toClose).toEqual(expect.arrayContaining([tabs[0], tabs[2]]));
      expect(toClose).not.toContain(tabs[1]); // id: 2 (most recent) should be kept
    });

    it('handles multiple groups', () => {
      const group1Tabs = [
        { id: 1, url: 'https://example.com', lastAccessed: 100 },
        { id: 2, url: 'https://example.com', lastAccessed: 200 },
      ];
      const group2Tabs = [
        { id: 3, url: 'https://google.com', lastAccessed: 150 },
        { id: 4, url: 'https://google.com', lastAccessed: 250 },
        { id: 5, url: 'https://google.com', lastAccessed: 50 },
      ];

      const groups = [
        { url: 'https://example.com', tabs: group1Tabs },
        { url: 'https://google.com', tabs: group2Tabs },
      ];

      const toClose = selectDuplicatesToClose(groups);

      expect(toClose).toHaveLength(3); // 1 from group1, 2 from group2
      expect(toClose).toContain(group1Tabs[0]); // older from group1
      expect(toClose).toContain(group2Tabs[0]); // older from group2
      expect(toClose).toContain(group2Tabs[2]); // oldest from group2
    });
  });
});
