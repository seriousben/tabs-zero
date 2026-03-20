# Integration Tests

Headless integration tests using selenium-webext-bridge.

## Requirements

- **Port 8080 must be available** - selenium-webext-bridge hardcodes this port for the test server
- Firefox must be installed
- geckodriver must be installed (included in devDependencies)

## Running

```bash
npm run test:integration
```

Or with custom headless setting:

```bash
HEADLESS=1 node --test tests/integration/smoke.test.js
HEADLESS=0 node --test tests/integration/smoke.test.js  # visible browser
```

## Troubleshooting

If you see "EADDRINUSE: address already in use 127.0.0.1:8080", another process is using port 8080.

Find and stop it:
```bash
lsof -i :8080
kill <PID>
```
