'use strict';

// Globals from tst.js (loaded first via manifest background.scripts):
// TST_ID, registerToTST, handleTSTMessage, grantRemoval,
// markExpiringSoon, clearExpiringSoon, isTSTAvailable

// Default settings
const DEFAULTS = {
  autoExpireEnabled: false,
  autoExpireThresholdDays: 7,
  aggressiveDuplicates: true,
  checkIntervalHours: 6,
};

// --- Settings ---

async function getSettings() {
  return browser.storage.local.get(DEFAULTS);
}

// --- Do Not Expire ---

let doNotExpireUrls = new Set();

async function loadDoNotExpire() {
  const data = await browser.storage.local.get({ doNotExpireUrls: [] });
  doNotExpireUrls = new Set(data.doNotExpireUrls);
}

async function toggleDoNotExpire(url) {
  if (doNotExpireUrls.has(url)) {
    doNotExpireUrls.delete(url);
  } else {
    doNotExpireUrls.add(url);
  }
  await browser.storage.local.set({ doNotExpireUrls: [...doNotExpireUrls] });
  updateContextMenu();
}

// --- Tab classification ---

function isSystemTab(tab) {
  if (!tab.url) return false;
  // about:newtab and about:blank are not system tabs; they can be expired
  if (tab.url === 'about:newtab' || tab.url === 'about:blank') return false;
  return tab.url.startsWith('about:') || tab.url.startsWith('moz-extension:') || tab.url.startsWith('chrome:');
}

function isProtected(tab) {
  return tab.pinned || tab.active || tab.audible || isSystemTab(tab) || doNotExpireUrls.has(tab.url);
}

function normalizeUrl(url) {
  return url && url.endsWith('/') ? url.slice(0, -1) : url;
}

// --- Expiration logic ---

async function getExpirableTabs() {
  const settings = await getSettings();
  const tabs = await browser.tabs.query({});
  const thresholdMs = settings.autoExpireThresholdDays * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const expirable = tabs.filter(tab => !isProtected(tab));

  // Find duplicate IDs (older copies) by URL + title
  const dupIds = new Set();
  if (settings.aggressiveDuplicates) {
    const byKey = new Map();
    for (const tab of expirable) {
      if (!tab.url || tab.url.startsWith('about:')) continue;
      const key = normalizeUrl(tab.url) + '\0' + (tab.title || '');
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(tab);
    }
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => b.lastAccessed - a.lastAccessed);
      for (let i = 1; i < group.length; i++) dupIds.add(group[i].id);
    }
  }

  const result = [];
  for (const tab of expirable) {
    const age = now - tab.lastAccessed;
    const isDup = dupIds.has(tab.id);
    const effectiveThreshold = isDup ? thresholdMs * 0.5 : thresholdMs;
    if (age > effectiveThreshold) {
      result.push({ id: tab.id, title: tab.title, url: tab.url, age, reason: isDup ? 'duplicate' : 'stale' });
    }
  }

  result.sort((a, b) => b.age - a.age);
  return result;
}

// --- Two-pass expiration ---
// Pass 1: mark tabs as "expiring soon" with a timestamp
// Pass 2: close tabs that have been marked for 1+ hour AND browser is active

const MARK_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

async function loadPendingExpiration() {
  const data = await browser.storage.local.get({ pendingExpiration: {} });
  return data.pendingExpiration; // { tabId: markedAt timestamp }
}

async function savePendingExpiration(pending) {
  await browser.storage.local.set({ pendingExpiration: pending });
}

async function clearAllPending() {
  const pending = await loadPendingExpiration();
  const ids = Object.keys(pending).map(Number);
  if (ids.length > 0) {
    await clearExpiringSoon(ids);
  }
  await savePendingExpiration({});
}

async function clearPendingForTab(tabId) {
  const pending = await loadPendingExpiration();
  if (pending[tabId]) {
    delete pending[tabId];
    await savePendingExpiration(pending);
    await clearExpiringSoon([tabId]);
  }
}

// Clear pending when a tab is activated (user interacted with it)
browser.tabs.onActivated.addListener((activeInfo) => {
  clearPendingForTab(activeInfo.tabId).catch(e => console.error('clearPending on activate:', e));
});

// Clear pending when a tab is updated (navigated)
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.audible) {
    clearPendingForTab(tabId).catch(e => console.error('clearPending on update:', e));
  }
});

async function runAutoExpire(force = false) {
  if (!force) {
    const settings = await getSettings();
    if (!settings.autoExpireEnabled) return;
  }

  // Check if browser is active
  const idleState = await browser.idle.queryState(60);
  if (idleState !== 'active' && !force) return;

  const toExpire = await getExpirableTabs();
  if (toExpire.length === 0) {
    // Clear any stale pending entries
    await savePendingExpiration({});
    await clearExpiringSoon([]);
    return;
  }

  const now = Date.now();
  const pending = await loadPendingExpiration();
  const expirableIds = new Set(toExpire.map(t => t.id));

  // Clean up pending entries for tabs no longer expirable
  for (const id of Object.keys(pending)) {
    if (!expirableIds.has(Number(id))) delete pending[id];
  }

  // Pass 1: mark new tabs as pending
  const newlyMarked = [];
  for (const entry of toExpire) {
    if (!pending[entry.id]) {
      pending[entry.id] = now;
      newlyMarked.push(entry.id);
    }
  }

  // Pass 2: close tabs marked for longer than grace period
  const readyToClose = [];
  for (const entry of toExpire) {
    const markedAt = pending[entry.id];
    if (markedAt && (now - markedAt) >= MARK_GRACE_PERIOD_MS) {
      readyToClose.push(entry.id);
    }
  }

  // Update TST visual state
  const allPendingIds = Object.keys(pending).map(Number);
  await markExpiringSoon(allPendingIds);

  // Save pending state
  await savePendingExpiration(pending);

  if (readyToClose.length > 0) {
    // Remove closed tabs from pending
    for (const id of readyToClose) delete pending[id];
    await savePendingExpiration(pending);

    await grantRemoval(readyToClose);
    await browser.tabs.remove(readyToClose);
    await clearExpiringSoon(readyToClose);

    browser.notifications.create({
      type: 'basic',
      title: 'Expire Tabs',
      message: `Closed ${readyToClose.length} idle tab${readyToClose.length !== 1 ? 's' : ''}.`,
    });
  } else if (newlyMarked.length > 0) {
    browser.notifications.create({
      type: 'basic',
      title: 'Expire Tabs',
      message: `${allPendingIds.length} tab${allPendingIds.length !== 1 ? 's' : ''} marked for expiration. Will close in 1 hour.`,
    });
  }
}

// --- Alarm ---

async function setupAlarm() {
  const settings = await getSettings();
  await browser.alarms.clear('autoExpire');
  if (settings.autoExpireEnabled) {
    browser.alarms.create('autoExpire', {
      // Check more frequently since we now have a two-pass system
      periodInMinutes: Math.min(settings.checkIntervalHours * 60, 30),
    });
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoExpire') {
    runAutoExpire();
  }
});

// Re-setup alarm when settings change, clear pending when disabled, sync doNotExpire
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.autoExpireEnabled || changes.checkIntervalHours) {
    setupAlarm();
    if (changes.autoExpireEnabled && !changes.autoExpireEnabled.newValue) {
      clearAllPending();
    }
  }
  if (changes.doNotExpireUrls) {
    doNotExpireUrls = new Set(changes.doNotExpireUrls.newValue || []);
  }
});

// --- Message handlers ---

browser.runtime.onMessage.addListener((msg, sender) => {
  try {
    switch (msg.action) {
      case 'ping':
        return Promise.resolve({ ok: true });
      case 'getSettings':
        return getSettings();
      case 'getExpirableTabs':
        return getExpirableTabs();
      case 'getNextAlarm':
        return browser.alarms.get('autoExpire').then(alarm => ({
          scheduledTime: alarm ? alarm.scheduledTime : null,
        }));
      case 'previewAutoExpire':
        return getExpirableTabs().then(tabs => ({ count: tabs.length, tabs }));
      case 'getPendingExpiration':
        return loadPendingExpiration();
      case 'runAutoExpireNow':
        return runAutoExpire(true).then(() => ({ ok: true }));
      case 'closeTabs':
        return grantRemoval(msg.tabIds)
          .then(() => browser.tabs.remove(msg.tabIds))
          .then(() => ({ closed: msg.tabIds.length }))
          .catch(e => ({ error: e.message }));
      case 'toggleDoNotExpire':
        return toggleDoNotExpire(msg.url).then(() => ({ ok: true }));
      case 'getDoNotExpireUrls':
        return Promise.resolve({ urls: [...doNotExpireUrls] });
      default:
        return Promise.resolve({ error: 'unknown action' });
    }
  } catch (e) {
    return Promise.resolve({ error: e.message });
  }
});

// External messages (from test bridge and other extensions)
browser.runtime.onMessageExternal.addListener((msg, sender) => {
  // Handle TST messages
  if (sender.id === TST_ID) {
    return handleTSTMessage(msg);
  }
  
  switch (msg.action) {
    case 'ping':
      return Promise.resolve({ ok: true });
    case 'getSettings':
      return getSettings();
    case 'getExpirableTabs':
      return getExpirableTabs();
    default:
      return Promise.resolve({ error: 'unknown action' });
  }
});

// --- Context menu ---

browser.menus.create({
  id: 'toggle-do-not-expire',
  title: 'Do not expire this tab',
  contexts: ['tab'],
});

function updateContextMenu(tab) {
  if (!tab || !tab.url) return;
  const isProtectedUrl = doNotExpireUrls.has(tab.url);
  browser.menus.update('toggle-do-not-expire', {
    title: isProtectedUrl ? '✓ Do not expire this tab' : 'Do not expire this tab',
  });
}

browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'toggle-do-not-expire' && tab && tab.url) {
    toggleDoNotExpire(tab.url);
  }
});

browser.menus.onShown.addListener((info, tab) => {
  if (info.contexts.includes('tab')) {
    updateContextMenu(tab);
    browser.menus.refresh();
  }
});

// --- Init ---

loadDoNotExpire().then(() => {
  setupAlarm();
  console.log('Tabs Zero background loaded');
});
