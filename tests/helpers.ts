import { type Page, expect } from "@playwright/test";

// Drives the mocked §4.3 login flow: pick a demo account → password "demo" →
// any 6-digit TOTP code → lands on /dashboard.
export async function login(page: Page, email: string) {
  await page.goto("/login");
  // Clicking the demo-account button prefills email + password=demo.
  await page.getByRole("button", { name: email }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("123456").fill("123456");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export const ACCOUNTS = {
  superAdmin: "super@legali.ai",
  operator: "ops@legali.ai",
  contentEditor: "editor@legali.ai",
  viewer: "viewer@legali.ai",
};
