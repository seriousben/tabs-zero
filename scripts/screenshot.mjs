import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const popupPath = path.resolve(__dirname, '../src/popup.html');

async function screenshotPopup(colorScheme, outputName) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 440, height: 1200 },
    deviceScaleFactor: 2,
    colorScheme,
  });
  const page = await context.newPage();

  // Override the fixed popup height for full-content screenshot
  await page.addStyleTag({ content: '.popup { height: auto !important; }' });
  await page.goto(`file://${popupPath}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: '.popup { height: auto !important; }' });
  await page.waitForTimeout(100);

  const box = await page.locator('.popup').boundingBox();

  await page.screenshot({
    path: path.resolve(__dirname, '../docs', outputName),
    clip: { x: box.x, y: box.y, width: box.width, height: box.height + 4 },
  });

  await browser.close();
}

await screenshotPopup('light', 'screenshot-light.png');
await screenshotPopup('dark', 'screenshot-dark.png');
console.log('Screenshots saved to docs/');
