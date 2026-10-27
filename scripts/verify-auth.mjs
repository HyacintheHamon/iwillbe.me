import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const root = process.env.UI_ARTIFACT_DIR || "test-results/auth";
const baseURL = process.env.UI_BASE_URL || "http://localhost:4173";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: "America/New_York",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const selectedQuestion = "What do you want more of in your life?";
const chatRequests = [];
let successfulQuestionReply = false;
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
  profile: { ...profile, id: owner, revision: 1 },
  intentions: [
    {
      ...local.intentions[0],
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      user_id: owner,
      revision: 1,
      action: "Account intention",
    },
  ],
  checkIns: [],
  memories: [],
  messages: [],
  entries: [],
};
const mutations = [];
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
    const represented = (rows) =>
      req.headers().accept?.includes("application/vnd.pgrst.object+json")
        ? (rows[0] ?? null)
        : rows;
    try {
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
        account.intentions.push({
          ...local.intentions[1],
          user_id: owner,
          revision: 1,
        });
        return respond({ imported: 1, skipped_days: [today] });
      }
      if (url.pathname === "/functions/v1/chloe") {
        chatCalls++;
        const body = req.postDataJSON();
        chatRequests.push(body);
        if (successfulQuestionReply && body.message === selectedQuestion) {
          const now = new Date().toISOString();
          const messages = [
            {
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              role: "user",
              content: selectedQuestion,
              created_at: now,
            },
            {
              id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
              role: "assistant",
              content:
                "Start with one ordinary moment. When did you last want a little more of it?",
              created_at: now,
            },
          ];
          account.messages.push(...messages);
          return respond({
            messages,
            suggested_intention: null,
            memory_suggestion: null,
            discovery: null,
            why_proposal: null,
            question: "When did you last want a little more of it?",
          });
        }
        return respond(
          { code: "AI_NOT_CONFIGURED", error: "Fixture: unavailable" },
          503,
        );
      }
      const table = url.pathname.split("/").pop();
      const fields = {
        intentions: "intentions",
        check_ins: "checkIns",
        memories: "memories",
        journey_entries: "entries",
        messages: "messages",
      };
      assert(
        table === "profiles" || Object.hasOwn(fields, table),
        `Unexpected network request ${req.method()} ${url.pathname}`,
      );
      const rows =
        table === "profiles" ? [account.profile] : account[fields[table]];
      const matches = (row) =>
        [...url.searchParams].every(([key, value]) => {
          if (["select", "order", "limit", "offset"].includes(key)) return true;
          assert(value.startsWith("eq."), `Unsupported filter ${key}=${value}`);
          return String(row[key]) === value.slice(3);
        });
      if (req.method() === "GET")
        return respond(represented(rows.filter(matches)));
      const method = req.method(),
        key = table === "check_ins" ? "intention_id" : "id";
      assert(["POST", "PATCH", "DELETE"].includes(method));
      assert(
        req.headers().prefer?.includes("return=representation"),
        "CAS writes must return their saved revision",
      );
      assert(
        !req.headers().prefer?.includes("resolution=merge-duplicates"),
        "This fixture must not hide an unconditional upsert",
      );
      const payload = method === "DELETE" ? null : req.postDataJSON();
      const attempt = {
        table,
        method,
        payload,
        saved: false,
        revision: url.searchParams.get("revision"),
      };
      mutations.push(attempt);
      if (payload) {
        assert(!Object.hasOwn(payload, "revision"));
        assert.equal(
          table === "profiles" ? payload.id : payload.user_id,
          owner,
        );
        if (payload.entry) assert(!Object.hasOwn(payload.entry, "revision"));
      }
      const replaceRows = (next) => {
        if (table === "profiles") account.profile = next[0];
        else account[fields[table]] = next;
      };
      if (method === "POST") {
        if (
          rows.some(
            (row) =>
              row[key] === payload[key] ||
              (table === "intentions" && row.day === payload.day),
          )
        )
          return respond(
            { code: "23505", message: "Synthetic unique constraint" },
            409,
          );
        const saved = { ...payload, revision: 1 };
        replaceRows([...rows, saved]);
        attempt.saved = true;
        return respond(represented([saved]), 201);
      }
      assert.match(attempt.revision || "", /^eq\.[1-9]\d*$/);
      assert.equal(
        url.searchParams.get(table === "profiles" ? "id" : "user_id"),
        `eq.${owner}`,
      );
      assert(url.searchParams.has(key));
      const matched = rows.filter(matches);
      if (!matched.length) return respond([]);
      assert.equal(matched.length, 1);
      attempt.saved = true;
      if (method === "DELETE") {
        replaceRows(rows.filter((row) => row !== matched[0]));
        return respond(represented(matched));
      }
      const saved = {
        ...matched[0],
        ...payload,
        revision: matched[0].revision + 1,
      };
      replaceRows(rows.map((row) => (row === matched[0] ? saved : row)));
      return respond(represented([saved]));
    } catch (error) {
      errors.push(`${req.method()} ${url.pathname}: ${String(error)}`);
      return respond(
        { code: "FIXTURE_UNEXPECTED", message: String(error) },
        500,
      );
    }
  },
);
const button = (name) => page.getByRole("button", { name, exact: true });
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: root + "/" + name + ".png" });
};
try {
  await page.goto(baseURL);
  await button("Find your possibilities").waitFor();
  await page.evaluate((p) => {
    localStorage.setItem("iwillbe.practice.v1.guest", JSON.stringify(p));
    localStorage.setItem(
      "iwillbe.draft.v1.guest.chloe",
      JSON.stringify({ input: "My local unfinished thought" }),
    );
  }, local);
  await page.goto(
    baseURL +
      "/chloe?mode=discovery&question=" +
      encodeURIComponent(selectedQuestion),
  );
  await expect(page.getByText(selectedQuestion, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "DRAFT FOR CHLOE · OPTIONAL",
      exact: true,
    }),
  ).toHaveValue("My local unfinished thought");
  assert.equal(
    chatCalls,
    0,
    "Selecting an Open Question must not send a draft",
  );
  await button("Connect and continue with Chloe").click();
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
  await expect(button("Think about this question")).toBeVisible();
  await expect(
    button("Think about this question")
      .locator("..")
      .getByText(selectedQuestion, { exact: true }),
  ).toBeVisible();
  assert.equal(
    new URL(page.url()).searchParams.get("question"),
    selectedQuestion,
    "The selected question survives authentication and the import branch",
  );
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
  // Only this explicit click receives a successful mocked response. No live AI
  // call is made, and the previously unfinished message must remain untouched.
  successfulQuestionReply = true;
  const callsBeforeSelection = chatCalls;
  await button("Think about this question").click();
  await expect(
    page
      .getByText(
        "Start with one ordinary moment. When did you last want a little more of it?",
        { exact: true },
      )
      .filter({ visible: true }),
  ).toBeVisible();
  assert.equal(chatCalls, callsBeforeSelection + 1);
  assert.equal(chatRequests.at(-1).message, selectedQuestion);
  assert.equal(chatRequests.at(-1).mode, "discovery");
  await expect(
    page.getByRole("textbox", { name: "Message Chloe", exact: true }),
  ).toHaveValue("My local unfinished thought");
  await expect(button("Think about this question")).toHaveCount(0);
  assert.equal(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem("iwillbe.draft.v1." + id + ".chloe"))
          .input,
      owner,
    ),
    "My local unfinished thought",
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Chloe", exact: true }),
  ).toHaveValue("My local unfinished thought");
  assert.equal(
    chatCalls,
    callsBeforeSelection + 1,
    "Reloading a selected question does not send it again",
  );
  await shot("14-open-question-auth-draft-preserved");
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
          "selected Open Question survives authentication and import",
          "explicit question send uses its exact text without replacing the existing draft",
          "selected question never auto-sends on open, sign-in or reload",
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
