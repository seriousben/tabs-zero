import { describe, it, expect } from 'vitest';
import { isSystemTab, isProtected, isExpirable } from '../../src/core/classify.js';

describe('classify', () => {
  describe('isSystemTab', () => {
    it('returns false for about:blank (can be expired)', () => {
      expect(isSystemTab({ url: 'about:blank' })).toBe(false);
    });

    it('returns false for about:newtab (can be expired)', () => {
      expect(isSystemTab({ url: 'about:newtab' })).toBe(false);
    });

    it('returns true for about:preferences', () => {
      expect(isSystemTab({ url: 'about:preferences' })).toBe(true);
    });

    it('returns true for moz-extension URLs', () => {
      expect(isSystemTab({ url: 'moz-extension://uuid-here/page.html' })).toBe(true);
    });

    it('returns true for chrome:// URLs', () => {
      expect(isSystemTab({ url: 'chrome://settings' })).toBe(true);
    });

    it('returns false for file:// URLs (file tabs can be expired)', () => {
      expect(isSystemTab({ url: 'file:///tmp/x.html' })).toBe(false);
    });

    it('returns false for https URLs', () => {
      expect(isSystemTab({ url: 'https://google.com' })).toBe(false);
    });

    it('returns false for http URLs', () => {
      expect(isSystemTab({ url: 'http://localhost:3000' })).toBe(false);
    });
  });

  describe('isProtected', () => {
    it('returns true for pinned tabs', () => {
      expect(isProtected({ url: 'https://example.com', pinned: true })).toBe(true);
    });

    it('returns true for active tabs', () => {
      expect(isProtected({ url: 'https://example.com', active: true })).toBe(true);
    });

    it('returns true for audible tabs', () => {
      expect(isProtected({ url: 'https://example.com', audible: true })).toBe(true);
    });

    it('returns true for system tabs', () => {
      expect(isProtected({ url: 'about:preferences' })).toBe(true);
    });

    it('returns false for regular tabs', () => {
      expect(isProtected({ url: 'https://example.com' })).toBe(false);
    });
  });

  describe('isExpirable', () => {
    it('returns false for pinned tabs', () => {
      expect(isExpirable({ url: 'https://example.com', pinned: true })).toBe(false);
    });

    it('returns false for active tabs', () => {
      expect(isExpirable({ url: 'https://example.com', active: true })).toBe(false);
    });

    it('returns false for system tabs', () => {
      expect(isExpirable({ url: 'about:preferences' })).toBe(false);
    });

    it('returns true for regular tabs', () => {
      expect(isExpirable({ url: 'https://example.com' })).toBe(true);
    });
  });
});
