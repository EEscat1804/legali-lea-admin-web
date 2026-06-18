import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "./helpers";

test.describe("Auth flow (PRD §4.3)", () => {
  test("unauthenticated visit to a protected page redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("email/password → TOTP → dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: ACCOUNTS.superAdmin }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    // TOTP step appears
    await expect(page.getByText(/two-factor authentication/i)).toBeVisible();
    await page.getByPlaceholder("123456").fill("000111");
    await page.getByRole("button", { name: /verify/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /platform analytics/i })).toBeVisible();
  });

  test("a non-numeric TOTP code is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: ACCOUNTS.operator }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("123456").fill("abc");
    await page.getByRole("button", { name: /verify/i }).click();
    await expect(page).toHaveURL(/\/login/);
    // Exact match targets the rose-coloured validation error, not the heading/help text.
    await expect(page.getByText("Enter the 6-digit code from your authenticator.", { exact: true })).toBeVisible();
  });

  test("sign out returns to /login", async ({ page }) => {
    await login(page, ACCOUNTS.superAdmin);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
