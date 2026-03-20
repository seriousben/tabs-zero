import { describe, it, expect } from 'vitest';

// These functions mirror what popup.js and background.js use.
// We test the logic in isolation since the actual code lives in non-module scripts.

function isDoNotExpire(tab, doNotExpireUrls) {
  return tab.url && doNotExpireUrls.has(tab.url);
}

function isSystemTab(tab) {
  return tab.url && (
    tab.url.startsWith('about:') ||
    tab.url.startsWith('moz-extension:') ||
    tab.url.startsWith('chrome:') ||
    tab.url.startsWith('file:')
  );
}

function isProtectedWithDNE(tab, doNotExpireUrls) {
  return !!(tab.pinned || tab.active || tab.audible || isSystemTab(tab) || isDoNotExpire(tab, doNotExpireUrls));
}

function isIdleCandidate(tab) {
  return !tab.pinned && !tab.active && !tab.audible && !(tab.url && tab.url.startsWith('about:'));
}

function normalizeUrl(url) {
  return url && url.endsWith('/') ? url.slice(0, -1) : url;
}

const BUCKETS = [
  { label: 'Idle > 7 days', minMs: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Idle > 3 days', minMs: 3 * 24 * 60 * 60 * 1000 },
  { label: 'Idle > 1 day',  minMs: 24 * 60 * 60 * 1000 },
  { label: 'Idle > 6 hours', minMs: 6 * 60 * 60 * 1000 },
  { label: 'Idle > 1 hour',  minMs: 60 * 60 * 1000 },
];

function groupIdleTabs(allTabs, doNotExpireUrls, now) {
  const candidates = allTabs.filter(isIdleCandidate);
  const totalCandidates = candidates.length;
  candidates.sort((a, b) => a.lastAccessed - b.lastAccessed);

  const groups = [];
  const assigned = new Set();

  for (const bucket of BUCKETS) {
    const matching = candidates.filter(tab => {
      if (assigned.has(tab.id)) return false;
      return (now - tab.lastAccessed) > bucket.minMs;
    });
    if (matching.length === 0) continue;
    matching.forEach(t => assigned.add(t.id));

    const expirable = matching.filter(t => !isDoNotExpire(t, doNotExpireUrls));
    const protected_ = matching.filter(t => isDoNotExpire(t, doNotExpireUrls));
    const pct = totalCandidates > 0 ? Math.round((matching.length / totalCandidates) * 100) : 0;
    groups.push({ label: bucket.label, expirable, protected: protected_, pct });
  }

  const recentCount = candidates.filter(t => !assigned.has(t.id)).length;
  const recentPct = totalCandidates > 0 ? Math.round((recentCount / totalCandidates) * 100) : 0;

  return { groups, recentCount, recentPct };
}

describe('do-not-expire', () => {
  describe('isProtectedWithDNE', () => {
    it('returns true for a do-not-expire URL', () => {
      const dne = new Set(['https://important.com']);
      const tab = { id: 1, url: 'https://important.com', pinned: false };
      expect(isProtectedWithDNE(tab, dne)).toBe(true);
    });

    it('returns false for a URL not in the set', () => {
      const dne = new Set(['https://important.com']);
      const tab = { id: 1, url: 'https://other.com', pinned: false };
      expect(isProtectedWithDNE(tab, dne)).toBe(false);
    });

    it('returns true for pinned tab even if not in do-not-expire', () => {
      const dne = new Set();
      const tab = { id: 1, url: 'https://example.com', pinned: true };
      expect(isProtectedWithDNE(tab, dne)).toBe(true);
    });

    it('handles tab with no url', () => {
      const dne = new Set(['https://example.com']);
      const tab = { id: 1, pinned: false };
      expect(isProtectedWithDNE(tab, dne)).toBe(false);
    });
  });

  describe('groupIdleTabs with do-not-expire', () => {
    const d = 24 * 60 * 60 * 1000;
    const h = 60 * 60 * 1000;
    const now = Date.now();

    it('separates protected and expirable tabs within a group', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d },
        { id: 2, url: 'https://b.com', lastAccessed: now - 8 * d },
        { id: 3, url: 'https://c.com', lastAccessed: now - 9 * d },
      ];
      const dne = new Set(['https://b.com']);
      const { groups } = groupIdleTabs(tabs, dne, now);

      expect(groups.length).toBeGreaterThan(0);
      const g = groups[0];
      expect(g.expirable.length).toBe(2);
      expect(g.protected.length).toBe(1);
      expect(g.protected[0].url).toBe('https://b.com');
    });

    it('group percentage includes both protected and expirable', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d },
        { id: 2, url: 'https://b.com', lastAccessed: now - 8 * d },
        { id: 3, url: 'https://c.com', lastAccessed: now - 30 * 60 * 1000 }, // 30 min ago
      ];
      const dne = new Set(['https://b.com']);
      const { groups } = groupIdleTabs(tabs, dne, now);

      // 2 tabs in > 7 days bucket out of 3 total = 67%
      expect(groups[0].pct).toBe(67);
    });

    it('all tabs protected means expirable is empty', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d },
        { id: 2, url: 'https://b.com', lastAccessed: now - 8 * d },
      ];
      const dne = new Set(['https://a.com', 'https://b.com']);
      const { groups } = groupIdleTabs(tabs, dne, now);

      expect(groups[0].expirable.length).toBe(0);
      expect(groups[0].protected.length).toBe(2);
    });

    it('pinned tabs are excluded from groups entirely', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d, pinned: true },
        { id: 2, url: 'https://b.com', lastAccessed: now - 8 * d },
      ];
      const dne = new Set();
      const { groups } = groupIdleTabs(tabs, dne, now);

      const allGroupTabs = groups.flatMap(g => [...g.expirable, ...g.protected]);
      expect(allGroupTabs.find(t => t.id === 1)).toBeUndefined();
    });

    it('recent count tracks tabs not in any bucket', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d },
        { id: 2, url: 'https://b.com', lastAccessed: now - 5 * 60 * 1000 }, // 5 min ago
        { id: 3, url: 'https://c.com', lastAccessed: now - 10 * 60 * 1000 }, // 10 min ago
      ];
      const dne = new Set();
      const { recentCount, recentPct } = groupIdleTabs(tabs, dne, now);

      expect(recentCount).toBe(2);
      expect(recentPct).toBe(67);
    });

    it('empty do-not-expire set means all idle tabs are expirable', () => {
      const tabs = [
        { id: 1, url: 'https://a.com', lastAccessed: now - 10 * d },
        { id: 2, url: 'https://b.com', lastAccessed: now - 8 * d },
      ];
      const dne = new Set();
      const { groups } = groupIdleTabs(tabs, dne, now);

      const totalProtected = groups.reduce((n, g) => n + g.protected.length, 0);
      expect(totalProtected).toBe(0);
    });
  });
});
