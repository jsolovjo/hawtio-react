# PoC - Hawtio End-to-End Tests (Playwright)

This directory contains the new Playwright-based end-to-end tests for Hawtio. These tests replace the legacy Java-based test suite with a modern TypeScript approach.

> **Proof of Concept Status**
>
> This is currently a **PoC (Proof of Concept)** with minimal test coverage and configuration. The goal is to demonstrate:
> - How Playwright-based E2E tests can work with Hawtio
> - Solutions to the crypto API and sessionStorage challenges
> - The Page Object Model pattern and test architecture
>
> This is a **draft implementation** showing the approach and technical solutions. Full test coverage and production-ready configuration will be added in future iterations.

## Quick Start

### Prerequisites

- Node.js 20 or 22
- Yarn v4
- A running Spring Boot test application on `http://127.0.0.1:10001`

### Running Tests

```bash
# Run all tests in headless mode (automatic)
yarn test:e2e

# Run tests in UI mode (interactive, with browser)
# NOTE: This opens a popup window - you must MANUALLY click to run tests
# UI mode provides powerful debugging: step through tests, view traces, inspect DOM, etc.
yarn test:e2e:ui

# Run specific test file
yarn test:e2e tests/scenarios/examples/example.spec.ts

# Run in a specific browser
yarn test:e2e --project=chromium
yarn test:e2e --project=firefox
```

### Viewing Reports

After tests complete, view the HTML report:

```bash
yarn playwright show-report
```

## Project Structure

```
tests/
├── fixtures/
│   └── fixtures.ts              # Custom test fixtures with crypto bypass
├── pages/
│   ├── auth/
│   │   └── login-page.ts        # Page Object for login
│   └── connect/
│       └── connection-page.ts   # Page Object for connection management
├── scenarios/
│   └── examples/
│       └── example.spec.ts      # Example test scenarios
├── setup/
│   ├── auth.setup.ts            # Authentication setup (runs before tests)
│   └── .auth/                   # Generated auth state files
│       ├── user.json            # localStorage state (auto-generated)
│       └── sessionStorage.json  # sessionStorage state (auto-generated)
└── README.md                    # This file
```

## Architecture Overview

### Setup Phase (Global)

The tests use Playwright's **setup project** pattern:

1. **`auth.setup.ts`** runs first (before any test)
2. Connects to the Spring Boot app
3. Performs login
4. Saves authentication state to `.auth/` directory
5. All subsequent tests reuse this authenticated state

### Test Phase

Each test:
1. Loads the saved authentication state (both localStorage and sessionStorage)
2. Navigates directly to plugin pages (`camel`, `jmx`)
3. Runs assertions
4. Uses the crypto bypass fixture automatically

## The Crypto API Challenge

### The Problem

Hawtio stores connection credentials encrypted in the browser using the **Web Crypto API**. This works fine in normal browsers, but Playwright's test environment running on `http://localhost` (non-HTTPS) causes issues:

1. **Insecure Context**: Web Crypto API requires a "secure context" (HTTPS or localhost)
2. **Encryption/Decryption Failures**: Even with `--unsafely-treat-insecure-origin-as-secure`, crypto operations can fail intermittently
3. **No Direct API**: Playwright has no built-in way to bypass or mock the native Crypto API

### The "Hack" (Workaround)

We implemented a **failsafe crypto bypass** that intercepts `crypto.subtle.decrypt` calls:

#### How It Works

**Location**: `tests/fixtures/fixtures.ts` and `tests/setup/auth.setup.ts`

```typescript
await context.addInitScript(() => {
  if (window.crypto?.subtle?.decrypt) {
    const originalDecrypt = window.crypto.subtle.decrypt.bind(window.crypto.subtle);

    window.crypto.subtle.decrypt = async (...args: any[]) => {
      try {
        // Try real decryption first
        return await originalDecrypt(...args);
      } catch (e) {
        // If it fails, return mock credentials for testing
        console.warn('Crypto decrypt failed, returning mock credentials');
        const mockCredentials = JSON.stringify({
          username: 'hawtio',
          password: 'hawtio'
        });
        return new TextEncoder().encode(mockCredentials).buffer;
      }
    };
  }
});
```

#### Why This Works

1. **Graceful Degradation**: Real crypto is attempted first, fallback only if it fails
2. **Injected Early**: `addInitScript` runs before page loads, so it's always active
3. **Type-Safe**: Returns proper `ArrayBuffer` matching the Crypto API spec
4. **Test-Only**: Only affects the test browser context

#### Applied In Two Places

1. **`auth.setup.ts`**: Used during initial connection setup
2. **`fixtures.ts`**: Applied to all test contexts automatically

### Browser Launch Options

**Location**: `playwright.config.ts`

```typescript
launchOptions: {
  args: [
    // Treat localhost as secure for initial crypto operations
    '--unsafely-treat-insecure-origin-as-secure=http://localhost:3000,http://127.0.0.1:10001',
    // Prevents crashes in CI/Docker
    '--disable-dev-shm-usage',
  ]
}
```

## SessionStorage Persistence

### The Problem

Playwright's `storageState` feature only saves **localStorage**, not **sessionStorage**. Hawtio stores critical data in sessionStorage (like connection state), so we need to manually preserve it.

### The Solution

**In `auth.setup.ts`:**

```typescript
// 1. Capture sessionStorage manually
const popupStorage = await popup.evaluate(() => {
  const session: any = {};
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i);
    if (key) session[key] = window.sessionStorage.getItem(key);
  }
  return session;
});

// 2. Save localStorage (Playwright built-in)
await popup.context().storageState({ path: authFile });

// 3. Manually save sessionStorage to JSON file
fs.writeFileSync(
  'tests/setup/.auth/sessionStorage.json',
  JSON.stringify(popupStorage, null, 2)
);
```

**In `fixtures.ts`:**

```typescript
// 1. Load sessionStorage from JSON file
const sessionStorageData = JSON.parse(
  fs.readFileSync('tests/setup/.auth/sessionStorage.json', 'utf-8')
);

// 2. Restore it in every test context
await context.addInitScript((sessionData) => {
  Object.keys(sessionData).forEach(key => {
    window.sessionStorage.setItem(key, sessionData[key]);
  });
}, sessionStorageData);
```

## Page Object Model

We use the **Page Object Model** pattern to keep tests clean and maintainable.

### Example: ConnectionPage

**File**: `tests/pages/connect/connection-page.ts`

```typescript
export class ConnectionPage {
  readonly page: Page;
  readonly addConnectionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addConnectionButton = page.getByRole('button', { name: 'Add connection' });
  }

  async addConnection(config: { name: string; host: string; /* ... */ }) {
    await this.addConnectionButton.click();
    // ... fill form
  }
}
```

### Benefits

- **Reusable**: One place to update selectors
- **Type-Safe**: TypeScript catches errors
- **Readable**: `connectionPage.addConnection()` vs raw Playwright calls

## Writing New Tests

### 1. Import Custom Fixtures

**Always use the custom `test` and `expect` from fixtures:**

```typescript
import { test, expect } from '../../fixtures/fixtures';
```

**DO NOT** use:
```typescript
import { test, expect } from '@playwright/test'; // Missing crypto bypass
```

### 2. Navigate to Plugin Pages

**DO**: Navigate directly to plugins
```typescript
await page.goto('camel');  // Uses existing connection
await page.goto('jmx');    // Uses existing connection
```

**DON'T**: Navigate to root (shows Connect page)
```typescript
await page.goto('/');      // Shows Connect page, not plugin
```

### 3. Use Page Objects

```typescript
import { ConnectionPage } from '../../pages/connect/connection-page';

test('example', async ({ page }) => {
  const connectionPage = new ConnectionPage(page);
  await connectionPage.addConnection({ /* config */ });
});
```

### 4. Example Test

```typescript
import { test, expect } from '../../fixtures/fixtures';

test('verify Camel routes are visible', async ({ page }) => {
  await page.goto('camel');

  await expect(page.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('route1');
});
```

## Configuration

### `playwright.config.ts`

Key settings:

```typescript
{
  testDir: './tests',                                // Test location
  baseURL: 'http://localhost:3000/hawtio/',          // Base for relative URLs
  timeout: 60_000,                                   // Test timeout (60s)
  retries: process.env.CI ? 2 : 1,                   // Retry flaky tests
  workers: process.env.CI ? 2 : undefined,           // Parallel workers

  webServer: {
    command: 'yarn start',                           // Auto-start dev server
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,            // Use existing in dev
    timeout: 180000                                  // 3min startup timeout
  },

  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },   // Runs first
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],                       // Waits for setup
      use: {
        storageState: 'tests/setup/.auth/user.json'
      }
    },
    // ... firefox project
  ]
}
```

## Troubleshooting

### Tests fail with "OperationError: Decryption failed"

**Cause**: Crypto bypass not applied

**Fix**: Ensure you're importing from `../../fixtures/fixtures`, not `@playwright/test`

### Tests fail with "Cannot find connection"

**Cause**: sessionStorage not restored

**Fix**:
1. Delete `.auth/` directory
2. Run `yarn test:e2e` to regenerate auth state
3. Check that `sessionStorage.json` exists

### Tests time out on startup

**Cause**: Dev server not starting

**Fix**:
1. Check if something is already running on port 3000
2. Increase `webServer.timeout` in config
3. Manually start server: `yarn start`, then run tests with existing server

### Setup project fails

**Cause**: Spring Boot test app not running

**Fix**: Start the test application on `http://127.0.0.1:10001`

### Browser crashes in CI

**Cause**: Resource limits (Docker/GitHub Actions)

**Fix**: Already handled via `--disable-dev-shm-usage` in config

## CI Integration

Tests are designed to run in GitHub Actions:

- **Automatic retries**: Flaky tests retry 2x in CI
- **Limited workers**: Only 2 parallel workers in CI (vs unlimited locally)
- **GitHub reporter**: Nice annotations on failed tests
- **Video/screenshots**: Captured on failure for debugging

## Next Steps

- [ ] Add more page objects for JMX, Camel, etc.
- [ ] Add visual regression tests
- [ ] Add API mocking for isolated tests
- [ ] Add mobile viewport tests
- [ ] Integrate with existing CI pipeline

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
