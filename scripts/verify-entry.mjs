// Run against a local/export preview. This suite never sends email or creates
// an account. It verifies the public boundary before the private practice.
import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";

const base = process.env.UI_BASE_URL || "http://localhost:4173";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }),
});
try {
  const context = await browser.newContext();
  // Guests have no reason to contact the production backend during this test.
  await context.route("https://*.supabase.co/**", (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(base);
    await expect(
      page.getByRole("heading", { name: "Show up for what matters." }),
    ).toBeVisible();
    for (const [label, title] of [
      ["Page 2: a few minutes, then go live", "One intention. A real day."],
      ["Page 3: make room for possibility", "Find what feels like you."],
      ["Page 4: your first small step", "I will be more me."],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      const cta = page.getByRole("button", {
        name: "Join the beta",
        exact: true,
      });
      const box = await cta.boundingBox();
      assert(box && box.y >= 0 && box.y + box.height <= viewport.height);
    }
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Join the beta", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Create your account.", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send me a sign-in link", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Continue on this device",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Read the privacy note", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your own space.", exact: true }),
    ).toBeVisible();
  }
  for (const path of [
    "/onboarding",
    "/ritual",
    "/reflect",
    "/galaxy",
    "/chloe",
    "/why",
  ]) {
    await page.goto(base + path);
    await expect(
      page.getByRole("textbox", { name: "EMAIL", exact: true }),
    ).toBeVisible();
    assert.equal(new URL(page.url()).pathname, "/account");
    assert.equal(new URL(page.url()).searchParams.get("returnTo"), path);
    await expect(
      page.getByRole("button", { name: "Let's begin", exact: true }),
    ).toHaveCount(0);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS public introduction, persistent CTA, privacy, and account-before-questions",
  );
} finally {
  await browser.close();
}
