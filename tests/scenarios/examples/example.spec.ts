import { test, expect } from '../../fixtures/fixtures';

// All tests start with storageState loaded (connection already configured)
// Navigate directly to plugin pages ('camel', 'jmx') to use the connection
// Avoid navigating to root ('') which shows the Connect page
// Note: Use relative paths without leading slash (baseURL is http://localhost:3000/hawtio)

test('has correct title', async ({ page }) => {
  // Navigate directly to Camel (connection from storageState + sessionStorage will be used)
  await page.goto('camel', { waitUntil: 'networkidle' });

  await expect(page).toHaveTitle(/Hawtio Management Console/);
});

test('can see Camel page', async ({ page }) => {
  // Navigate directly to Camel plugin
  await page.goto('camel');

  // Verify we're on the Camel page (not the Connect page)
  await expect(page).toHaveURL(/.*\/hawtio\/camel.*/);

  // Add your Camel-specific assertions here
  // For example:
  // await expect(page.getByText('Routes')).toBeVisible();
});

test('can navigate to JMX', async ({ page }) => {
  // Navigate directly to JMX plugin
  await page.goto('jmx');

  // Verify we're on the JMX page
  await expect(page).toHaveURL(/.*\/hawtio\/jmx.*/);

  // Add your JMX-specific assertions here
  // For example:
  // await expect(page.getByRole('tree')).toBeVisible();
});

test('sidebar navigation works', async ({ page }) => {
  // Navigate to Camel first
  await page.goto('camel');

  // The navigation sidebar should be visible - use role to be specific
  await expect(page.getByRole('link', { name: 'Camel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'JMX' })).toBeVisible();
});
