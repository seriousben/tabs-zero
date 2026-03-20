'use strict';

// TST integration

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

let tstAvailable = false;

async function registerToTST() {
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self',
      name: 'Tabs Zero',
      icons: browser.runtime.getManifest().icons,
      listeningTypes: ['wait-for-shutdown'],
      allowBulkMessaging: true,
      style: `
        .tab.expiring-soon .label-content {
          opacity: 0.5;
        }
      `,
    });
    tstAvailable = true;
  } catch (e) {
    tstAvailable = false;
  }
}

async function isTSTAvailable() {
  try {
    const result = await browser.runtime.sendMessage(TST_ID, { type: 'ping' });
    tstAvailable = !!result;
    return tstAvailable;
  } catch (e) {
    tstAvailable = false;
    return false;
  }
}

async function grantRemoval(tabIds) {
  if (!tstAvailable || tabIds.length === 0) return;
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'grant-to-remove-tabs',
      tabs: tabIds,
    });
  } catch (e) {
    // TST not available, proceed without grant
  }
}

async function markExpiringSoon(tabIds) {
  if (!tstAvailable || tabIds.length === 0) return;
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'add-tab-state',
      tabs: tabIds,
      state: 'expiring-soon',
    });
  } catch (e) {
    // ignore
  }
}

async function clearExpiringSoon(tabIds) {
  if (!tstAvailable || tabIds.length === 0) return;
  try {
    await browser.runtime.sendMessage(TST_ID, {
      type: 'remove-tab-state',
      tabs: tabIds,
      state: 'expiring-soon',
    });
  } catch (e) {
    // ignore
  }
}

function handleTSTMessage(message) {
  if (!message) return;
  switch (message.type) {
    case 'ready':
      registerToTST();
      break;
    case 'wait-for-shutdown':
      return new Promise(() => {
        // Resolved when extension unloads
        window.addEventListener('beforeunload', () => {});
      });
  }
}

// Initial registration
registerToTST();
