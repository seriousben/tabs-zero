# Tabs Zero

Tabs pile up. That Reddit thread from 9 days ago, the Google search you already got your answer from, the YouTube video you finished last week. They sit there taking up memory and cluttering your tab bar.

Tabs Zero finds the ones you haven't touched in hours or days, groups them by age, and lets you close them in one click per group. Turn on auto-expire and it cleans them up on a schedule. Every step is visible: you see what's marked, when it will close, and what's protected. Pinned tabs, playing audio, and anything you shield stay put.

<p align="center">
  <img src="docs/screenshot-light.png#gh-light-mode-only" alt="Tabs Zero showing idle tabs grouped by age" width="400">
  <img src="docs/screenshot-dark.png#gh-dark-mode-only" alt="Tabs Zero showing idle tabs grouped by age" width="400">
</p>

## How It Works

Open the extension and you see every idle tab sorted into time buckets: more than 7 days, 3 days, 1 day, 6 hours, or 1 hour. Each group shows a tab count, what percentage of your total tabs it represents, and a close button. You always know exactly where the clutter is.

### Auto-Expire

Turn on auto-expire and Tabs Zero closes stale tabs for you. Configure it to match how you browse:

- **Threshold**: 3 hours, 6 hours, 12 hours, 1 day, 3 days, 7 days, 14 days, or 30 days
- **Duplicate cleanup**: Older copies of the same URL expire at half the threshold (on by default)
- **Schedule**: Periodic checks run automatically. Next run time shown in the popup.

Pending expirations show a red countdown badge so you can see what's about to go and intervene if needed.

### Nothing Closes Without Warning

Auto-expire uses a two-pass system so nothing disappears on you:

1. Tabs that cross the threshold are **marked** and you get a notification listing them.
2. After a **1-hour grace period**, marked tabs are closed, but only if the browser is active.

If you visit a marked tab during that hour, it resets. No tab is ever silently removed.

### Keep What Matters

- **Pinned tabs** never expire
- **Active tab** never expires
- **Tabs playing audio** never expire
- **Shield icon** in the popup protects individual tabs
- **Right-click any tab** and select "Do not expire" from the context menu
- Protected tabs show a green border so you can see them at a glance

### Duplicate Detection

Tabs Zero spots duplicate URLs across your open tabs and marks them with an orange badge. With "Close duplicate tabs twice as fast" enabled (on by default), older copies of the same page expire at half the threshold.

### Tree Style Tab Integration

If you use [Tree Style Tab](https://addons.mozilla.org/en-US/firefox/addon/tree-style-tab/), Tabs Zero integrates with it: sidebar dimming for tabs about to expire, and proper cleanup on close. Works fine without TST too.

## Privacy and Permissions

Tabs Zero makes **zero network requests**. No telemetry, no analytics, no data leaves your browser. There is no remote server. You can verify this in the source: there are no `fetch`, `XMLHttpRequest`, or `sendBeacon` calls anywhere in the codebase.

All data is stored locally via `browser.storage.local`:

| Data | Purpose |
|------|---------|
| Settings (threshold, toggle state) | Remember your configuration |
| Do-not-expire URL list | Persist tab protection across restarts |
| Pending expiration timestamps | Track the two-pass grace period |

Here is why each permission is needed:

| Permission | Reason |
|------------|--------|
| `tabs` | Read tab URLs, titles, and last-accessed times to classify idle tabs |
| `storage` | Save settings and protected tab list locally |
| `alarms` | Schedule periodic auto-expire checks |
| `notifications` | Warn you before tabs are closed |
| `menus` | Add "Do not expire" to the right-click tab menu |
| `idle` | Detect whether the browser is active before closing anything |

The entire extension is 4 source modules and ~400 lines of logic. Small enough to audit in one sitting.

## Install

**Temporary (development):**

1. Go to `about:debugging` > This Firefox > Load Temporary Add-on
2. Select `src/manifest.json`

**Permanent:**

1. `npm run build`
2. Upload `web-ext-artifacts/*.zip` to addons.mozilla.org for signing
3. Install the signed `.xpi`

## Development

```
npm install
npm run test:unit     # unit tests via vitest
npm run lint          # web-ext lint
npm run build         # package .zip
```

Open `src/popup.html` directly in a browser to preview the UI with mock data.

Generate screenshots:

```
npm run screenshot    # requires playwright
```

## License

MIT
