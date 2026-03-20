import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, cleanupBrowser, createTestServer } from 'selenium-webext-bridge';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(__dirname, '../../src');
const EXT_ID = 'expire-tabs@seriousben';

describe('Expire Tabs smoke tests', () => {
  let browser, bridge, server;

  before(async function() {
    this.timeout = 30000;
    
    server = await createTestServer({ port: 0 });
    const port = server.address().port;

    browser = await launchBrowser({
      extensions: [EXTENSION_PATH],
      headless: process.env.HEADLESS !== '0',
      serverPort: port,
    });
    bridge = browser.testBridge;
  });

  after(async () => {
    if (browser) await cleanupBrowser(browser);
    if (server) await server.close();
  });

  it('should respond to ping', async () => {
    const response = await bridge.sendToExtension(EXT_ID, { action: 'ping' });
    assert.deepStrictEqual(response, { ok: true });
  });

  it('should list tabs', async () => {
    const tabs = await bridge.getTabs();
    assert.ok(tabs.length >= 1);
  });

  it('should create and detect a tab', async () => {
    await bridge.createTab('https://example.com');
    const tabs = await bridge.getTabs();
    const found = tabs.some(t => t.url && t.url.includes('example.com'));
    assert.ok(found, 'Should find the example.com tab');
  });
});
