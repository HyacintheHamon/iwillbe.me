// Offline browser regression suite for the November beta. All Supabase traffic
// is intercepted; this never creates a real account, sends email or calls AI.
import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  installAccountFixture,
  fixturePracticeKey,
} from "./account-fixture.mjs";
import { emptyPractice } from "../src/domain.ts";
import { entryInput } from "../src/journey.ts";
import { QUICK_PICKS, PRIORITY_WORDS } from "../src/priorities.ts";
import {
  STARTER_MISSIONS,
  matchingMissions,
} from "../supabase/functions/_shared/missions.ts";
const base = (process.env.UI_BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
});
const errors = [];
async function setup(practice) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
  });
  await installAccountFixture(context);
  await context.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(value));
    },
    { key: fixturePracticeKey, value: practice },
  );
  const fail = { nextSave: false };
  await context.route("https://*.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const respond = (value, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (url.pathname.includes("/functions/v1/chloe")) {
      const input = request.postDataJSON();
      if (input.action === "start_checkin") return respond({ started: true });
      if (input.action === "night_thought") return respond({ thought: null });
      return respond({ error: "AI disabled in browser fixture" }, 503);
    }
    if (url.pathname.endsWith("/rpc/mission_options")) {
      const input = request.postDataJSON();
      return respond(
        matchingMissions(STARTER_MISSIONS, input.p_tag, input.p_step),
      );
    }
    if (url.pathname.endsWith("/rpc/record_quick_pick")) return respond(null);
    if (url.pathname.endsWith("/support_state")) return respond(null);
    if (url.pathname.endsWith("/quick_pick_responses")) return respond([]);
    if (url.pathname.endsWith("/quick_pick_cards")) return respond(QUICK_PICKS);
    if (url.pathname.endsWith("/priority_words"))
      return respond(
        PRIORITY_WORDS.map((p) => ({ name: p.name, priority_group: p.group })),
      );
    if (
      url.pathname.endsWith("/intentions") &&
      ["POST", "PATCH"].includes(request.method()) &&
      fail.nextSave
    ) {
      fail.nextSave = false;
      return respond({ message: "Fixture: try saving again" }, 503);
    }
    return route.fallback();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const state = () =>
    page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      fixturePracticeKey,
    );
  return { context, page, button, state, fail };
}
await mkdir("test-results/beta-feedback", { recursive: true });
try {
  const fresh = emptyPractice();
  fresh.profile.timezone = "UTC";
  const onboarding = await setup(fresh);
  const { page, button, state } = onboarding;
  await page.goto(base + "/onboarding");
  await button("Let's begin").click();
  for (let i = 0; i < 15; i++) {
    await expect(
      page.getByText(`iwillbe.${QUICK_PICKS[i].title}`, { exact: true }),
    ).toBeVisible();
    await button(
      i === 0
        ? "Love it"
        : i === 1
          ? "Like it"
          : i === 2
            ? "Open to it"
            : "Not now",
    ).click();
  }
  await button("Continue").click();
  await expect(
    page.getByRole("heading", { name: "Who do you want to be?", exact: true }),
  ).toBeVisible();
  for (const p of PRIORITY_WORDS.slice(0, 10))
    await button(`iwillbe.${p.name}`).click();
  await button("Choose what to work on").click();
  for (const p of PRIORITY_WORDS.slice(0, 3))
    await button(`iwillbe.${p.name}`).click();
  await button("Keep my priorities").click();
  await button("Leave this for later").click();
  await expect(
    page.getByRole("heading", {
      name: "When did time disappear on you recently?",
      exact: true,
    }),
  ).toBeVisible();
  const saved = await state();
  assert.equal(
    saved.entries.filter((e) => e.kind === "value" && e.state === "working_on")
      .length,
    3,
  );
  assert.equal(saved.entries.filter((e) => e.kind === "value").length, 10);
  assert.equal(
    saved.entries.find((e) => e.title === "reading").state,
    "want_to_try",
  );
  assert.equal(
    saved.entries.find((e) => e.title === "exploring new places").state,
    "spark",
  );
  console.log(
    "PASS 15 quick picks, ten priorities, three working priorities, story continuity",
  );
  await onboarding.context.close();

  const practice = emptyPractice();
  practice.profile.onboarded = true;
  practice.profile.timezone = "UTC";
  const now = new Date().toISOString();
  practice.entries = [
    {
      ...entryInput("interest", "reading", { state: "want_to_try" }),
      id: "11111111-1111-4111-8111-111111111111",
      created_at: now,
      updated_at: now,
      revision: 1,
    },
  ];
  const action = await setup(practice);
  const p = action.page,
    b = action.button;
  await p.goto(base + "/ritual");
  await expect(b("Continue")).toBeDisabled();
  await b("Passions").click();
  await b("Continue").click();
  await expect(
    p.getByText("Something to try with reading:", { exact: true }),
  ).toBeVisible();
  await p.goto(base + "/galaxy");
  await b("reading · Want to try").click();
  await expect(p.getByRole("button", { name: /^Normal:/ })).toBeVisible();
  await b("Make this today’s action").click();
  await p
    .getByRole("textbox", { name: "When, or right after what?", exact: true })
    .fill("After lunch");
  await b("Continue").click();
  await expect(
    p.getByRole("heading", { name: "For whom?", exact: true }),
  ).toBeVisible();
  await b("For me").click();
  await b("For me").click();
  await b("+ Someone").click();
  await p.getByRole("textbox", { name: "Name", exact: true }).fill("Sam");
  await b("Continue").click();
  action.fail.nextSave = true;
  await b("Done · save for today").click();
  await expect(b("Done · save for today")).toBeVisible();
  await expect(p.getByText(/Fixture: try saving again/)).toBeVisible();
  await b("Done · save for today").click();
  await expect(
    p.getByRole("heading", { name: "Your action for today.", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await action.state()).intentions.length)
    .toBe(1);
  const commitment = (await action.state()).intentions[0];
  assert.equal(commitment.for_whom, "Sam");
  assert.equal(commitment.for_me, false);
  assert.equal(commitment.when_context, "After lunch");
  assert.ok(commitment.mission_id);
  await p.reload();
  await expect(p.getByText(/For Sam/)).toBeVisible();
  for (const width of [320, 390]) {
    await p.setViewportSize({ width, height: 844 });
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    await p.screenshot({
      path: `test-results/beta-feedback/today-${width}.png`,
    });
  }
  await p.goto(base + "/galaxy");
  await b("reading · Want to try").click();
  await b("Make this today’s action").click();
  await expect(
    p.getByRole("heading", { name: "Replace today’s action?", exact: true }),
  ).toBeVisible();
  await b("Keep today’s action").click();
  assert.equal((await action.state()).intentions.length, 1);
  console.log(
    "PASS explicit area, map missions, beneficiary toggle, failed-save retry, durable Today and replacement consent",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
