import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "./helpers";

// RBAC matrix (PRD §2) as reflected in the sidebar. The nav is filtered by the
// signed-in role's read capabilities (src/lib/nav.ts + src/lib/rbac.ts).
test.describe("RBAC — sidebar visibility (PRD §2)", () => {
  test("Super Admin sees all feature areas", async ({ page }) => {
    await login(page, ACCOUNTS.superAdmin);
    const nav = page.locator("aside");
    for (const label of ["Analytics", "Users", "Counselors", "Content", "Subscriptions", "Feedback", "Resources", "Feature Data", "System", "Audit Log"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("Content Editor sees only Analytics, Content, Resources", async ({ page }) => {
    await login(page, ACCOUNTS.contentEditor);
    const nav = page.locator("aside");
    await expect(nav.getByRole("link", { name: "Content" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Resources" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Analytics" })).toBeVisible();
    // Areas the Content Editor must NOT see:
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Subscriptions" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "System" })).toHaveCount(0);
  });

  test("Viewer can read the audit log", async ({ page }) => {
    await login(page, ACCOUNTS.viewer);
    await page.getByRole("link", { name: "Audit Log" }).click();
    await expect(page).toHaveURL(/\/audit/);
    await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
  });
});
