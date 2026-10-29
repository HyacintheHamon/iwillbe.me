import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// This suite exercises the real exported app against an explicit synthetic
// account. All Supabase traffic is intercepted; no email or AI call is sent.
const base = (process.env.UI_BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
const artifacts = process.env.UI_ARTIFACT_DIR || "test-results/chloe";
const endpoint = "https://mvhqovdznrzoduntyryh.supabase.co";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const intentionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const interestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const valueId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const preferencesId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const weekNoteId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const draftKey = `iwillbe.draft.v1.${owner}.chloe`;
const practiceKey = `iwillbe.practice.v2.${owner}`;
const checks = [],
  errors = [];
let active;

const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
const read = (page, key = draftKey) =>
  page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)),
    key,
  );
const record = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
const dayInZone = (zone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const shiftDay = (day, amount) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};
const photo = async (page, name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
};
const rowEntry = (kind, title, id, extra = {}) => ({
  id,
  kind,
  title,
  body: "",
  state: "active",
  source: "Explicit test fixture",
  source_ids: [],
  meta: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  revision: 1,
  ...extra,
});
const todayIntention = (extra = {}) => ({
  id: intentionId,
  user_id: owner,
  day: dayInZone("UTC"),
  action: "Make a small bowl",
  value: "",
  interest: "Ceramics",
  interest_id: interestId,
  value_id: null,
  planet: "Passions",
  kind: "action",
  when_context: "After lunch",
  place: "At the kitchen table",
  person: "For me",
  with_person: "",
  created_at: new Date().toISOString(),
  revision: 1,
  ...extra,
});
const reflection = (extra = {}) => ({
  intention_id: intentionId,
  outcome: null,
  energy: "lit",
  value_choice: null,
  replacement_value: null,
  reflection: "PRIVATE_JOURNAL_FIXTURE: the clay absorbed my attention.",
  evidence: [],
  ...extra,
});

await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }),
});

async function signedFixture({
  intentions = [],
  entries = [],
  reply,
  failMutation,
  pendingDraft,
} = {}) {
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
  const tables = {
    profiles: [
      {
        id: owner,
        revision: 1,
        display_name: "PRIVATE_NAME_FIXTURE",
        north_star: "PRIVATE_WHY_FIXTURE: make room for care.",
        values: [],
        interests: [],
        onboarded: true,
        timezone: "UTC",
        morning_time: "08:00",
        evening_time: "20:30",
      },
    ],
    intentions: structuredClone(intentions),
    check_ins: [],
    memories: [],
    messages: [],
    journey_entries: entries.map(({ revision, ...entry }) => ({
      id: entry.id,
      user_id: owner,
      kind: entry.kind,
      entry,
      updated_at: entry.updated_at,
      revision: revision || 1,
    })),
  };
  const calls = [],
    mutations = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
    acceptDownloads: true,
  });
  await context.addInitScript(
    ({ session, pendingDraft, draftKey }) => {
      const key = "sb-mvhqovdznrzoduntyryh-auth-token";
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(session));
      if (pendingDraft && !localStorage.getItem(draftKey))
        localStorage.setItem(draftKey, JSON.stringify(pendingDraft));
    },
    { session, pendingDraft, draftKey },
  );
  await context.route(`${endpoint}/**`, async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method();
    const respond = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    const represented = (rows) =>
      request.headers().accept?.includes("application/vnd.pgrst.object+json")
        ? (rows[0] ?? null)
        : rows;
    try {
      if (method === "OPTIONS") return respond({});
      if (url.pathname === "/auth/v1/user") return respond(user);
      if (url.pathname === "/auth/v1/token") return respond(session);
      if (url.pathname === "/functions/v1/chloe") {
        assert.equal(method, "POST");
        const body = request.postDataJSON();
        assert.equal(body.action, "chat");
        assert.equal(
          body.proposal_cards,
          true,
          "The current app must advertise support for reflection and focus cards",
        );
        calls.push(body);
        assert(reply, "This fixture did not authorize a Chloe call");
        const generated = await reply(body, calls.length);
        const now = new Date().toISOString();
        const messages = [
          {
            id: randomUUID(),
            user_id: owner,
            role: "user",
            content: body.message,
            created_at: now,
          },
          {
            id: randomUUID(),
            user_id: owner,
            role: "assistant",
            content:
              generated.text ||
              "Keep what feels true, then let the night be yours.",
            created_at: now,
          },
        ];
        tables.messages.push(...messages);
        return respond({
          messages,
          suggested_intention: null,
          memory_suggestion: null,
          discovery: null,
          why_proposal: null,
          question: null,
          reflection_proposal: null,
          weekly_focus: null,
          ...generated,
        });
      }
      assert(
        url.pathname.startsWith("/rest/v1/"),
        `Unexpected route ${url.pathname}`,
      );
      const table = url.pathname.slice("/rest/v1/".length);
      assert(Object.hasOwn(tables, table), `Unexpected table or RPC ${table}`);
      const key = table === "check_ins" ? "intention_id" : "id";
      const filter = (row) =>
        [...url.searchParams].every(([name, condition]) => {
          if (["select", "order", "limit", "offset"].includes(name))
            return true;
          assert(
            condition.startsWith("eq."),
            `Unsupported fixture filter ${name}=${condition}`,
          );
          return String(row[name]) === condition.slice(3);
        });
      if (method === "GET") {
        let rows = tables[table].filter(filter);
        const order = url.searchParams.get("order");
        if (order) {
          const [column, direction] = order.split(".");
          rows = [...rows].sort(
            (a, b) =>
              String(a[column]).localeCompare(String(b[column])) *
              (direction === "desc" ? -1 : 1),
          );
        }
        if (url.searchParams.has("limit"))
          rows = rows.slice(0, Number(url.searchParams.get("limit")));
        return respond(represented(rows));
      }
      assert(
        ["POST", "PATCH", "DELETE"].includes(method),
        `Unexpected method ${method}`,
      );
      const payload = method === "DELETE" ? null : request.postDataJSON();
      const attempt = {
        table,
        method,
        payload: structuredClone(payload),
        query: url.search,
        saved: false,
      };
      mutations.push(attempt);
      assert(
        request.headers().prefer?.includes("return=representation"),
        "CAS mutations must request the saved row",
      );
      assert(
        !request.headers().prefer?.includes("resolution=merge-duplicates"),
        "A fixture must not conceal an unconditional upsert",
      );
      if (payload) {
        assert(
          !Object.hasOwn(payload, "revision"),
          "Revisions belong in the compare filter, not the body",
        );
        assert.equal(
          table === "profiles" ? payload.id : payload.user_id,
          owner,
        );
        if (payload.entry) assert(!Object.hasOwn(payload.entry, "revision"));
      }
      if (failMutation?.({ table, method, payload, mutations }))
        return respond(
          {
            code: "FIXTURE_TRANSIENT",
            message: "Synthetic connection failure",
          },
          503,
        );
      if (method === "POST") {
        assert(payload && !Array.isArray(payload));
        const duplicate = tables[table].some(
          (row) =>
            row[key] === payload[key] ||
            (table === "intentions" && row.day === payload.day),
        );
        if (duplicate)
          return respond(
            { code: "23505", message: "Synthetic unique constraint" },
            409,
          );
        const row = { ...payload, revision: 1 };
        tables[table].push(row);
        attempt.saved = true;
        return respond(represented([row]), 201);
      }
      assert.match(
        url.searchParams.get("revision") || "",
        /^eq\.[1-9]\d*$/,
        "Updates need an expected revision",
      );
      assert.equal(
        url.searchParams.get(table === "profiles" ? "id" : "user_id"),
        `eq.${owner}`,
      );
      assert(url.searchParams.get(key), "Updates need a primary-key filter");
      const matched = tables[table].filter(filter);
      if (!matched.length) return respond([]);
      assert.equal(matched.length, 1);
      if (method === "DELETE") {
        tables[table] = tables[table].filter((row) => row !== matched[0]);
        attempt.saved = true;
        return respond(represented(matched));
      }
      const row = {
        ...matched[0],
        ...payload,
        revision: matched[0].revision + 1,
      };
      tables[table] = tables[table].map((old) =>
        old === matched[0] ? row : old,
      );
      attempt.saved = true;
      return respond(represented([row]));
    } catch (error) {
      errors.push(`${method} ${url.pathname}: ${String(error)}`);
      return respond(
        { code: "FIXTURE_UNEXPECTED", message: String(error) },
        500,
      );
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  active = page;
  return { page, context, tables, calls, mutations };
}

async function send(page, message) {
  await field(page, "Message Chloe").fill(message);
  await button(page, "Send message").click();
  await expect(field(page, "Message Chloe")).toHaveValue("");
}

try {
  let failedCheckIn = false;
  const energy = await signedFixture({
    intentions: [todayIntention()],
    entries: [rowEntry("interest", "Ceramics", interestId, { state: "tried" })],
    reply: () => ({ reflection_proposal: reflection() }),
    failMutation: ({ table, method }) => {
      if (table === "check_ins" && method === "POST" && !failedCheckIn) {
        failedCheckIn = true;
        return true;
      }
      return false;
    },
  });
  await energy.page.goto(`${base}/`);
  await expect(button(energy.page, "Reflect on today")).toBeVisible();
  await energy.page.goto(`${base}/chloe?mode=night`);
  await send(
    energy.page,
    "The clay absorbed my attention; I have not said how much of my commitment happened.",
  );
  await expect(heading(energy.page, "Your reflection")).toBeVisible();
  await expect(
    energy.page.getByText("How it went: not answered", { exact: true }),
  ).toBeVisible();
  await expect(
    energy.page.getByText("It lit me up", { exact: true }),
  ).toBeVisible();
  await expect(button(energy.page, "Save tonight’s reflection")).toBeDisabled();
  assert.equal(energy.tables.check_ins.length, 0);
  assert.equal(
    energy.mutations.length,
    0,
    "Receiving an AI proposal must not write a reflection",
  );
  await expect
    .poll(async () => (await read(energy.page))?.reflection?.energy)
    .toBe("lit");
  assert.equal((await read(energy.page)).reflection.outcome, null);
  assert.equal((await read(energy.page)).reflection.pending_revision, 0);
  await photo(energy.page, "01-energy-does-not-answer-outcome");
  await energy.page.reload();
  await expect(heading(energy.page, "Your reflection")).toBeVisible();
  await expect(field(energy.page, "Message Chloe")).toHaveValue("");
  await expect(button(energy.page, "Save tonight’s reflection")).toBeDisabled();
  assert.equal(energy.calls.length, 1, "Reload must not send another message");
  assert.equal(energy.tables.check_ins.length, 0);
  record(
    "A pending reflection survives reload, clears the sent draft and does not infer an outcome from energy",
  );

  await button(energy.page, "Choose how it went").click();
  await button(energy.page, "A small step").click();
  await expect(button(energy.page, "Save tonight’s reflection")).toBeEnabled();
  await expect
    .poll(async () => (await read(energy.page))?.reflection?.outcome)
    .toBe("partly");
  assert.equal(
    energy.mutations.length,
    0,
    "Choosing an answer edits only the pending draft",
  );
  await button(energy.page, "Save tonight’s reflection").click();
  await expect(
    energy.page.getByText(
      "Could not save to your account. Check your connection and try again; your draft is still here.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(energy.tables.check_ins.length, 0);
  assert.equal((await read(energy.page)).reflection.outcome, "partly");
  await energy.page.reload();
  await expect(button(energy.page, "Save tonight’s reflection")).toBeEnabled();
  assert.equal(energy.calls.length, 1);
  assert.equal(
    energy.mutations.length,
    1,
    "Reload must not retry a save on its own",
  );
  await button(energy.page, "Save tonight’s reflection").click();
  await expect(
    energy.page.getByText("Saved. Let the rest of the night be yours.", {
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(energy.tables.check_ins.length, 1);
  assert.equal(energy.tables.check_ins[0].outcome, "partly");
  assert.equal(energy.tables.check_ins[0].energy, "lit");
  assert.equal(energy.tables.check_ins[0].revision, 1);
  await expect
    .poll(async () => (await read(energy.page))?.reflection)
    .toBeNull();
  assert.equal(
    energy.mutations.filter((m) => m.table === "check_ins" && m.saved).length,
    1,
  );
  await energy.page.goto(`${base}/`);
  await expect(button(energy.page, "Edit my reflection")).toBeVisible();
  await expect(button(energy.page, "Reflect on today")).toHaveCount(0);
  await expect(button(energy.page, "My Possibilities")).toBeVisible();
  assert.equal((await read(energy.page, practiceKey)).checkIns.length, 1);
  await photo(energy.page, "02-saved-night-on-today");
  record(
    "An explicit save can fail and retry without losing answers; the saved check-in updates Today’s action",
  );

  let failedReplacement = false;
  const value = await signedFixture({
    intentions: [
      todayIntention({
        action: "Be patient while we cook",
        kind: "be",
        value: "Patience",
        value_id: valueId,
        interest: "",
        interest_id: null,
        planet: "Be",
      }),
    ],
    entries: [rowEntry("value", "Patience", valueId, { state: "trying" })],
    reply: () => ({
      reflection_proposal: reflection({
        outcome: "yes",
        energy: null,
        value_choice: "yes",
        reflection: "PRIVATE_VALUE_FIXTURE: I made room to listen.",
      }),
    }),
    failMutation: ({ table, method, payload }) => {
      if (
        table === "journey_entries" &&
        method === "POST" &&
        payload.entry.title === "Courage" &&
        !failedReplacement
      ) {
        failedReplacement = true;
        return true;
      }
      return false;
    },
  });
  await value.page.goto(`${base}/chloe?mode=night`);
  await send(
    value.page,
    "I showed up with patience today. I want to consider a different value.",
  );
  await expect(heading(value.page, "Your reflection")).toBeVisible();
  assert.equal(value.mutations.length, 0);
  await button(value.page, "Change the value answer").click();
  await button(value.page, "Another value matters more").click();
  await expect(button(value.page, "Keep this value choice")).toBeDisabled();
  await field(value.page, "Another value").fill("Courage");
  await button(value.page, "Keep this value choice").click();
  await expect(
    value.page.getByText("Patience: Let it go · Trying on Courage", {
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(
    value.tables.journey_entries.find((r) => r.id === valueId).entry.state,
    "trying",
  );
  assert(
    !value.tables.journey_entries.some((r) => r.entry.title === "Courage"),
  );
  assert.equal(value.tables.check_ins.length, 0);
  assert.equal(value.mutations.length, 0);
  await value.page.reload();
  await expect(
    value.page.getByText("Patience: Let it go · Trying on Courage", {
      exact: true,
    }),
  ).toBeVisible();
  assert.equal(value.mutations.length, 0);
  await photo(value.page, "03-replacement-awaits-explicit-save");
  record(
    "A replacement value remains a reviewable draft until the reflection is explicitly saved",
  );

  await button(value.page, "Save tonight’s reflection").click();
  await expect(
    value.page.getByText(
      "Could not save to your account. Check your connection and try again; your draft is still here.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(
    value.tables.check_ins.length,
    1,
    "The fixture fails after the reflection has saved",
  );
  assert.equal(
    value.tables.journey_entries.find((r) => r.id === valueId).entry.state,
    "let_go",
  );
  assert(
    !value.tables.journey_entries.some((r) => r.entry.title === "Courage"),
  );
  await expect(button(value.page, "Update tonight’s reflection")).toBeVisible();
  await button(value.page, "Update tonight’s reflection").click();
  await expect(
    value.page.getByText("Saved. Let the rest of the night be yours.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    heading(value.page, "This changed on another device"),
  ).toHaveCount(0);
  assert.equal(value.tables.check_ins.length, 1);
  assert.equal(
    value.mutations.filter((m) => m.table === "check_ins" && m.saved).length,
    1,
    "Acknowledging an identical saved reflection must not rewrite it",
  );
  assert.equal(
    value.tables.journey_entries.filter((r) => r.entry.title === "Courage")
      .length,
    1,
  );
  assert.equal(
    value.tables.journey_entries.find((r) => r.entry.title === "Courage").entry
      .state,
    "trying",
  );
  assert(
    value.tables.journey_entries
      .find((r) => r.entry.title === "Courage")
      .entry.source_ids.includes(intentionId),
  );
  await expect
    .poll(async () => (await read(value.page))?.reflection)
    .toBeNull();
  record(
    "A partial value save retries without a duplicate check-in or a spurious conflict, and keeps the new value as Trying it on",
  );

  const weekly = await signedFixture({
    intentions: [
      todayIntention({ action: "PRIVATE_COMMITMENT_FIXTURE: sketch at lunch" }),
    ],
    entries: [
      rowEntry("preferences", "Season", preferencesId, {
        meta: { pace: "guide", orbit: "Be" },
      }),
      rowEntry("story", "A moment from this week", weekNoteId, {
        body: "PRIVATE_WEEK_NOTE_FIXTURE: sketching outside kept catching my attention.",
      }),
    ],
    reply: (_body, count) => ({
      text: "Sketching outside keeps finding a place in your day. Would you like to make a little room for it?",
      weekly_focus: {
        area: count === 1 ? "Passions" : "Grow",
        reason: "The sketches you described gave you a little room to explore.",
        source_ids: [weekNoteId],
      },
    }),
  });
  await weekly.page.goto(`${base}/chloe?mode=sunday`);
  await send(weekly.page, "I kept coming back to sketching outside this week.");
  await expect(button(weekly.page, "Yes, use this focus")).toBeVisible();
  assert.equal(
    weekly.mutations.length,
    0,
    "A suggested weekly focus must not automatically change morning guidance",
  );
  assert.equal(
    weekly.tables.journey_entries.find((r) => r.id === preferencesId).entry.meta
      .focus_area,
    undefined,
  );
  await weekly.page.reload();
  await expect(button(weekly.page, "Yes, use this focus")).toBeVisible();
  await expect(field(weekly.page, "Message Chloe")).toHaveValue("");
  assert.equal(weekly.calls.length, 1);
  assert.equal(weekly.mutations.length, 0);
  await button(weekly.page, "Yes, use this focus").click();
  await expect(
    weekly.page.getByText("Your mornings will carry this forward.", {
      exact: true,
    }),
  ).toBeVisible();
  const confirmed = weekly.tables.journey_entries.find(
    (r) => r.id === preferencesId,
  );
  assert.equal(confirmed.entry.meta.focus_area, "Passions");
  assert.equal(confirmed.entry.meta.focus_until, shiftDay(dayInZone("UTC"), 6));
  assert.equal(confirmed.entry.meta.pace, "guide");
  assert.equal(confirmed.revision, 2);
  assert.deepEqual(confirmed.entry.source_ids, [weekNoteId]);
  await expect
    .poll(async () => (await read(weekly.page))?.weeklyFocus)
    .toBeNull();
  record(
    "Sunday’s proposed focus persists for review and changes the saved guidance only after confirmation",
  );

  await send(weekly.page, "Could this also be a small way to grow?");
  await expect(button(weekly.page, "Yes, use this focus")).toBeVisible();
  // Explicit fixture: another device sets a fixed Be focus after this proposal.
  confirmed.entry.meta = { ...confirmed.entry.meta, pace: "stay", orbit: "Be" };
  confirmed.revision += 1;
  await weekly.page.reload();
  await expect(button(weekly.page, "Yes, use this focus")).toBeVisible();
  const writesBeforeFixed = weekly.mutations.length;
  await button(weekly.page, "Yes, use this focus").click();
  await expect(
    weekly.page.getByText(
      "Your fixed focus has changed. Keep it, or choose a new focus in Rhythms.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(weekly.mutations.length, writesBeforeFixed);
  assert.equal(confirmed.entry.meta.pace, "stay");
  assert.equal(confirmed.entry.meta.orbit, "Be");
  assert.equal(confirmed.entry.meta.focus_area, "Passions");
  await button(weekly.page, "Keep my current focus").click();
  await expect(button(weekly.page, "Yes, use this focus")).toHaveCount(0);
  await expect
    .poll(async () => (await read(weekly.page))?.weeklyFocus)
    .toBeNull();
  await photo(weekly.page, "04-fixed-focus-respected");
  record(
    "A pending Sunday proposal cannot override a fixed focus chosen on another device",
  );

  await weekly.page.goto(`${base}/settings`);
  await field(weekly.page, "MORNING · HH:MM").fill("08:15");
  await field(weekly.page, "NIGHT · HH:MM").fill("20:45");
  await field(weekly.page, "TIMEZONE").fill("Pacific/Kiritimati");
  const downloadPromise = weekly.page.waitForEvent("download");
  await button(weekly.page, "Download my calendar reminders").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "iwillbe-check-in-reminders.ics");
  const calendarPath = `${artifacts}/iwillbe-check-in-reminders.ics`;
  await download.saveAs(calendarPath);
  const calendar = (await readFile(calendarPath, "utf8")).replace(
    /\r\n[ \t]/g,
    "",
  );
  assert.equal((calendar.match(/^BEGIN:VEVENT\r?$/gm) || []).length, 2);
  assert.equal((calendar.match(/^END:VEVENT\r?$/gm) || []).length, 2);
  assert.equal((calendar.match(/^RRULE:FREQ=DAILY\r?$/gm) || []).length, 2);
  assert.equal((calendar.match(/^BEGIN:VALARM\r?$/gm) || []).length, 2);
  assert.match(calendar, /^X-WR-TIMEZONE:Pacific\/Kiritimati\r?$/m);
  assert.match(calendar, /^DTSTART;TZID=Pacific\/Kiritimati:\d{8}T081500\r?$/m);
  assert.match(calendar, /^DTSTART;TZID=Pacific\/Kiritimati:\d{8}T204500\r?$/m);
  for (const privateText of [
    "PRIVATE_NAME_FIXTURE",
    "PRIVATE_WHY_FIXTURE",
    "PRIVATE_COMMITMENT_FIXTURE",
    "PRIVATE_WEEK_NOTE_FIXTURE",
    "sketching outside",
    owner,
  ])
    assert(
      !calendar.includes(privateText),
      `A calendar reminder must not disclose ${privateText}`,
    );
  assert.equal(weekly.tables.profiles[0].timezone, "Pacific/Kiritimati");
  assert.equal(weekly.tables.profiles[0].morning_time, "08:15");
  assert.equal(weekly.tables.profiles[0].evening_time, "20:45");
  assert.equal(weekly.tables.profiles[0].revision, 2);
  await expect(
    weekly.page.getByText(
      "Open the downloaded file in your calendar and accept the reminders. Enable calendar notifications to receive them.",
      { exact: true },
    ),
  ).toBeVisible();
  await photo(weekly.page, "05-calendar-reminders-downloaded");
  record(
    "Settings downloads two daily reminders in the saved profile timezone, with no private stories or commitments",
  );

  assert.deepEqual(errors, []);
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify({ passed: true, checks, errors }, null, 2),
  );
} catch (error) {
  console.error(error);
  if (active) {
    await active
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${artifacts}/failure.txt`,
      await active
        .locator("body")
        .innerText()
        .catch(() => ""),
    );
  }
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      { passed: false, checks, errors, failure: String(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
