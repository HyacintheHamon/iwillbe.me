import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const root = process.env.UI_ARTIFACT_DIR || "test-results/auth";
const baseURL = process.env.UI_BASE_URL || "http://localhost:8081";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: "America/New_York",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-19T12:00:00Z",
};
const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
const session = {
  access_token: jwt,
  refresh_token: "fixture-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
const profile = {
  display_name: "Account name",
  north_star: "",
  values: ["Patience"],
  interests: [],
  onboarded: true,
  timezone: "America/New_York",
  morning_time: "08:00",
  evening_time: "20:30",
};
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const local = {
  profile: { ...profile, display_name: "Local name" },
  intentions: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      day: today,
      action: "Local conflicting intention",
      value: "Kindness",
      person: "Sam",
      created_at: new Date().toISOString(),
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      day: "2026-10-01",
      action: "Local earlier intention",
      value: "Connection",
      person: "Sam",
      created_at: "2026-10-01T12:00:00Z",
    },
  ],
  checkIns: [],
  memories: [],
  messages: [],
};
let account = {
  profile,
  intentions: [
    {
      ...local.intentions[0],
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      action: "Account intention",
    },
  ],
  checkIns: [],
  memories: [],
  messages: [],
};
let importCalls = 0,
  emailCalls = 0,
  chatCalls = 0;
await context.route(
  "https://mvhqovdznrzoduntyryh.supabase.co/**",
  async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const respond = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (req.method() === "OPTIONS") return respond({});
    if (url.pathname === "/auth/v1/otp") {
      emailCalls++;
      const body = req.postDataJSON();
      assert.equal(body.email, "fixture@example.test");
      assert.equal(url.searchParams.get("redirect_to"), baseURL + "/account");
      return respond({});
    }
    if (url.pathname === "/auth/v1/token") return respond(session);
    if (url.pathname === "/auth/v1/user") return respond(user);
    if (url.pathname === "/auth/v1/logout") return respond({});
    if (url.pathname === "/rest/v1/rpc/import_local_practice") {
      importCalls++;
      assert.deepEqual(
        req.postDataJSON().practice.intentions,
        local.intentions,
      );
      if (importCalls === 1)
        return respond({ message: "Fixture offline" }, 503);
      account.intentions.push(local.intentions[1]);
      return respond({ imported: 1, skipped_days: [today] });
    }
    if (url.pathname === "/functions/v1/chloe") {
      chatCalls++;
      return respond(
        { code: "AI_NOT_CONFIGURED", error: "Fixture: unavailable" },
        503,
      );
    }
    const table = url.pathname.split("/").pop();
    if (table === "profiles") return respond(account.profile);
    if (table === "intentions") return respond(account.intentions);
    if (table === "check_ins") return respond(account.checkIns);
    if (table === "memories") return respond(account.memories);
    if (table === "journey_entries") return respond([]);
    if (table === "messages") return respond(account.messages);
    throw new Error(
      "Unexpected network request " + req.method() + " " + url.pathname,
    );
  },
);
const button = (name) => page.getByRole("button", { name, exact: true });
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: root + "/" + name + ".png" });
};
try {
  await page.goto(baseURL);
  await button("Find my sparks").waitFor();
  await page.evaluate((p) => {
    localStorage.setItem("iwillbe.practice.v1.guest", JSON.stringify(p));
    localStorage.setItem(
      "iwillbe.draft.v1.guest.chloe",
      JSON.stringify({ input: "My local unfinished thought" }),
    );
  }, local);
  await page.goto(baseURL + "/account?returnTo=%2Fchloe&reason=chloe");
  await page
    .getByRole("textbox", { name: "EMAIL", exact: true })
    .fill("fixture@example.test");
  await button("Email me a sign-in link").click();
  await page
    .getByText(/Check fixture@example.test for a sign-in link/)
    .waitFor();
  assert.equal(emailCalls, 1);
  assert(
    await page
      .getByRole("button", { name: /Send another link in/ })
      .isDisabled(),
  );
  await button("Use my existing password").click();
  await page
    .getByRole("textbox", { name: "PASSWORD", exact: true })
    .fill("fixture-password");
  await button("Sign in with password").click();
  await button("Import my local practice").waitFor();
  assert.equal(importCalls, 0);
  assert.equal(chatCalls, 0);
  await page.getByText(/Already in your account:/).waitFor();
  await shot("11-import-consent-mocked-auth");
  await button("Import my local practice").click();
  await page.getByText(/Nothing was overwritten/).waitFor();
  assert.equal(importCalls, 1);
  assert.equal(account.intentions.length, 1);
  await shot("12-import-error-mocked-auth");
  await button("Import my local practice").click();
  await page.getByText(/1 new intentions imported/).waitFor();
  assert.equal(importCalls, 2);
  await button("Continue to my practice").click();
  await page
    .getByRole("textbox", { name: "Message Chloe", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message Chloe", exact: true })
      .inputValue(),
    "My local unfinished thought",
  );
  assert.equal(chatCalls, 0, "Never auto-send saved draft");
  const state = await page.evaluate(
    (id) => ({
      guest: JSON.parse(localStorage.getItem("iwillbe.practice.v1.guest")),
      account: JSON.parse(localStorage.getItem("iwillbe.practice.v2." + id)),
    }),
    owner,
  );
  assert.deepEqual(state.guest, local);
  assert.equal(state.account.profile.display_name, "Account name");
  assert.equal(state.account.intentions.length, 2);
  await button("Send message").click();
  await page.getByText(/aren’t available in this beta yet/).waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message Chloe", exact: true })
      .inputValue(),
    "My local unfinished thought",
  );
  await shot("13-chloe-unavailable-draft-retained");
  // Existing account draft and incoming guest draft both remain accessible.
  await page.evaluate(
    ({ owner, session }) => {
      localStorage.setItem(
        "iwillbe.draft.v1." + owner + ".chloe",
        JSON.stringify({ input: "Earlier account thought" }),
      );
      localStorage.setItem(
        "iwillbe.auth.intent",
        JSON.stringify({ returnTo: "/chloe", reason: "chloe" }),
      );
    },
    { owner, session },
  );
  await page.goto(baseURL + "/account");
  await button("Keep them separate and continue").click();
  await page.getByText("ANOTHER SAVED DRAFT", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message Chloe", exact: true })
      .inputValue(),
    "Earlier account thought",
  );
  await button("Use this draft").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message Chloe", exact: true })
      .inputValue(),
    "My local unfinished thought",
  );
  await page.getByText("Earlier account thought", { exact: true }).waitFor();
  await button("Use this draft").click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Message Chloe", exact: true })
      .inputValue(),
    "Earlier account thought",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    root + "/auth-results.json",
    JSON.stringify(
      {
        passed: true,
        mode: "Mocked Supabase network; no emails, accounts or AI messages sent",
        errors,
        checks: [
          "unified email entry and cooldown",
          "password fallback",
          "explicit import consent",
          "same-day conflict preview",
          "failed import retry",
          "account profile preserved",
          "guest backup unchanged",
          "return to Chloe",
          "draft resumed without auto-send",
          "AI error retains message",
          "two drafts can be selected without overwrite",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Mocked auth/import regression passed");
} catch (e) {
  console.error(e);
  console.log(await page.locator("body").ariaSnapshot());
  await shot("auth-failure");
  process.exitCode = 1;
} finally {
  await browser.close();
}
