import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#connect-login-form-username');
    this.passwordInput = page.locator('#connect-login-form-password');
    this.loginButton = page.getByRole('button', { name: 'Log in', exact: true});
    this.cancelButton = page.getByRole('button', { name: 'Cancel', exact: true});
  }

  async login(username: string, password: string) {
    await expect(this.usernameInput).toBeVisible({ timeout: 10000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
