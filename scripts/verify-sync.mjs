import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Real exported app, synthetic accounts and a shared in-memory server. Every
// Supabase request is intercepted; these tests never call production or send mail.
const base = process.env.UI_BASE_URL || "http://localhost:4173";
const artifacts = process.env.UI_ARTIFACT_DIR || "test-results/sync";
const endpoint = "https://mvhqovdznrzoduntyryh.supabase.co";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const authKey = "sb-mvhqovdznrzoduntyryh-auth-token";
const ownPrefix = `iwillbe.draft.v1.${owner}.`;
const cacheKey = `iwillbe.practice.v2.${owner}`;
const guestKey = "iwillbe.practice.v2.guest";
const guestDraftKey = "iwillbe.draft.v1.guest.chloe";
const otherDraftKey = "iwillbe.draft.v1.other-account.why";
const checks = [],
  errors = [];
let active;
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const read = (page, key) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const record = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const profile = (name) => ({
  display_name: name,
  north_star: "Care in ordinary life",
  values: [],
  interests: [],
  onboarded: true,
  timezone: "UTC",
  morning_time: "08:00",
  evening_time: "20:30",
});
const guest = {
  profile: profile("GUEST_BACKUP_KEEP"),
  intentions: [],
  checkIns: [],
  memories: [],
  messages: [],
  entries: [],
};
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-10-19T12:00:00Z",
};
const session = {
  access_token: `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`,
  refresh_token: "fixture-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
};
function server() {
  return {
    tables: {
      profiles: [
        { id: owner, revision: 1, ...profile("Original account name") },
      ],
      intentions: [],
      check_ins: [],
      memories: [],
      messages: [],
      journey_entries: [],
    },
    mutations: [],
    calls: [],
    deleteAllowed: true,
    deleted: false,
    chatStarted: deferred(),
    chatReply: deferred(),
  };
}
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }),
});

async function device(shared, name) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  await context.addInitScript(
    ({
      session,
      authKey,
      owner,
      guest,
      guestKey,
      guestDraftKey,
      otherDraftKey,
    }) => {
      if (localStorage.getItem("iwillbe.sync.fixture.seeded")) return;
      localStorage.setItem("iwillbe.sync.fixture.seeded", "true");
      localStorage.setItem(authKey, JSON.stringify(session));
      localStorage.setItem(guestKey, JSON.stringify(guest));
      localStorage.setItem(
        guestDraftKey,
        JSON.stringify({ input: "GUEST_DRAFT_KEEP" }),
      );
      localStorage.setItem(
        otherDraftKey,
        JSON.stringify({ input: "OTHER_ACCOUNT_KEEP" }),
      );
      localStorage.setItem(
        `iwillbe.practice.v1.${owner}`,
        JSON.stringify({ profile: { display_name: "PRIVATE_ACCOUNT_CACHE" } }),
      );
      for (const screen of ["ritual", "why", "chloe.incoming"])
        localStorage.setItem(
          `iwillbe.draft.v1.${owner}.${screen}`,
          JSON.stringify({ input: "PRIVATE_ACCOUNT_DRAFT" }),
        );
    },
    { session, authKey, owner, guest, guestKey, guestDraftKey, otherDraftKey },
  );
  await context.route(`${endpoint}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method();
    const reply = (data, status = 200) =>
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
      if (method === "OPTIONS") return reply({});
      if (url.pathname === "/auth/v1/user") return reply(user);
      if (url.pathname === "/auth/v1/token") return reply(session);
      if (url.pathname === "/auth/v1/logout") {
        shared.calls.push({ action: "logout", device: name });
        return reply({});
      }
      if (url.pathname === "/functions/v1/chloe") {
        const body = req.postDataJSON();
        shared.calls.push({ ...body, device: name });
        if (body.action === "delete_account") {
          assert.equal(body.confirmation, "DELETE");
          if (!shared.deleteAllowed)
            return reply({ error: "Synthetic deletion failure" }, 503);
          shared.deleted = true;
          return reply({ success: true });
        }
        assert.equal(
          body.action,
          "chat",
          "Only explicitly tested function actions are permitted",
        );
        shared.chatStarted.resolve();
        await shared.chatReply.promise;
        return reply({
          messages: [
            {
              id: "late-assistant",
              role: "assistant",
              content: "PRIVATE_LATE_ACCOUNT_REPLY",
              created_at: new Date().toISOString(),
            },
          ],
          suggested_intention: {
            action: "PRIVATE_LATE_ACCOUNT_ACTION",
            value: "Kindness",
            person: "Aunt",
          },
          memory_suggestion: "PRIVATE_LATE_ACCOUNT_MEMORY",
          discovery: {
            kind: "interest",
            title: "PRIVATE_LATE_ACCOUNT_INTEREST",
            body: "Private context",
            source_ids: [],
          },
          why_proposal: null,
          question: "PRIVATE_LATE_ACCOUNT_QUESTION",
          reflection_proposal: null,
          weekly_focus: { area: "Grow", reason: "PRIVATE_LATE_ACCOUNT_FOCUS" },
        });
      }
      assert(
        url.pathname.startsWith("/rest/v1/"),
        `Unexpected network path ${url.pathname}`,
      );
      const table = url.pathname.slice("/rest/v1/".length);
      assert(
        Object.hasOwn(shared.tables, table),
        `Unexpected table or RPC ${table}`,
      );
      const rows = shared.tables[table],
        key = table === "check_ins" ? "intention_id" : "id";
      const matches = (row) =>
        [...url.searchParams].every(([name, value]) => {
          if (["select", "order", "limit", "offset"].includes(name))
            return true;
          assert(
            value.startsWith("eq."),
            `Unsupported filter ${name}=${value}`,
          );
          return String(row[name]) === value.slice(3);
        });
      if (method === "GET") return reply(represented(rows.filter(matches)));
      assert(
        ["POST", "PATCH", "DELETE"].includes(method),
        `Unexpected method ${method}`,
      );
      assert(
        req.headers().prefer?.includes("return=representation"),
        "Mutations must request the saved row",
      );
      assert(
        !req.headers().prefer?.includes("resolution=merge-duplicates"),
        "Unconditional upserts are forbidden",
      );
      const payload = method === "DELETE" ? null : req.postDataJSON();
      const attempt = {
        device: name,
        method,
        table,
        payload,
        revision: url.searchParams.get("revision"),
        saved: false,
      };
      shared.mutations.push(attempt);
      if (payload) {
        assert(
          !Object.hasOwn(payload, "revision"),
          "Revision must be a compare filter",
        );
        assert.equal(
          table === "profiles" ? payload.id : payload.user_id,
          owner,
        );
        if (payload.entry) assert(!Object.hasOwn(payload.entry, "revision"));
      }
      if (method === "POST") {
        if (
          rows.some(
            (row) =>
              row[key] === payload[key] ||
              (table === "intentions" && row.day === payload.day),
          )
        )
          return reply(
            { code: "23505", message: "Synthetic unique constraint" },
            409,
          );
        const row = { ...payload, revision: 1 };
        rows.push(row);
        attempt.saved = true;
        return reply(represented([row]), 201);
      }
      assert.match(
        attempt.revision || "",
        /^eq\.[1-9]\d*$/,
        "Existing edits/deletes require a positive baseline revision",
      );
      assert.equal(
        url.searchParams.get(table === "profiles" ? "id" : "user_id"),
        `eq.${owner}`,
      );
      assert(
        url.searchParams.has(key),
        "Existing edits/deletes require the exact primary key",
      );
      const matched = rows.filter(matches);
      if (!matched.length) return reply([]);
      assert.equal(matched.length, 1);
      attempt.saved = true;
      if (method === "DELETE") {
        shared.tables[table] = rows.filter((row) => row !== matched[0]);
        return reply(represented(matched));
      }
      const row = {
        ...matched[0],
        ...payload,
        revision: matched[0].revision + 1,
      };
      shared.tables[table] = rows.map((old) =>
        old === matched[0] ? row : old,
      );
      return reply(represented([row]));
    } catch (error) {
      errors.push(`${name} ${method} ${url.pathname}: ${String(error)}`);
      return reply({ code: "FIXTURE_UNEXPECTED", message: String(error) }, 500);
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  active = page;
  await page.goto(`${base}/settings`);
  await expect(field(page, "YOUR NAME")).toHaveValue("Original account name");
  return { context, page };
}
async function editName(page, name) {
  await field(page, "YOUR NAME").fill(name);
  await button(page, "Save my preferences").click();
}
async function noAccountFiles(page) {
  return page.evaluate(
    ({ ownPrefix, cacheKey, owner }) =>
      Object.keys(localStorage).filter(
        (key) =>
          key.startsWith(ownPrefix) ||
          key === cacheKey ||
          key === `iwillbe.practice.v1.${owner}`,
      ),
    { ownPrefix, cacheKey, owner },
  );
}
async function checkGuest(page) {
  assert.equal(
    (await read(page, guestKey)).profile.display_name,
    "GUEST_BACKUP_KEEP",
  );
  assert.equal((await read(page, guestDraftKey)).input, "GUEST_DRAFT_KEEP");
  assert.equal((await read(page, otherDraftKey)).input, "OTHER_ACCOUNT_KEEP");
}
async function openDelete(page) {
  await button(page, "Delete my account and data").click();
  await field(page, "TYPE DELETE TO CONFIRM").fill("DELETE");
}
try {
  const shared = server();
  const a = await device(shared, "A"),
    b = await device(shared, "B");
  await field(a.page, "YOUR NAME").fill("My device A draft");
  await editName(b.page, "Saved on device B");
  await expect.poll(() => shared.tables.profiles[0].revision).toBe(2);
  await a.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(async () => (await read(a.page, cacheKey)).profile.revision)
    .toBe(2);
  await expect(field(a.page, "YOUR NAME")).toHaveValue("My device A draft");
  assert.equal((await read(a.page, `${ownPrefix}profile`)).revision, 1);
  record(
    "foreground refresh retrieves the newer account while preserving the unsaved draft and its original revision",
  );

  await button(a.page, "Save my preferences").click();
  await expect(
    a.page.getByText("This changed on another device", { exact: true }),
  ).toBeVisible();
  await expect(
    a.page.getByText(/Saved on device B/, { exact: false }).last(),
  ).toBeVisible();
  await expect(
    a.page.getByText(/My device A draft/, { exact: false }).last(),
  ).toBeVisible();
  assert.equal(shared.tables.profiles[0].display_name, "Saved on device B");
  await button(a.page, "Keep the saved version").click();
  await expect(field(a.page, "YOUR NAME")).toHaveValue("My device A draft");
  await expect(a.page.getByText(/The saved version was kept/)).toBeVisible();
  assert.equal(
    (await read(a.page, `${ownPrefix}profile`)).display_name,
    "My device A draft",
  );
  record(
    "a stale save displays both versions; keeping the account version preserves the user's draft without a write",
  );

  await button(a.page, "Save my preferences").click();
  await expect(button(a.page, "Save my draft instead")).toBeVisible();
  await editName(b.page, "Second change on device B");
  await expect.poll(() => shared.tables.profiles[0].revision).toBe(3);
  await button(a.page, "Save my draft instead").click();
  await expect(
    a.page.getByText(/Second change on device B/, { exact: false }).last(),
  ).toBeVisible();
  await expect(button(a.page, "Save my draft instead")).toBeVisible();
  assert.equal(
    shared.tables.profiles[0].display_name,
    "Second change on device B",
  );
  assert.equal(
    shared.mutations.filter((m) => m.device === "A" && m.saved).length,
    0,
  );
  record(
    "a second device edit during review opens a new review instead of overwriting it",
  );

  await button(a.page, "Save my draft instead").click();
  await expect.poll(() => shared.tables.profiles[0].revision).toBe(4);
  await expect(
    a.page.getByText("Your preferences are saved.", { exact: true }),
  ).toBeVisible();
  assert.equal(shared.tables.profiles[0].display_name, "My device A draft");
  assert.equal(
    shared.mutations.filter((m) => m.device === "A" && m.saved).length,
    1,
  );
  assert.equal(
    shared.mutations.find((m) => m.device === "A" && m.saved).revision,
    "eq.3",
  );
  assert.equal((await read(a.page, `${ownPrefix}profile`)).revision, 4);
  record(
    "explicitly saving the reviewed draft uses the latest reviewed revision and updates the form baseline",
  );
  await a.page.screenshot({
    path: `${artifacts}/reviewed-save.png`,
    fullPage: true,
  });

  await button(a.page, "Sign out").click();
  await expect.poll(() => noAccountFiles(a.page)).toEqual([]);
  await checkGuest(a.page);
  assert.equal(shared.tables.profiles[0].display_name, "My device A draft");
  record(
    "sign-out removes every account cache and draft, preserving saved account data and isolated guest/other-account backups",
  );
  await a.context.close();
  await b.context.close();

  const deletion = server();
  deletion.deleteAllowed = false;
  const questionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  deletion.tables.journey_entries.push({
    id: questionId,
    user_id: owner,
    kind: "question",
    revision: 1,
    entry: {
      id: questionId,
      kind: "question",
      title: "PRIVATE_LATE_ACCOUNT_QUESTION",
      body: "",
      state: "open",
      source: "Synthetic private account",
      source_ids: [],
      meta: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });
  const d = await device(deletion, "deletion");
  active = d.page;
  await openDelete(d.page);
  await button(d.page, "Delete permanently").click();
  await expect(
    d.page.getByText("Could not delete your account. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  assert(await read(d.page, cacheKey));
  assert(await read(d.page, `${ownPrefix}why`));
  assert(await read(d.page, authKey));
  assert.equal(deletion.calls.filter((c) => c.action === "logout").length, 0);
  await checkGuest(d.page);
  record(
    "a rejected account deletion keeps the account session, cache and drafts for retry",
  );

  const pending = await d.context.newPage();
  pending.on("pageerror", (error) => errors.push(error.message));
  await pending.goto(`${base}/chloe`);
  await field(pending, "Message Chloe").fill("PRIVATE_ACCOUNT_LATE_MESSAGE");
  await button(pending, "Send message").click();
  await deletion.chatStarted.promise;
  deletion.deleteAllowed = true;
  await button(d.page, "Delete permanently").click();
  await expect.poll(() => deletion.deleted).toBe(true);
  await expect.poll(() => noAccountFiles(d.page)).toEqual([]);
  await expect.poll(async () => await read(pending, authKey)).toBeNull();
  deletion.chatReply.resolve();
  await expect
    .poll(async () =>
      (await pending.locator("body").innerText()).includes(
        "Connect and continue with Chloe",
      ),
    )
    .toBe(true);
  await pending.waitForTimeout(300);
  assert.deepEqual(await noAccountFiles(d.page), []);
  await checkGuest(d.page);
  const remaining = await d.page.evaluate(() =>
    Object.entries(localStorage)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n"),
  );
  assert(
    !remaining.includes("PRIVATE_LATE_ACCOUNT"),
    "Late account replies must not leak into guest storage",
  );
  assert(
    !remaining.includes("PRIVATE_ACCOUNT_LATE_MESSAGE"),
    "Late callbacks must not resurrect account drafts",
  );
  assert.equal(
    deletion.mutations.length,
    0,
    "A late account reply must not trigger guest or account follow-up saves",
  );
  record(
    "successful deletion clears account data and a late reply on another mounted tab cannot recreate drafts or contaminate guest practice",
  );
  await d.page.screenshot({
    path: `${artifacts}/after-delete.png`,
    fullPage: true,
  });
  await d.context.close();
  assert.deepEqual(errors, []);
  record(
    "all browser requests used strict synthetic account fixtures; no page errors or unexpected endpoints occurred",
  );
  await writeFile(
    `${artifacts}/report.json`,
    JSON.stringify({ base, checks, errors }, null, 2),
  );
  console.log(`PASS ${checks.length} sync/privacy browser checks`);
} catch (error) {
  if (active && !active.isClosed()) {
    await active
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${artifacts}/failure.txt`,
      await active.locator("body").innerText(),
    ).catch(() => {});
  }
  await writeFile(
    `${artifacts}/report.json`,
    JSON.stringify({ base, checks, errors, failure: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
