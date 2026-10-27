import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = (process.env.UI_BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
const artifacts = process.env.UI_ARTIFACT_DIR || "test-results/onboarding";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" }),
});
const checks = [],
  errors = [];
let active;
const practiceKey = "iwillbe.practice.v2.guest";
const draftKey = "iwillbe.draft.v1.guest.discovery";
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
const read = (page, key = practiceKey) =>
  page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)),
    key,
  );
const saved = (page, predicate, key = practiceKey) =>
  expect.poll(async () => predicate(await read(page, key))).toBe(true);
const record = (message) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};
const newPage = async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  active = page;
  return { context, page };
};
const photo = async (page, name) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
};
const questions = [
  "When did time disappear on you recently?",
  "What did you love doing as a kid?",
  "Who do you admire, and why?",
];

try {
  const { page } = await newPage();
  await page.goto(`${base}/onboarding`);
  await button(page, "Let's begin").click();
  await button(page, "Curious").click();
  await button(page, "Continue with these").click();
  await expect(heading(page, questions[0])).toBeVisible();
  await saved(page, (p) =>
    p?.entries.some((e) => e.title === "Ceramics" && e.state === "spark"),
  );
  const firstId = (await read(page)).entries.find(
    (e) => e.title === "Ceramics",
  ).id;

  await button(page, "Go back").click();
  await button(page, "Undo last choice").click();
  await button(page, "Already love").click();
  await button(page, "Continue with these").click();
  await saved(page, (p) =>
    p?.entries.some((e) => e.id === firstId && e.state === "love"),
  );
  await button(page, "Go back").click();
  await button(page, "Undo last choice").click();
  await button(page, "Not for me").click();
  await button(page, "Continue with these").click();
  await saved(page, (p) => p && !p.entries.some((e) => e.id === firstId));
  record(
    "Saved quick picks reconcile Curious → Already love → Not for me without duplicates",
  );

  await button(page, "Go back").click();
  await button(page, "Undo last choice").click();
  await button(page, "Curious").click();
  await expect(heading(page, "Mindful walking")).toBeVisible();
  const cards = ["Ceramics"];
  while (await button(page, "Continue with these").isVisible()) {
    assert(cards.length < 31, "The card collection must end");
    const title = await page.getByRole("heading").last().innerText();
    cards.push(title);
    await button(
      page,
      title === "Reading" ? "Already love" : "Not for me",
    ).click();
    await expect(heading(page, title)).toHaveCount(0);
  }
  assert.equal(new Set(cards).size, 30);
  await button(page, "Continue").click();
  await expect(heading(page, questions[0])).toBeVisible();
  record(
    "All thirty optional picture cards remain available; the observation shares the first story screen",
  );

  const mainStory =
    "I was repairing a bike with my daughter. I'm good at explaining things clearly.";
  await field(page, "Your story").fill(mainStory);
  await button(page, "Continue").click();
  await expect(
    heading(page, "What about being together stayed with you?"),
  ).toBeVisible();
  await field(page, "A little more").fill(
    "This is a detail I decided not to keep.",
  );
  await page.reload();
  await expect(field(page, "A little more")).toHaveValue(
    "This is a detail I decided not to keep.",
  );
  await button(page, "Keep just my story").click();
  await expect(heading(page, questions[1])).toBeVisible();
  await saved(
    page,
    (p) => p?.entries.find((e) => e.title === questions[0])?.body === mainStory,
  );
  assert.equal((await read(page, draftKey)).followUps[0], "");
  assert(
    !JSON.stringify((await read(page)).entries).includes(
      "detail I decided not to keep",
    ),
  );
  record(
    "A contextual follow-up resumes after reload and Keep just my story drops its typed text",
  );

  await field(page, "Your story").fill(
    "I loved drawing animals when I was a kid.",
  );
  await button(page, "Continue").click();
  await expect(heading(page, questions[2])).toBeVisible();
  await field(page, "Your story").fill(
    "My sister, for her fairness and the way she listens.",
  );
  await button(page, "Continue").click();
  await field(page, "Something to grow into").fill("Learning guitar");
  await button(page, "Keep this possibility").click();
  await field(page, "My why, in my words").fill(
    "Make room for curiosity and care.",
  );
  await button(page, "Keep my first draft").click();
  await expect(heading(page, "Repairing things")).toBeVisible();
  const beforeConsent = await read(page);
  const summaryDraft = await read(page, draftKey);
  assert(
    !beforeConsent.entries.some((e) =>
      ["strength", "person", "value"].includes(e.kind),
    ),
  );
  assert(!beforeConsent.entries.some((e) => e.title === "Repairing things"));
  assert.equal(
    beforeConsent.entries.filter(
      (e) => e.kind === "why" && e.state === "accepted",
    ).length,
    1,
  );
  await button(page, "Keep this possibility").click();
  await expect(heading(page, "My sister")).toBeVisible();
  await button(page, "Keep this person and why").click();
  await expect(heading(page, "Explaining things clearly")).toBeVisible();
  await button(page, "Keep this strength").click();
  await button(page, "Try on fairness").click();
  await saved(page, (p) =>
    p?.entries.some(
      (e) =>
        e.kind === "value" && e.title === "Fairness" && e.state === "trying",
    ),
  );
  const accepted = await read(page);
  assert.equal(
    accepted.entries.find((e) => e.title === "Repairing things").state,
    "tried",
  );
  for (const title of [
    "Repairing things",
    "My sister",
    "Explaining things clearly",
    "Fairness",
  ])
    assert(
      accepted.entries.find((e) => e.title === title).source_ids.length > 0,
    );
  await page.reload();
  await expect(button(page, "Find my check-in rhythm")).toBeVisible();
  assert.equal((await read(page)).entries.length, accepted.entries.length);
  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await photo(page, "01-confirmed-story-clues-320");
  await page.setViewportSize({ width: 390, height: 844 });
  record(
    "Guest story-derived interest, admired person, strength and value each require explicit consent and retain evidence",
  );

  await button(page, "Find my check-in rhythm").click();
  await field(page, "My morning anchor").fill("After my first coffee");
  await button(page, "Keep this anchor").click();
  await expect(field(page, "My night anchor")).toBeVisible();
  await expect(field(page, "Time · HH:MM")).toHaveCount(0);
  await field(page, "My night anchor").fill("After brushing my teeth");
  await button(page, "Keep this anchor").click();
  await expect(button(page, "Choose my first I will")).toBeVisible();
  await saved(
    page,
    (p) =>
      p?.profile.onboarded &&
      p.entries.some(
        (e) =>
          e.title === "Check-in anchors" &&
          e.meta.morning_anchor === "After my first coffee" &&
          e.meta.evening_anchor === "After brushing my teeth",
      ),
  );
  await button(page, "Set reminder times · optional").click();
  await field(page, "Time · HH:MM").fill("08:15");
  await button(page, "Keep this time").click();
  await field(page, "Time · HH:MM").fill("20:45");
  await button(page, "Keep this time").click();
  await saved(
    page,
    (p) =>
      p?.profile.morning_time === "08:15" && p.profile.evening_time === "20:45",
  );
  await photo(page, "02-ready-for-first-commitment");
  await button(page, "Choose my first I will").click();
  await expect(page).toHaveURL(/\/ritual(?:\?|$)/);
  assert(new URL(page.url()).searchParams.get("value") === "Fairness");
  record(
    "Anchors save one at a time; optional clock setup no longer adds required steps before the first I will",
  );

  const protectedFlow = await newPage();
  await protectedFlow.page.goto(base);
  const manual = {
    id: "existing-manual-interest",
    kind: "interest",
    title: "Ceramics",
    body: "My existing notes",
    state: "spark",
    source: "Chosen by you",
    source_ids: [],
    meta: {},
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
  };
  await protectedFlow.page.evaluate(
    ({ key, practice }) => localStorage.setItem(key, JSON.stringify(practice)),
    {
      key: practiceKey,
      practice: {
        ...beforeConsent,
        profile: { ...beforeConsent.profile, onboarded: false },
        entries: [manual],
      },
    },
  );
  await protectedFlow.page.goto(`${base}/onboarding`);
  await button(protectedFlow.page, "Let's begin").click();
  await button(protectedFlow.page, "Already love").click();
  await button(protectedFlow.page, "Continue with these").click();
  await expect(heading(protectedFlow.page, questions[0])).toBeVisible();
  assert.deepEqual(
    (await read(protectedFlow.page)).entries.find((e) => e.id === manual.id),
    manual,
  );
  await button(protectedFlow.page, "Go back").click();
  await button(protectedFlow.page, "Undo last choice").click();
  await button(protectedFlow.page, "Not for me").click();
  await button(protectedFlow.page, "Continue with these").click();
  await expect(heading(protectedFlow.page, questions[0])).toBeVisible();
  assert.deepEqual(
    (await read(protectedFlow.page)).entries.find((e) => e.id === manual.id),
    manual,
  );
  record(
    "Existing interests are untouched by onboarding picks and corrections",
  );

  // Explicit synthetic account fixture. Every Supabase request is intercepted;
  // this check sends no user data, account email, or AI request to a real server.
  const signed = await newPage();
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-10-01T12:00:00Z",
  };
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: owner, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture`;
  const session = {
    access_token: token,
    refresh_token: "fixture-refresh",
    token_type: "bearer",
    user,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
  const account = structuredClone(beforeConsent);
  account.profile = { ...account.profile, id: owner, revision: 1 };
  account.entries = account.entries.map((entry) => ({ ...entry, revision: 1 }));
  assert.equal(
    account.entries.find(
      (entry) => entry.title === "What about being together stayed with you?",
    )?.meta.last_asked_session,
    "first-session",
  );
  const requests = [];
  let writes = 0;
  await signed.context.route(
    "https://mvhqovdznrzoduntyryh.supabase.co/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const respond = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (request.method() === "OPTIONS") return respond({});
      if (url.pathname === "/auth/v1/user") return respond(user);
      if (url.pathname === "/auth/v1/token") return respond(session);
      if (url.pathname === "/functions/v1/chloe") {
        requests.push(request.postDataJSON());
        if (requests.length === 1)
          return respond({ error: "Fixture unavailable" }, 503);
        return respond({
          proposals: [
            {
              kind: "interest",
              title: "Repairing a bike",
              body: "An activity from the moment you described.",
              evidence: [
                { story_index: 0, quote: "repairing a bike with my daughter" },
              ],
            },
            {
              kind: "strength",
              title: "Invented talent",
              body: "This must never be offered.",
              evidence: [
                { story_index: 0, quote: "I am a brilliant astronaut" },
              ],
            },
          ],
          follow_up: {
            story_index: 0,
            question: "What about being together stayed with you?",
          },
        });
      }
      const table = url.pathname.split("/").pop();
      if (table === "profiles" && request.method() === "GET")
        return respond([account.profile]);
      if (
        request.method() === "GET" &&
        ["intentions", "check_ins", "memories", "messages"].includes(table)
      )
        return respond([]);
      if (table === "journey_entries") {
        const represented = (rows) =>
          request
            .headers()
            .accept?.includes("application/vnd.pgrst.object+json")
            ? (rows[0] ?? null)
            : rows;
        const rowFor = ({ revision, ...entry }) => ({
          id: entry.id,
          kind: entry.kind,
          user_id: owner,
          entry,
          revision,
        });
        if (request.method() === "POST") {
          const row = request.postDataJSON();
          assert.equal(row.user_id, owner);
          assert(request.headers().prefer?.includes("return=representation"));
          assert(
            !request.headers().prefer?.includes("resolution=merge-duplicates"),
          );
          assert(!Object.hasOwn(row.entry, "revision"));
          if (account.entries.some((entry) => entry.id === row.id))
            return respond(
              { code: "23505", message: "Synthetic unique constraint" },
              409,
            );
          const savedEntry = { ...row.entry, revision: 1 };
          account.entries.push(savedEntry);
          writes++;
          return respond(represented([rowFor(savedEntry)]), 201);
        }
        if (request.method() === "PATCH") {
          const row = request.postDataJSON();
          assert.equal(url.searchParams.get("user_id"), `eq.${owner}`);
          assert.match(
            url.searchParams.get("revision") || "",
            /^eq\.[1-9]\d*$/,
          );
          const prior = account.entries.find(
            (entry) =>
              `eq.${entry.id}` === url.searchParams.get("id") &&
              `eq.${entry.revision}` === url.searchParams.get("revision"),
          );
          if (!prior) return respond([]);
          const savedEntry = { ...row.entry, revision: prior.revision + 1 };
          account.entries = account.entries.map((entry) =>
            entry.id === prior.id ? savedEntry : entry,
          );
          writes++;
          return respond(represented([rowFor(savedEntry)]));
        }
        assert.equal(request.method(), "GET");
        return respond(
          represented(
            account.entries
              .filter(
                (entry) =>
                  !url.searchParams.has("id") ||
                  url.searchParams.get("id") === `eq.${entry.id}`,
              )
              .map(rowFor),
          ),
        );
      }
      errors.push(
        `Unexpected fixture request: ${request.method()} ${url.pathname}`,
      );
      return respond({ error: "Unexpected fixture request" }, 500);
    },
  );
  await signed.page.goto(base);
  await signed.page.evaluate(
    ({ session, draft, owner }) => {
      localStorage.setItem(
        "sb-mvhqovdznrzoduntyryh-auth-token",
        JSON.stringify(session),
      );
      localStorage.setItem(
        `iwillbe.draft.v1.${owner}.discovery`,
        JSON.stringify(draft),
      );
    },
    {
      session,
      draft: { ...summaryDraft, growth: "UNSAVED_GROWTH_PRIVATE" },
      owner,
    },
  );
  await signed.page.goto(`${base}/onboarding`);
  await expect(
    button(signed.page, "Let Chloe look for a thread"),
  ).toBeVisible();
  assert.equal(requests.length, 0);
  await button(signed.page, "Let Chloe look for a thread").click();
  await expect(
    signed.page.getByText(
      "Chloe couldn't look just now. Your stories are saved, and you can keep going.",
      { exact: true },
    ),
  ).toBeVisible();
  assert.equal(writes, 0);
  await button(signed.page, "Let Chloe look for a thread").click();
  await expect(heading(signed.page, "Repairing a bike")).toBeVisible();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].action, "onboarding_insights");
  assert.equal(requests[1].stories[0].answer, mainStory);
  assert(!JSON.stringify(requests[1]).includes("UNSAVED_GROWTH_PRIVATE"));
  assert.equal(writes, 0);
  await expect(
    signed.page.getByText("Invented talent", { exact: true }),
  ).toHaveCount(0);
  await expect(button(signed.page, "Keep this question for later")).toHaveCount(
    0,
  );
  await button(signed.page, "Keep this possibility").click();
  await saved(
    signed.page,
    (p) => p?.entries.some((e) => e.title === "Repairing a bike"),
    `iwillbe.practice.v2.${owner}`,
  );
  assert.equal(writes, 1);
  assert.equal(account.entries.filter((e) => e.kind === "why").length, 1);
  await photo(signed.page, "03-ai-thread-explicit-consent");
  await signed.page.reload();
  await expect(
    button(signed.page, "Let Chloe look for a thread"),
  ).toBeVisible();
  assert.equal(requests.length, 2);
  assert.equal(writes, 1);
  record(
    "Optional signed-in synthesis requires a click, survives API failure, rejects fabricated evidence and repeated questions, and never auto-saves or changes the Why",
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
