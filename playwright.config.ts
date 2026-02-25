// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directory containing your test files
  testDir: './tests',

  // Run tests in parallel for faster execution
  fullyParallel: true,

  // Fail the build if you accidentally left test.only in the code
  forbidOnly: !!process.env.CI,

  // Timeout
  timeout: 60_000,

  // Expect timeout
  expect: {
    timeout: 10_000,
  },

  // Retry failed tests - helpful in CI where flakiness can occur
  retries: process.env.CI ? 2 : 1,

  // Limit parallel workers in CI to avoid resource issues
  workers: process.env.CI ? 2 : undefined,

  // GLocal dev keeps HTML report and GitHub Actions gets nice annotations
  reporter: process.env.CI ? [['list'], ['github']] : 'html',

  // Shared settings for all projects
  use: {
    // Base URL for navigation - use relative URLs in tests
    baseURL: 'http://localhost:3000/hawtio/',

    launchOptions: {
      args: [
        //  Even with crypto bypass, Hawtio needs the origin to be "secure" for initial crypto operations during login/setup
        '--unsafely-treat-insecure-origin-as-secure=http://localhost:3000,http://127.0.0.1:10001',
        // Prevents crashes in resource-constrained environments (CI/Docker)
        '--disable-dev-shm-usage',
      ],
    },

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video on failure for debugging
    video: 'retain-on-failure',

    // Collect trace on first retry for debugging flaky tests
    trace: 'on-first-retry',
  },

  // Configure browsers to test against
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/setup/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'tests/setup/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'yarn start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180000
  }
});
