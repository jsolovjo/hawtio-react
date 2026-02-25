import { test as base } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load sessionStorage data from setup
let sessionStorageData = {};
try {
  const sessionStoragePath = path.join(__dirname, '../setup/.auth/sessionStorage.json');
  const data = fs.readFileSync(sessionStoragePath, 'utf-8');
  sessionStorageData = JSON.parse(data);
} catch (e) {
  console.warn('[FIXTURES] Warning: sessionStorage file not found. Run setup first.');
}

// Extend base test to apply crypto bypass and restore sessionStorage
export const test = base.extend({
  context: async ({ context }, use) => {
    // CRITICAL: Apply crypto bypass for Hawtio's encrypted credentials
    await context.addInitScript(() => {
      // Guard: Only apply if crypto API is available
      if (window.crypto?.subtle?.decrypt) {
        const originalDecrypt = window.crypto.subtle.decrypt.bind(window.crypto.subtle);

        window.crypto.subtle.decrypt = async (...args: any[]) => {
          try {
            return await originalDecrypt(...args);
          } catch (e) {
            // Fallback for test environment when crypto fails
            const mockCredentials = JSON.stringify({
              username: 'hawtio',
              password: 'hawtio'
            });
            return new TextEncoder().encode(mockCredentials).buffer;
          }
        };
      }
    });

    // CRITICAL: Restore sessionStorage (Playwright's storageState doesn't save this)
    await context.addInitScript((sessionData) => {
      if (sessionData && typeof sessionData === 'object') {
        try {
          Object.keys(sessionData).forEach(key => {
            window.sessionStorage.setItem(key, sessionData[key]);
          });
        } catch (e) {
          // Ignore: sessionStorage not accessible (e.g., about:blank, cross-origin)
        }
      }
    }, sessionStorageData);

    await use(context);
  },
});

export { expect } from '@playwright/test';
