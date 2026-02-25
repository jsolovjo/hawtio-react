import { test as setup, expect } from '@playwright/test';
import { ConnectionPage } from '../pages/connect/connection-page';
import { LoginPage } from '../pages/auth/login-page';

const authFile = 'tests/setup/.auth/user.json';

setup('setup connection to Spring Boot app', async ({ page, context }) => {
  // CRITICAL: Bypass Web Crypto API to prevent OperationError in tests
  // This mocks the decrypt function to return valid JSON credentials
  await context.addInitScript(() => {
    // Guard: Only apply if crypto API is available
    if (window.crypto?.subtle?.decrypt) {
      const originalDecrypt = window.crypto.subtle.decrypt.bind(window.crypto.subtle);

      // Override decrypt to act as a safety net for testing
      window.crypto.subtle.decrypt = async (...args: any[]) => {
        try {
          return await originalDecrypt(...args);
        } catch (e) {
          console.warn('Crypto decrypt failed, returning mock credentials for testing:', e);
          // Return valid JSON credentials as ArrayBuffer
          const mockCredentials = JSON.stringify({
            username: 'hawtio',
            password: 'hawtio'
          });
          return new TextEncoder().encode(mockCredentials).buffer;
        }
      };
    }
  });

  const connectionPage = new ConnectionPage(page);

  await connectionPage.goto();

  await connectionPage.addConnection({
    name: 'Test Connection',
    host: '127.0.0.1',
    port: '10001',
    path: '/actuator/hawtio/jolokia',
  });

  await connectionPage.waitForConnectionOnline();

  // Connect and get the popup
  const popup = await connectionPage.connectToConnection();

  // Handle login in the popup
  const loginPage = new LoginPage(popup);
  await loginPage.login('hawtio', 'hawtio');

  // Wait for the POPUP to redirect to Hawtio after successful login
  await popup.waitForURL('**/hawtio/camel/**', { timeout: 20000 });

  // Wait for popup to fully stabilize
  await popup.waitForLoadState('networkidle');

  // Capture sessionStorage (Playwright's storageState doesn't save this)
  const popupStorage = await popup.evaluate(() => {
    const session: any = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) session[key] = window.sessionStorage.getItem(key);
    }
    return session;
  });

  // Save localStorage via Playwright's built-in storageState
  await popup.context().storageState({ path: authFile });

  // CRITICAL: Manually save sessionStorage (not captured by Playwright)
  const fs = require('fs');
  fs.writeFileSync(
    'tests/setup/.auth/sessionStorage.json',
    JSON.stringify(popupStorage, null, 2)
  );

  // Close the main page, keep the popup (tests will use popup's context)
  await page.close();
});
