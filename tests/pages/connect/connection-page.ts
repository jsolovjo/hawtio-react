import { expect, type Locator, type Page } from '@playwright/test';

export class ConnectionPage {
  readonly page: Page;
  readonly addConnectionButton: Locator;
  readonly connectionNameInput: Locator;
  readonly schemeToggle: Locator;
  readonly hostInput: Locator;
  readonly portInput: Locator;
  readonly pathInput: Locator;
  readonly addButton: Locator;
  readonly connectButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addConnectionButton = page.getByRole('button', { name: 'Add connection', exact: true});
    this.connectionNameInput = page.locator('#connection-form-name');
    this.schemeToggle = page.locator('.pf-v6-c-switch__toggle');
    this.hostInput = page.locator('#connection-form-host');
    this.portInput = page.locator('#connection-form-port');
    this.pathInput = page.locator('#connection-form-path');
    this.addButton = page.getByRole('button', { name: 'Add', exact: true });
    this.connectButton = page.getByRole('button', { name: 'Connect', exact: true});
  }

  async goto() {
    await this.page.goto('/');
  }

  async addConnection(config: {
    name: string;
    host: string;
    port: string;
    path: string
  }) {
    await this.addConnectionButton.click();
    await this.connectionNameInput.fill(config.name);
    await this.schemeToggle.click();
    await this.hostInput.fill(config.host);
    await this.portInput.fill(config.port);
    await this.pathInput.fill(config.path);
    await this.addButton.click();
  }

  async waitForConnectionOnline(timeout = 30000) {
    await expect(this.connectButton).toBeEnabled({ timeout});
  }

  async connectToConnection() {
    const popupPromise = this.page.context().waitForEvent('page');
    await this.connectButton.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    return popup;
  }
}
