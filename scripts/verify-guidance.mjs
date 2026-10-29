import {
  installAccountFixture,
  fixturePracticeKey,
} from "./account-fixture.mjs";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";

// Synthetic signed-in fixtures only. No live authentication, model requests, or production writes.
const base = (process.env.UI_BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
const artifacts = process.env.UI_ARTIFACT_DIR || "test-results/guidance";
const storageKey = fixturePracticeKey;
const today = "2026-10-26";
const checks = [],
  errors = [];
let browser,
  active,
  nextId = 1;
await mkdir(artifacts, { recursive: true });
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_EXECUTABLE_PATH)
  launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
else if (process.env.PLAYWRIGHT_CHANNEL)
  launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
else
  launchOptions.executablePath = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
  ].find(existsSync);
const id = () =>
  `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
const entry = (kind, title, extra = {}) => ({
  id: id(),
  kind,
  title,
  body: "",
  state: "active",
  source: "Synthetic guidance regression fixture",
  source_ids: [],
  meta: {},
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-01T12:00:00Z",
  ...extra,
});
const intention = (day, extra = {}) => ({
  id: id(),
  day,
  action: "Read a chapter",
  value: "",
  person: "me",
  created_at: `${day}T10:00:00Z`,
  ...extra,
});
const reflection = (i, extra = {}) => ({
  intention_id: i.id,
  outcome: "yes",
  energy: "lit",
  value_choice: null,
  reflection: "",
  created_at: `${i.day}T21:00:00Z`,
  ...extra,
});
const practice = (extra = {}, day = today) => ({
  profile: {
    display_name: "",
    north_star: "",
    values: [],
    interests: [],
    onboarded: true,
    timezone: "UTC",
    morning_time: "08:00",
    evening_time: "20:30",
  },
  intentions: [],
  checkIns: [],
  memories: [],
  messages: [],
  entries: [
    entry("preferences", "Check-in session", {
      meta: { last_check_in_at: `${day}T08:00:00Z` },
    }),
  ],
  ...extra,
});
const button = (page, name) => page.getByRole("button", { name, exact: true });
const field = (page, name) => page.getByRole("textbox", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
const text = (page, name) => page.getByText(name, { exact: true });
const read = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const kept = (page, predicate) =>
  expect
    .poll(async () => predicate(await read(page)), { timeout: 10000 })
    .toBe(true);
const go = (page, path) => page.goto(base + path);
const record = (description) => {
  checks.push(description);
  console.log(`PASS ${description}`);
};
const noOverflow = async (page, label) =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    `${label}: horizontal overflow`,
  );
const noGuilt = async (page) =>
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /you missed|you failed|catch up on|been \d+ days|\d+[- ]day streak/i,
  );
const newFixture = async (data, day = today) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 568 },
    timezoneId: "UTC",
  });
  await context.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem("iwillbe.guidance.fixture.seeded")) {
        localStorage.setItem(key, JSON.stringify(value));
        localStorage.setItem("iwillbe.guidance.fixture.seeded", "true");
      }
    },
    { key: storageKey, value: data },
  );
  await installAccountFixture(context);
  const page = await context.newPage();
  active = page;
  page.on("pageerror", (error) => errors.push(error.message));
  // Date advances normally from a deterministic starting day. Keeping time
  // running preserves real ordering of successive saved versions and drafts.
  await page.clock.install({ time: new Date(`${day}T16:00:00Z`) });
  return { context, page };
};
const keyboardActivate = async (page, name) => {
  const target = button(page, name);
  await target.scrollIntoViewIfNeeded();
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
};

try {
  browser = await chromium.launch(launchOptions);

  {
    const p = practice();
    p.entries.push(
      entry("question", "What lit you up?", { state: "stopped" }),
      entry("question", "What caught your interest today?", {
        state: "open",
        meta: { next_day: "2026-10-28" },
      }),
      entry("question", "When did time fly today?", { state: "stopped" }),
    );
    const { context, page } = await newFixture(p);
    await go(page, "/reflect");
    await expect(heading(page, "That's enough for tonight.")).toBeVisible();
    await expect(field(page, "A THOUGHT FROM TODAY")).toHaveCount(0);
    for (const q of p.entries.filter((e) => e.kind === "question"))
      await expect(heading(page, q.title)).toHaveCount(0);
    await noOverflow(page, "quiet night with no eligible question");
    await button(page, "Done for tonight").click();
    await expect(page).toHaveURL(base + "/");
    assert.equal(
      (await read(page)).entries.filter((e) => e.kind === "story").length,
      0,
    );
    await context.close();
    record(
      "QuietNight closes gently when all prompts are stopped or deferred, without fabricating a reflection",
    );
  }

  {
    const p = practice();
    p.entries.push(
      entry("question", "What lit you up?", { state: "stopped" }),
      entry("question", "What caught your interest today?", {
        state: "open",
        meta: { next_day: "2026-10-28" },
      }),
    );
    const { context, page } = await newFixture(p);
    await go(page, "/reflect");
    await expect(heading(page, "When did time fly today?")).toBeVisible();
    await page.setViewportSize({ width: 320, height: 330 });
    await field(page, "A THOUGHT FROM TODAY").fill(
      "I repaired a radio and enjoyed tracing where the sound disappeared.",
    );
    await field(page, "A THOUGHT FROM TODAY").focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" I would like to explore it again.");
    await noOverflow(page, "night thought with reduced keyboard viewport");
    await button(page, "There’s a new possibility in this thought").click();
    await field(page, "A POSSIBILITY").fill("Repairing old radios");
    assert.equal(
      (await read(page)).entries.filter((e) => e.kind === "interest").length,
      0,
      "Naming a possibility is still a draft until it is kept",
    );
    await keyboardActivate(page, "Keep this as a Maybe");
    await expect(button(page, "Done for tonight")).toBeVisible();
    await kept(page, (saved) =>
      saved.entries.some(
        (e) =>
          e.kind === "interest" &&
          e.title === "Repairing old radios" &&
          e.state === "spark",
      ),
    );
    const saved = await read(page);
    const maybe = saved.entries.find((e) => e.title === "Repairing old radios");
    assert(
      saved.entries.some(
        (e) =>
          e.kind === "story" &&
          maybe.source_ids.includes(e.id) &&
          e.body.includes("I would like to explore it again"),
      ),
    );
    assert.equal(
      saved.entries.find((e) => e.title === "What lit you up?").state,
      "stopped",
    );
    await noGuilt(page);
    await context.close();
    record(
      "An eligible night prompt works by keyboard at 320px; an explicitly named Maybe retains its source thought",
    );
  }

  for (const stopped of [false, true]) {
    const interest = entry("interest", "Repairing old radios", {
      state: "craft",
    });
    const i = intention(today, {
      action: "Replace a loose wire",
      interest: interest.title,
      interest_id: interest.id,
      planet: "Grow",
      when_context: "After lunch at the desk",
    });
    const p = practice({ intentions: [i] });
    p.entries.push(
      interest,
      entry("question", "What did you practice, and what did you learn?", {
        state: stopped ? "stopped" : "open",
        meta: {
          next_day: "2026-10-28",
          last_asked_at: "2026-10-25T21:00:00Z",
          last_asked_session: "night:2026-10-25",
        },
      }),
    );
    const { context, page } = await newFixture(p);
    await go(page, "/reflect");
    await expect(text(page, "After lunch at the desk")).toBeVisible();
    await button(page, "I did").click();
    await expect(button(page, "Keep this reflection")).toBeVisible();
    await expect(field(page, "WHAT I PRACTICED AND LEARNED")).toHaveCount(0);
    await expect(
      heading(page, "What did you practice, and what did you learn?"),
    ).toHaveCount(0);
    await expect(
      heading(page, "What did today’s practice teach you?"),
    ).toHaveCount(0);
    await expect(button(page, "Add a thought from today")).toHaveCount(0);
    await button(page, "Keep this reflection").click();
    await expect(button(page, "Done for tonight")).toBeVisible();
    await kept(page, (saved) =>
      saved.checkIns.some(
        (c) => c.intention_id === i.id && c.outcome === "yes",
      ),
    );
    const saved = await read(page),
      result = saved.checkIns.find((c) => c.intention_id === i.id);
    assert.equal(result.reflection, "");
    assert.equal(result.energy, null);
    assert.equal(
      saved.entries.find((e) => e.kind === "question").state,
      stopped ? "stopped" : "open",
    );
    await noGuilt(page);
    await context.close();
    record(
      `All in respects a ${stopped ? "stopped" : "deferred"} question without substituting a paraphrase or inventing learning`,
    );
  }

  {
    const old = intention("2026-09-05", {
      interest: "Ceramics",
      action: "Shape a bowl",
      planet: "Passions",
    });
    const recent = intention("2026-10-25", {
      interest: "Repairing old radios",
      action: "Fix the tuning knob",
      planet: "Grow",
    });
    const unfinished = intention(today, {
      interest: "Cooking",
      action: "Bake bread",
    });
    const future = intention("2026-10-27", {
      interest: "Teaching",
      action: "Explain a new idea",
    });
    const p = practice({
      intentions: [old, recent, unfinished, future],
      checkIns: [
        reflection(old),
        reflection(recent),
        reflection(unfinished, { outcome: "not_yet" }),
        reflection(future),
      ],
    });
    const { context, page } = await newFixture(p);
    await go(page, "/rhythms");
    await button(page, "Sunday Explore").click();
    await expect(
      heading(page, "Here’s what I noticed about you this week"),
    ).toBeVisible();
    await expect(text(page, "“Fix the tuning knob” lit you up.")).toBeVisible();
    await button(page, "Make a little space").click();
    await button(page, "I don’t know yet").click();
    await expect(text(page, "Repairing old radios")).toBeVisible();
    await expect(text(page, "Fix the tuning knob")).toBeVisible();
    for (const excluded of ["Ceramics", "Shape a bowl", "Cooking", "Teaching"])
      await expect(text(page, excluded)).toHaveCount(0);
    await button(page, "Keep this as a Maybe").click();
    await kept(page, (saved) =>
      saved.entries.some(
        (e) =>
          e.title === "Repairing old radios" &&
          e.source_ids.includes(recent.id),
      ),
    );
    assert.deepEqual(
      (await read(page)).entries.find((e) => e.title === "Repairing old radios")
        .source_ids,
      [recent.id],
    );
    assert(
      !(await read(page)).entries.some((e) => e.title === "Weekly focus"),
      "A proposed weekly focus waits for Sounds right",
    );
    await button(page, "Sounds right").click();
    await expect(heading(page, "A little room to live.")).toBeVisible();
    await kept(page, (saved) =>
      saved.entries.some(
        (e) => e.title === "Weekly focus" && e.meta.focus_area === "Grow",
      ),
    );
    await expect(field(page, "Something I’ve been meaning to do")).toHaveCount(
      0,
    );
    await noOverflow(page, "Sunday close");
    await context.close();
    record(
      "Sunday explores a custom interest from this week, excludes stale/unfinished/future activity, and saves only confirmed focus",
    );
  }

  {
    const { context, page } = await newFixture(practice());
    await go(page, "/telescope");
    const picture =
      "More time outdoors and closer relationships with my sisters. Learn French.";
    await field(page, "The life I picture").fill(picture);
    await button(page, "Keep this picture").click();
    await expect(heading(page, "Does this sorting feel right?")).toBeVisible();
    assert.equal(
      (await read(page)).entries.filter((e) => e.kind === "vision").length,
      0,
    );
    await expect(field(page, "People")).toHaveValue(
      "closer relationships with my sisters",
    );
    await expect(field(page, "Passions")).toHaveValue("More time outdoors");
    await expect(field(page, "Grow")).toHaveValue("Learn French");
    await field(page, "People").fill("Sunday dinner with my sisters");
    await button(page, "Remove Grow").click();
    await page.reload();
    await expect(heading(page, "Does this sorting feel right?")).toBeVisible();
    await expect(field(page, "People")).toHaveValue(
      "Sunday dinner with my sisters",
    );
    await expect(field(page, "Grow")).toHaveValue("");
    assert.equal(
      (await read(page)).entries.filter((e) => e.kind === "vision").length,
      0,
    );
    await page.setViewportSize({ width: 320, height: 330 });
    await field(page, "People").focus();
    await noOverflow(page, "area map at reduced keyboard viewport");
    await keyboardActivate(page, "Confirm these areas");
    await expect(button(page, "Done for now")).toBeVisible();
    await kept(page, (saved) => saved.entries.some((e) => e.kind === "vision"));
    const first = (await read(page)).entries.find((e) => e.kind === "vision");
    assert.equal(first.body, picture);
    assert.equal(
      first.meta.planet_notes.People,
      "Sunday dinner with my sisters",
    );
    assert.equal(first.meta.planet_notes.Grow, "");
    await go(page, "/telescope");
    await button(page, "Tweak it").click();
    await field(page, "The life I picture").fill(
      "Calmer mornings and time with my sisters.",
    );
    await button(page, "Keep this picture").click();
    await button(page, "Confirm these areas").click();
    await kept(
      page,
      (saved) =>
        saved.entries.filter(
          (e) => e.kind === "vision" && e.meta.horizon === "year",
        ).length === 2,
    );
    assert.deepEqual(
      (await read(page)).entries.find((e) => e.id === first.id),
      first,
    );
    await context.close();
    record(
      "One year out requires an editable confirmed area map; reload and keyboard input retain the draft and earlier versions",
    );
  }

  {
    const oldWhy = entry("why", "My why", {
      state: "accepted",
      body: "Help people feel welcome.",
      created_at: "2026-06-01T12:00:00Z",
    });
    const oldStory = entry("story", "A much older story", {
      body: "This older story belongs in the archive.",
      created_at: "2026-01-01T12:00:00Z",
      updated_at: "2026-01-01T12:00:00Z",
    });
    const recentStory = entry("story", "An ordinary good day", {
      body: "I enjoyed helping someone repair their bike.",
      updated_at: "2026-10-23T12:00:00Z",
    });
    const lit = intention("2026-10-24", {
      action: "Help repair a bike",
      interest: "Repairing bikes",
      person: "Sam",
    });
    const year = entry("vision", "One year out", {
      body: "Time outdoors and people close by.",
      meta: {
        horizon: "year",
        version: 1,
        planet_notes: { People: "People close by" },
      },
    });
    const life = entry("vision", "Later in life · 90", {
      body: "People know I made room for them.",
      meta: { horizon: "life", life_age: 90, version: 1 },
    });
    const p = practice({ intentions: [lit], checkIns: [reflection(lit)] });
    p.entries.push(oldWhy, oldStory, recentStory, year, life);
    const { context, page } = await newFixture(p);
    await go(page, "/why?revisit=true");
    await expect(heading(page, "What your days are showing.")).toBeVisible();
    await expect(field(page, "In my words")).toHaveCount(0);
    await expect(text(page, oldStory.body)).toHaveCount(0);
    await button(page, "Use as a clue").first().click();
    await button(page, "Make a little room").click();
    const thought = "I want people to leave with more confidence.";
    await field(page, "One thought is enough").fill(thought);
    await button(page, "Keep this thought").click();
    await expect(field(page, "In my words")).toBeVisible();
    await field(page, "In my words").fill("Help people trust their own voice.");
    await page.reload();
    await expect(field(page, "In my words")).toHaveValue(
      "Help people trust their own voice.",
    );
    await button(page, "Keep this version").click();
    await expect(
      heading(page, "Would this help you choose between two options?"),
    ).toBeVisible();
    assert.equal(
      (await read(page)).entries.filter(
        (e) => e.kind === "why" && e.state === "accepted",
      ).length,
      1,
    );
    await button(page, "Yes, use this why").click();
    await expect(
      heading(page, "Is this still the life you want?"),
    ).toBeVisible();
    const saved = await read(page);
    const nextWhy = saved.entries.find(
      (e) => e.kind === "why" && e.id !== oldWhy.id && e.state === "accepted",
    );
    const thoughtEntry = saved.entries.find(
      (e) => e.kind === "story" && e.body === thought,
    );
    assert(
      nextWhy && thoughtEntry && nextWhy.source_ids.includes(thoughtEntry.id),
      "The accepted why keeps the newly saved thought as evidence",
    );
    assert(
      nextWhy.source_ids.includes(lit.id),
      "An explicitly selected clue is preserved",
    );
    assert.deepEqual(
      saved.entries.find((e) => e.id === oldWhy.id),
      oldWhy,
    );
    await button(page, "Still true").click();
    await expect(
      heading(page, "Does this picture still feel like you?"),
    ).toBeVisible();
    await expect(text(page, life.body)).toBeVisible();
    await button(page, "Still true").click();
    await expect(heading(page, "Take this back into your life.")).toBeVisible();
    await kept(page, (result) =>
      result.entries.some(
        (e) =>
          e.title === "Why revisit" &&
          e.state === "done" &&
          e.meta.why_revisited_at,
      ),
    );
    const result = await read(page);
    assert.equal(
      result.entries.filter((e) => e.kind === "why" && e.state === "accepted")
        .length,
      2,
    );
    assert.equal(
      result.entries.filter(
        (e) => e.kind === "vision" && e.meta.horizon === "year",
      ).length,
      2,
    );
    assert.equal(
      result.entries.filter(
        (e) => e.kind === "vision" && e.meta.horizon === "life",
      ).length,
      2,
    );
    assert.deepEqual(
      result.entries.find((e) => e.id === year.id),
      year,
    );
    assert.deepEqual(
      result.entries.find((e) => e.id === life.id),
      life,
    );
    await noOverflow(page, "guided why close");
    await context.close();
    record(
      "Guided why keeps a draft across reload, waits for explicit acceptance, cites the new thought and preserves why/future versions",
    );
  }

  {
    const day = "2026-11-06",
      yesterday = "2026-11-05";
    const why = entry("why", "My why", {
      state: "accepted",
      body: "Make room for curiosity and care.",
    });
    const interest = entry("interest", "Music", {
      state: "love",
      meta: { planet: "Passions", into_it_since: "2026-10-01T12:00:00Z" },
    });
    const before = intention(yesterday, {
      interest: "Music",
      interest_id: interest.id,
      action: "Sing at home",
      planet: "Passions",
    });
    const open = entry(
      "question",
      "What would your best ordinary day include?",
      {
        state: "open",
        meta: { next_day: "2026-11-03", last_asked_at: "2026-11-01T12:00:00Z" },
      },
    );
    const p = practice(
      { intentions: [before], checkIns: [reflection(before)] },
      day,
    );
    p.entries.push(
      why,
      interest,
      open,
      entry("preferences", "Season", {
        meta: { pace: "stay", orbit: "Passions" },
      }),
    );
    const { context, page } = await newFixture(p, day);
    await go(page, "/ritual");
    await expect(text(page, "Music lit you up yesterday.")).toBeVisible();
    await expect(
      heading(page, "What would a small music moment look like today?"),
    ).toBeVisible();
    await field(page, "TODAY, I WILL…").fill("Play one song with my sister");
    await button(page, "Music").click();
    await button(page, "Continue").click();
    await field(page, "WHEN OR AFTER WHAT? · OPTIONAL").fill(
      "After dinner at home",
    );
    await button(page, "This expresses my why").click();
    await expect(text(page, why.body)).toBeVisible();
    assert(
      !(await read(page)).entries.some(
        (e) => e.meta.period === `why-action:${day}`,
      ),
      "The why connection remains a draft until the commitment is saved",
    );
    await button(page, "For me").click();
    await button(page, "Save for today").click();
    await expect(button(page, "Done for now")).toBeVisible();
    await kept(page, (saved) =>
      saved.entries.some(
        (e) =>
          e.meta.period === `why-action:${day}` &&
          e.source_ids.includes(why.id) &&
          e.body === "I will play one song with my sister",
      ),
    );
    await button(page, "Carry a question today").click();
    await expect(text(page, open.title)).toBeVisible();
    await expect(
      text(page, "No need to answer now. Take it with you."),
    ).toBeVisible();
    await go(page, "/reflect");
    await button(page, "I did").click();
    await button(page, "Lit me up").click();
    await expect(heading(page, open.title)).toBeVisible();
    await expect(
      heading(page, "Where did your why show up today?"),
    ).toHaveCount(0);
    await field(page, "WHAT I NOTICED").fill(
      "A little music and time with people I love.",
    );
    await button(page, "Keep this reflection").click();
    await expect(button(page, "Done for tonight")).toBeVisible();
    await kept(page, (saved) =>
      saved.entries.some((e) => e.id === open.id && e.state === "answered"),
    );
    await expect(
      text(
        page,
        "Music lit you up both today and when you chose “Sing at home”.",
      ),
    ).toBeVisible();
    await noOverflow(page, "source-grounded night insight");
    await context.close();
    record(
      "Morning carries useful evidence forward, saves an explicit why link, and night invites the one carried question with a grounded insight",
    );
  }

  assert.deepEqual(errors, [], "Browser page errors");
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify({ passed: true, base, checks, errors }, null, 2),
  );
  console.log("Guidance browser regressions passed");
} catch (error) {
  console.error(error);
  if (active && !active.isClosed()) {
    console.log(
      await active
        .locator("body")
        .ariaSnapshot()
        .catch(() => "UI unavailable"),
    );
    await active
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
  }
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      { passed: false, base, checks, errors, failure: String(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
