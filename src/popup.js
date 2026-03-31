'use strict';

const IS_EXTENSION = typeof browser !== 'undefined' && browser.runtime && browser.runtime.id;

let allTabs = [];
let doNotExpireUrls = new Set();
let pendingExpiration = {}; // { tabId: markedAt }

async function loadDoNotExpire() {
  if (IS_EXTENSION) {
    const data = await browser.storage.local.get({ doNotExpireUrls: [] });
    doNotExpireUrls = new Set(data.doNotExpireUrls);
  } else {
    // Mock: pretend one URL is protected
    doNotExpireUrls = new Set(['https://netflix.com/browse/my-list', 'https://docs.google.com/shopping-list']);
  }
}

async function saveDoNotExpire() {
  if (IS_EXTENSION) {
    await browser.storage.local.set({ doNotExpireUrls: [...doNotExpireUrls] });
  }
}

async function toggleDoNotExpire(url) {
  if (doNotExpireUrls.has(url)) {
    doNotExpireUrls.delete(url);
  } else {
    doNotExpireUrls.add(url);
  }
  await saveDoNotExpire();
  updateTabCount();
  renderIdleTabs();
}

function isDoNotExpire(tab) {
  return tab.url && doNotExpireUrls.has(tab.url);
}

const LUCIDE_PATHS = {
  shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
  'shield-off': ['m2 2 20 20', 'M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71', 'M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
};

function makeLucideIcon(name, size) {
  size = size || 14;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of (LUCIDE_PATHS[name] || [])) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function getProtectionReason(tab) {
  const reasons = [];
  if (tab.pinned) reasons.push('Pinned');
  if (tab.active) reasons.push('Active tab');
  if (tab.audible) reasons.push('Playing audio');
  if (isDoNotExpire(tab)) reasons.push('Marked do-not-expire');
  if (tab.url && isSystemUrl(tab.url)) reasons.push('Browser page');
  return reasons;
}

function makePopover(anchor, text) {
  const wrapper = document.createElement('span');
  wrapper.className = 'popover-anchor';

  const bubble = document.createElement('span');
  bubble.className = 'popover-bubble';
  bubble.textContent = text;

  wrapper.appendChild(anchor);
  wrapper.appendChild(bubble);

  wrapper.addEventListener('mouseenter', () => {
    bubble.style.display = 'block';
    const rect = wrapper.getBoundingClientRect();
    // Position above the anchor, centered horizontally
    bubble.style.left = rect.left + rect.width / 2 - bubble.offsetWidth / 2 + 'px';
    bubble.style.top = rect.top - bubble.offsetHeight - 6 + 'px';
    // Clamp to viewport edges
    const bRect = bubble.getBoundingClientRect();
    if (bRect.left < 4) bubble.style.left = '4px';
    if (bRect.right > window.innerWidth - 4) {
      bubble.style.left = window.innerWidth - 4 - bubble.offsetWidth + 'px';
    }
    if (bRect.top < 4) {
      // Flip below if no room above
      bubble.style.top = rect.bottom + 6 + 'px';
    }
  });

  wrapper.addEventListener('mouseleave', () => {
    bubble.style.display = 'none';
  });

  return wrapper;
}

function mockFavicon(url) {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    const safe = host.replace(/\./g, '-');
    return 'icons/favicons/' + safe + '.png';
  } catch (e) { return ''; }
}

function generateMockData() {
  const now = Date.now();
  const m = 60e3, h = 60 * m, d = 24 * h;
  return [
    // Pinned (always safe)
    { id: 1, title: 'Gmail - Inbox', url: 'https://mail.google.com/inbox', pinned: true, lastAccessed: now - 10 * m },
    { id: 2, title: 'Google Calendar', url: 'https://calendar.google.com', pinned: true, lastAccessed: now - 1 * h },
    { id: 3, title: 'Slack - #general', url: 'https://app.slack.com/channel/general', pinned: true, lastAccessed: now - 3 * m },

    // Playing audio
    { id: 4, title: 'YouTube - lofi hip hop radio beats to relax/study to', url: 'https://youtube.com/watch?v=jfKfPfyJRdk', audible: true, lastAccessed: now - 15 * m },

    // The graveyard (> 7 days)
    { id: 5, title: 'YouTube - How to mass-close tabs in Firefox', url: 'https://youtube.com/watch?v=old-tutorial', lastAccessed: now - 14 * d },
    { id: 6, title: 'Google - "how to be more productive"', url: 'https://google.com/search?q=how+to+be+more+productive', lastAccessed: now - 12 * d },
    { id: 7, title: 'Reddit - r/GetMotivated - "Just do it"', url: 'https://reddit.com/r/GetMotivated/top', lastAccessed: now - 11 * d },
    { id: 8, title: 'Amazon - Standing Desk Adjustable Height', url: 'https://amazon.com/dp/B08STANDING', lastAccessed: now - 10 * d },
    { id: 9, title: 'Wikipedia - Procrastination', url: 'https://en.wikipedia.org/wiki/Procrastination', lastAccessed: now - 9 * d },
    { id: 10, title: 'Google - "best note taking app 2025"', url: 'https://google.com/search?q=best+note+taking+app+2025', lastAccessed: now - 8 * d },

    // Getting stale (3-7 days)
    { id: 11, title: 'YouTube - 10 Hour Fireplace Ambiance', url: 'https://youtube.com/watch?v=fireplace', lastAccessed: now - 6 * d },
    { id: 12, title: 'Reddit - r/AskReddit - "What\'s your guilty pleasure?"', url: 'https://reddit.com/r/AskReddit/comments/guilty', lastAccessed: now - 5 * d },
    { id: 13, title: 'Instagram - Explore', url: 'https://instagram.com/explore/', lastAccessed: now - 5 * d },
    { id: 14, title: 'Netflix - My List', url: 'https://netflix.com/browse/my-list', lastAccessed: now - 4 * d },
    { id: 15, title: 'Google - "is cereal a soup"', url: 'https://google.com/search?q=is+cereal+a+soup', lastAccessed: now - 3 * d },

    // Duplicates (oops, opened it twice)
    { id: 16, title: 'Reddit - r/firefox', url: 'https://reddit.com/r/firefox', lastAccessed: now - 7 * d },
    { id: 17, title: 'Reddit - r/firefox', url: 'https://reddit.com/r/firefox', lastAccessed: now - 2 * d },

    // Yesterday's rabbit hole (1-3 days)
    { id: 18, title: 'YouTube - Why Do Cats Knock Things Off Tables?', url: 'https://youtube.com/watch?v=cats-tables', lastAccessed: now - 2 * d },
    { id: 19, title: 'Google - "why is the sky blue for kids"', url: 'https://google.com/search?q=why+is+the+sky+blue+for+kids', lastAccessed: now - 1.5 * d },
    { id: 20, title: 'TikTok - For You Page', url: 'https://tiktok.com/foryou', lastAccessed: now - 1 * d },

    // Today's tabs (still warm)
    { id: 21, title: 'YouTube - How to Cook Perfect Eggs', url: 'https://youtube.com/watch?v=perfect-eggs', lastAccessed: now - 8 * h },
    { id: 22, title: 'Google - "best pizza near me"', url: 'https://google.com/search?q=best+pizza+near+me', lastAccessed: now - 5 * h },
    { id: 23, title: 'Reddit - r/aww - Puppy meets kitten', url: 'https://reddit.com/r/aww/puppy-kitten', lastAccessed: now - 3 * h },
    { id: 24, title: 'Twitter / X - Trending', url: 'https://twitter.com/explore/trending', lastAccessed: now - 2 * h },

    // Just opened (recent)
    { id: 25, title: 'Google - "weather today"', url: 'https://google.com/search?q=weather+today', lastAccessed: now - 20 * m },
    { id: 26, title: 'YouTube - Song stuck in my head', url: 'https://youtube.com/watch?v=earworm', lastAccessed: now - 10 * m },
    { id: 27, title: 'Discord - Server Chat', url: 'https://discord.com/channels/server', lastAccessed: now - 5 * m },
    { id: 28, title: 'Google Docs - Shopping List', url: 'https://docs.google.com/shopping-list', lastAccessed: now - 2 * m },

    // System
    { id: 29, title: 'Firefox Settings', url: 'about:preferences', lastAccessed: now - 4 * d },
  ].map(t => ({ ...t, favIconUrl: t.favIconUrl || mockFavicon(t.url) }));
}

function formatAge(lastAccessed) {
  const diff = Date.now() - lastAccessed;
  const m = 60e3, h = 60 * m, d = 24 * h;
  if (diff < m) return '< 1m';
  if (diff < h) return `${Math.floor(diff / m)}m`;
  if (diff < d) return `${Math.floor(diff / h)}h`;
  return `${Math.floor(diff / d)}d`;
}

function isSystemUrl(url) {
  if (!url) return false;
  if (url === 'about:newtab' || url === 'about:blank') return false;
  return url.startsWith('about:') || url.startsWith('moz-extension:') || url.startsWith('chrome:');
}

function isProtected(tab) {
  return tab.pinned || tab.active || tab.audible || isSystemUrl(tab.url) || isDoNotExpire(tab);
}

// --- Duplicate detection ---

function normalizeUrl(url) {
  return url && url.endsWith('/') ? url.slice(0, -1) : url;
}

function findDuplicateIds() {
  const byUrl = new Map();
  for (const tab of allTabs) {
    if (!tab.url || tab.url.startsWith('about:') || isProtected(tab)) continue;
    const key = normalizeUrl(tab.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(tab);
  }
  const dupIds = new Set();
  for (const tabs of byUrl.values()) {
    if (tabs.length < 2) continue;
    tabs.sort((a, b) => b.lastAccessed - a.lastAccessed);
    for (let i = 1; i < tabs.length; i++) dupIds.add(tabs[i].id);
  }
  return dupIds;
}

// --- Idle tab grouping ---

const BUCKETS = [
  { label: 'Idle > 7 days', minMs: 7 * 24 * 60 * 60 * 1000 },
  { label: 'Idle > 3 days', minMs: 3 * 24 * 60 * 60 * 1000 },
  { label: 'Idle > 1 day',  minMs: 24 * 60 * 60 * 1000 },
  { label: 'Idle > 6 hours', minMs: 6 * 60 * 60 * 1000 },
  { label: 'Idle > 1 hour',  minMs: 60 * 60 * 1000 },
];

function isNeverExpire(tab) {
  // Tabs that can never be expired regardless of settings
  return tab.pinned || tab.active || tab.audible || isDoNotExpire(tab) ||
    isSystemUrl(tab.url);
}

function groupAllTabs() {
  const now = Date.now();
  const total = allTabs.length;
  const sorted = [...allTabs].sort((a, b) => a.lastAccessed - b.lastAccessed);

  const groups = [];
  const assigned = new Set();

  for (const bucket of BUCKETS) {
    const matching = sorted.filter(tab => {
      if (assigned.has(tab.id)) return false;
      return (now - tab.lastAccessed) > bucket.minMs;
    });
    if (matching.length === 0) continue;
    matching.forEach(t => assigned.add(t.id));

    const expirable = matching.filter(t => !isNeverExpire(t));
    const protected_ = matching.filter(t => isNeverExpire(t));
    const pct = total > 0 ? Math.round((matching.length / total) * 100) : 0;
    groups.push({ label: bucket.label, expirable, protected: protected_, pct });
  }

  // Remaining tabs (used within last hour)
  const recentTabs = sorted.filter(t => !assigned.has(t.id));
  const recentPct = total > 0 ? Math.round((recentTabs.length / total) * 100) : 0;

  return { groups, recentTabs, recentPct };
}

// --- Rendering ---

function updateTabCount() {
  const wontExpire = allTabs.filter(t => isNeverExpire(t)).length;
  const el = document.getElementById('tab-count');
  el.textContent = '';
  const totalSpan = document.createElement('span');
  totalSpan.textContent = `${allTabs.length} tabs`;
  el.appendChild(makePopover(totalSpan, 'Total open tabs in this window'));

  if (wontExpire > 0) {
    el.appendChild(document.createTextNode(' · '));
    const span = document.createElement('span');
    span.className = 'wont-expire-count';
    span.textContent = `${wontExpire} won't expire`;
    el.appendChild(makePopover(span, 'Pinned, active, audible, or marked do-not-expire'));
  }
}

function renderIdleTabs() {
  const container = document.getElementById('idle-tabs');
  const scrollTop = container.scrollTop;

  // Remove all children except the empty message
  const emptyMsg = document.getElementById('empty-message');
  while (container.firstChild) {
    if (container.firstChild === emptyMsg) break;
    container.removeChild(container.firstChild);
  }
  // Remove anything after emptyMsg too
  while (emptyMsg.nextSibling) {
    container.removeChild(emptyMsg.nextSibling);
  }

  const { groups, recentTabs, recentPct } = groupAllTabs();
  if (groups.length === 0 && recentTabs.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';

  const dupIds = findDuplicateIds();

  function renderTabRow(tab, dupIds, isProtectedTab) {
    const isDup = dupIds.has(tab.id);
    const isPending = !!pendingExpiration[tab.id];
    const li = document.createElement('li');
    li.className = 'idle-tab'
      + (isDup ? ' is-dup' : '')
      + (isProtectedTab ? ' is-protected' : '')
      + (isPending ? ' is-pending' : '');

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%23ccc" rx="2"/></svg>';
    favicon.alt = '';
    favicon.onerror = function() { this.style.display = 'none'; };

    const titleEl = document.createElement('span');
    titleEl.className = 'idle-tab-title';
    titleEl.textContent = tab.title;
    titleEl.title = tab.url;

    const meta = document.createElement('span');
    meta.className = 'idle-tab-meta';

    if (isPending) {
      const badge = document.createElement('span');
      badge.className = 'pending-badge';
      const markedAt = pendingExpiration[tab.id];
      const elapsed = Date.now() - markedAt;
      const remaining = Math.max(0, 60 - Math.floor(elapsed / 60000));
      badge.textContent = remaining > 0 ? `${remaining}m` : 'soon';
      badge.title = 'Will be closed when grace period ends';
      meta.appendChild(badge);
    }

    if (isDup) {
      const badge = document.createElement('span');
      badge.className = 'dup-badge';
      badge.textContent = 'dup';
      meta.appendChild(badge);
    }

    const age = document.createElement('span');
    age.className = 'idle-tab-age';
    age.textContent = formatAge(tab.lastAccessed);
    meta.appendChild(age);

    li.appendChild(favicon);
    li.appendChild(titleEl);
    li.appendChild(meta);

    // Actions container (right-aligned)
    const actions = document.createElement('span');
    actions.className = 'idle-tab-actions';

    if (!isNeverExpire(tab) || isDoNotExpire(tab)) {
      const dneBtn = document.createElement('button');
      dneBtn.className = 'btn-do-not-expire' + (isProtectedTab ? ' is-active' : '');
      dneBtn.title = isProtectedTab ? 'Allow expiring' : 'Do not expire';
      dneBtn.appendChild(makeLucideIcon(isProtectedTab ? 'shield' : 'shield-off'));
      dneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDoNotExpire(tab.url);
      });
      actions.appendChild(dneBtn);
    } else if (isNeverExpire(tab)) {
      // Inherently protected: show shield with popover explaining why
      const reasons = getProtectionReason(tab);
      const shieldEl = document.createElement('span');
      shieldEl.className = 'btn-do-not-expire is-active is-inherent';
      shieldEl.appendChild(makeLucideIcon('shield'));
      actions.appendChild(makePopover(shieldEl, reasons.join(', ')));
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close-tab';
    closeBtn.title = 'Close tab';
    closeBtn.appendChild(makeLucideIcon('x', 12));
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTabs([tab.id]);
    });
    actions.appendChild(closeBtn);

    li.appendChild(actions);

    // Click row to switch to tab
    li.addEventListener('click', () => {
      activateTab(tab.id);
    });

    return li;
  }

  const PAGE_SIZE = 5;

  for (const group of groups) {
    const section = document.createElement('div');
    section.className = 'idle-group';

    const header = document.createElement('div');
    header.className = 'idle-group-header';

    const chevron = document.createElement('span');
    chevron.className = 'group-chevron';
    chevron.textContent = '›';

    const title = document.createElement('span');
    title.className = 'idle-group-title';
    title.textContent = group.label;

    const stats = document.createElement('span');
    stats.className = 'idle-group-stats';

    const countSpan = document.createElement('span');
    countSpan.textContent = String(group.expirable.length);
    if (group.protected.length > 0) {
      countSpan.textContent += '+';
      const protSpan = document.createElement('span');
      protSpan.className = 'protected-count';
      protSpan.textContent = String(group.protected.length);
      countSpan.appendChild(protSpan);
    }
    const countTip = group.protected.length > 0
      ? `${group.expirable.length} closable + ${group.protected.length} protected`
      : `${group.expirable.length} closable tabs`;
    stats.appendChild(makePopover(countSpan, countTip));

    const pctSpan = document.createElement('span');
    pctSpan.textContent = ` · ${group.pct}%`;
    stats.appendChild(makePopover(pctSpan, `${group.pct}% of all open tabs`));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close-group';
    closeBtn.textContent = group.expirable.length > 0 ? `Close ${group.expirable.length}` : 'Close';
    closeBtn.disabled = group.expirable.length === 0;

    const confirmBar = document.createElement('div');
    confirmBar.className = 'confirm-bar';
    confirmBar.style.display = 'none';

    const confirmText = document.createElement('span');
    confirmText.className = 'confirm-text';
    confirmText.textContent = `Close ${group.expirable.length} tab${group.expirable.length !== 1 ? 's' : ''}?`;

    const confirmYes = document.createElement('button');
    confirmYes.className = 'btn-confirm-yes';
    confirmYes.textContent = 'Yes';
    confirmYes.addEventListener('click', () => {
      closeTabs(group.expirable.map(t => t.id));
    });

    const confirmNo = document.createElement('button');
    confirmNo.className = 'btn-confirm-no';
    confirmNo.textContent = 'No';
    confirmNo.addEventListener('click', () => {
      confirmBar.style.display = 'none';
      closeBtn.style.display = '';
    });

    confirmBar.appendChild(confirmText);
    confirmBar.appendChild(confirmYes);
    confirmBar.appendChild(confirmNo);

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeBtn.style.display = 'none';
      confirmBar.style.display = 'flex';
    });

    header.appendChild(chevron);
    header.appendChild(title);
    header.appendChild(stats);
    header.appendChild(closeBtn);
    header.appendChild(confirmBar);
    section.appendChild(header);

    // Content area (collapsible)
    const content = document.createElement('div');
    content.className = 'idle-group-content';

    const allGroupTabs = [...group.expirable, ...group.protected]
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Protected tabs always rendered, expirable tabs paginated
    const protectedSet = new Set(group.protected.map(t => t.id));
    const expirableTabs = allGroupTabs.filter(t => !protectedSet.has(t.id));
    const protectedTabs = allGroupTabs.filter(t => protectedSet.has(t.id));

    const list = document.createElement('ul');
    list.className = 'idle-group-list';
    content.appendChild(list);

    // Always render protected tabs
    for (const tab of protectedTabs) {
      list.appendChild(renderTabRow(tab, dupIds, true));
    }

    // Paginate expirable tabs
    let loaded = 0;
    let moreBtnEl = null;

    function loadPage() {
      const page = expirableTabs.slice(loaded, loaded + PAGE_SIZE);
      for (const tab of page) {
        list.appendChild(renderTabRow(tab, dupIds, false));
      }
      loaded += page.length;
      updateMoreBtn();
    }

    function updateMoreBtn() {
      const remaining = expirableTabs.length - loaded;
      if (remaining <= 0) {
        if (moreBtnEl) moreBtnEl.remove();
        moreBtnEl = null;
        return;
      }
      if (!moreBtnEl) {
        moreBtnEl = document.createElement('button');
        moreBtnEl.className = 'btn-show-more';
        moreBtnEl.addEventListener('click', (e) => {
          e.stopPropagation();
          loadPage();
        });
        content.appendChild(moreBtnEl);
      }
      moreBtnEl.textContent = `Show ${remaining} more`;
    }

    loadPage();
    section.appendChild(content);

    // Collapse/expand on header click
    let expanded = true;
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      expanded = !expanded;
      section.classList.toggle('is-collapsed', !expanded);
      if (!expanded) {
        // Reset pagination on collapse
        list.querySelectorAll('.idle-tab:not(.is-protected)').forEach(el => el.remove());
        loaded = 0;
        if (moreBtnEl) moreBtnEl.remove();
        moreBtnEl = null;
      } else {
        loadPage();
      }
    });

    container.insertBefore(section, emptyMsg);
  }

  // Catch-all: recent tabs (always collapsed, expandable)
  if (recentTabs.length > 0) {
    const section = document.createElement('div');
    section.className = 'recent-group';

    const header = document.createElement('button');
    header.className = 'recent-header';

    const chevron = document.createElement('span');
    chevron.className = 'recent-chevron';
    chevron.textContent = '›';

    const label = document.createElement('span');
    const recentCountSpan = document.createElement('span');
    recentCountSpan.textContent = `${recentTabs.length} tab${recentTabs.length !== 1 ? 's' : ''} used in the last hour`;
    label.appendChild(makePopover(recentCountSpan, 'Tabs accessed within the last hour'));
    label.appendChild(document.createTextNode(' · '));
    const recentPctSpan = document.createElement('span');
    recentPctSpan.textContent = `${recentPct}%`;
    label.appendChild(makePopover(recentPctSpan, `${recentPct}% of all open tabs`));

    header.appendChild(chevron);
    header.appendChild(label);
    section.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'idle-group-list recent-list';
    list.style.display = 'none';
    recentTabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
    for (const tab of recentTabs) {
      list.appendChild(renderTabRow(tab, dupIds, isNeverExpire(tab)));
    }
    section.appendChild(list);

    header.addEventListener('click', () => {
      const expanded = list.style.display !== 'none';
      list.style.display = expanded ? 'none' : '';
      section.classList.toggle('is-expanded', !expanded);
    });

    container.insertBefore(section, emptyMsg);
  }

  container.scrollTop = scrollTop;
}

function activateTab(id) {
  if (IS_EXTENSION) {
    browser.tabs.update(id, { active: true }).then(() => {
      window.close();
    }).catch(err => console.error('Failed to activate tab:', err));
  } else {
    const tab = allTabs.find(t => t.id === id);
    alert(`Would switch to tab: ${tab ? tab.title : id}`);
  }
}

function closeTabs(ids) {
  if (IS_EXTENSION) {
    browser.tabs.remove(ids).then(() => {
      allTabs = allTabs.filter(t => !ids.includes(t.id));
      updateTabCount();
      renderIdleTabs();
    }).catch(err => console.error('Failed to close tabs:', err));
  } else {
    alert(`Would close ${ids.length} tabs`);
    allTabs = allTabs.filter(t => !ids.includes(t.id));
    updateTabCount();
    renderIdleTabs();
  }
}

// --- Auto-expire ---

function updateAutoExpire() {
  const on = document.getElementById('auto-expire-checkbox').checked;
  document.getElementById('auto-expire-config').classList.toggle('collapsed', !on);
  document.getElementById('auto-expire-status').textContent = on ? 'On' : 'Off';
  document.getElementById('auto-expire-section').classList.toggle('is-active', on);
  applySettings();
}

function getCurrentSettings() {
  return {
    enabled: document.getElementById('auto-expire-checkbox').checked,
    days: Number(document.getElementById('auto-expire-threshold').value),
    aggressiveDup: document.getElementById('aggressive-duplicates').checked,
  };
}

async function applySettings() {
  const current = getCurrentSettings();

  if (IS_EXTENSION) {
    await browser.storage.local.set({
      autoExpireEnabled: current.enabled,
      autoExpireThresholdDays: current.days,
      aggressiveDuplicates: current.aggressiveDup,
    });
  }

  const el = document.getElementById('changes-applied');
  el.textContent = 'Changes applied';
  setTimeout(() => { el.textContent = ''; }, 2000);
  updateNextRun();
}

// --- Next run ---

async function updateNextRun() {
  const el = document.getElementById('next-run');
  const enabled = document.getElementById('auto-expire-checkbox').checked;
  if (!enabled) {
    el.textContent = '';
    return;
  }
  if (!IS_EXTENSION) {
    el.textContent = 'Next run in 5h 30m';
    return;
  }
  const result = await browser.runtime.sendMessage({ action: 'getNextAlarm' });
  if (!result || !result.scheduledTime) {
    el.textContent = '';
    return;
  }
  const diff = result.scheduledTime - Date.now();
  if (diff <= 0) {
    el.textContent = 'Next run soon';
    return;
  }
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    el.textContent = `Next run in ${hours}h ${minutes}m`;
  } else {
    el.textContent = `Next run in ${minutes}m`;
  }
}

// --- Init ---

async function init() {
  await loadDoNotExpire();

  if (IS_EXTENSION) {
    allTabs = await browser.tabs.query({ currentWindow: true });
    pendingExpiration = await browser.runtime.sendMessage({ action: 'getPendingExpiration' }) || {};
  } else {
    allTabs = generateMockData();
    pendingExpiration = {};
  }

  updateTabCount();
  renderIdleTabs();

  // Auto-expire
  document.getElementById('auto-expire-checkbox').addEventListener('change', updateAutoExpire);
  document.getElementById('auto-expire-threshold').addEventListener('change', applySettings);
  document.getElementById('aggressive-duplicates').addEventListener('change', applySettings);

  // Load saved settings
  if (IS_EXTENSION) {
    const s = await browser.storage.local.get({
      autoExpireEnabled: false,
      autoExpireThresholdDays: 7,
      aggressiveDuplicates: true,
    });
    document.getElementById('auto-expire-checkbox').checked = s.autoExpireEnabled;
    document.getElementById('auto-expire-threshold').value = String(s.autoExpireThresholdDays);
    document.getElementById('aggressive-duplicates').checked = s.aggressiveDuplicates;
  } else {
    document.getElementById('auto-expire-checkbox').checked = true;
  }

  const on = document.getElementById('auto-expire-checkbox').checked;
  document.getElementById('auto-expire-config').classList.toggle('collapsed', !on);
  document.getElementById('auto-expire-status').textContent = on ? 'On' : 'Off';
  document.getElementById('auto-expire-section').classList.toggle('is-active', on);
  updateNextRun();
}

document.addEventListener('DOMContentLoaded', init);
