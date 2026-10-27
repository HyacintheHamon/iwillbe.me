import { chromium } from "playwright";
import { expect } from "playwright/test";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = process.env.UI_ARTIFACT_DIR || "test-results/chloe-brief";
const base = (process.env.UI_BASE_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
const storageKey = "iwillbe.practice.v2.guest";
await mkdir(root, { recursive: true });
const errors = [];
const checks = [];
const contextOptions = {
  viewport: { width: 390, height: 844 },
  timezoneId: "America/New_York",
};
let browser;
let page;
let activePage;
const launchOptions = { headless: true };
if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
  assert(
    existsSync(process.env.PLAYWRIGHT_EXECUTABLE_PATH),
    "PLAYWRIGHT_EXECUTABLE_PATH does not exist",
  );
  launchOptions.executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;
} else if (process.env.PLAYWRIGHT_CHANNEL) {
  launchOptions.channel = process.env.PLAYWRIGHT_CHANNEL;
} else {
  const candidates = [
    chromium.executablePath(),
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
  ];
  const installed = candidates.find(existsSync);
  if (installed) launchOptions.executablePath = installed;
}
const button = (name, target = page) =>
  target.getByRole("button", { name, exact: true });
const field = (name, target = page) =>
  target.getByRole("textbox", { name, exact: true });
const heading = (name, target = page) =>
  target.getByRole("heading", { name, exact: true });
const go = async (path, target = page) => {
  await target.goto(base + path);
};
const shot = async (name, target = page) => {
  await target.evaluate(() => document.fonts.ready);
  await target.screenshot({ path: `${root}/${name}.png` });
};
const state = (target = page) =>
  target.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const noOverflow = async (path, target = page) => {
  assert.equal(
    await target.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    `${path} overflows horizontally`,
  );
};
const noGuilt = async (target = page) => {
  assert.doesNotMatch(
    await target.locator("body").innerText(),
    /you missed|you failed|catch up on|you haven't|been \d+ days/i,
  );
};
const kept = async (predicate) =>
  expect
    .poll(async () => predicate(await state()), { timeout: 10000 })
    .toBe(true);
const record = (check) => {
  checks.push(check);
  console.log(`PASS ${check}`);
};

try {
  browser = await chromium.launch(launchOptions);
  const context = await browser.newContext(contextOptions);
  page = await context.newPage();
  activePage = page;
  page.on("pageerror", (error) => errors.push(error.message));
  await go("/");
  await expect(button("Find your possibilities")).toBeVisible();
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const bounds = await button("Find your possibilities").boundingBox();
    assert(
      bounds && bounds.y >= 0 && bounds.y + bounds.height <= size.height + 1,
      "Primary CTA must fit on screen",
    );
    await noOverflow("home");
    await shot(`home-${size.width}`);
  }
  record("Visible primary action at 320px and 390px");

  await button("Find your possibilities").click();
  await expect(
    page.getByText(
      "Your reflections stay private, are never sold, and can be deleted anytime.",
      { exact: true },
    ),
  ).toBeVisible();
  await button("Let's begin").click();
  await expect(heading("Ceramics")).toBeVisible();
  await button("Curious").click();
  await button("Undo last choice").click();
  await expect(heading("Ceramics")).toBeVisible();
  await button("Already love").click();
  await page.reload();
  await expect(heading("Mindful walking")).toBeVisible();
  await button("Curious").click();
  await shot("quick-picks");
  await button("Continue with these").click();
  await expect(
    page.getByText(
      "Ceramics already has a place in your life. Mindful walking is something you might explore.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    heading("When did time disappear on you recently?"),
  ).toBeVisible();
  await expect(field("Your story")).toHaveCount(1);
  await field("Your story").fill("Making a bowl with a friend.");
  await page.reload();
  await expect(field("Your story")).toHaveValue("Making a bowl with a friend.");
  await button("There's a little more to this").click();
  await expect(
    heading("What about being together stayed with you?"),
  ).toBeVisible();
  await field("A little more").fill(
    "We gave each other space to make something imperfect.",
  );
  await button("Continue").click();
  await expect(heading("What did you love doing as a kid?")).toBeVisible();
  await button("I don't know yet · skip").click();
  await expect(heading("Who do you admire, and why?")).toBeVisible();
  await field("Your story").fill(
    "My sister, for her fairness and the way she listens.",
  );
  await button("Continue").click();
  await field("Something to grow into").fill("Learning guitar");
  await button("Keep this possibility").click();
  await field("My why, in my words").fill("Make space for curiosity and care.");
  await button("Keep my first draft").click();
  await button("Keep this person and why").click();
  await button("Try on fairness").click();
  await shot("first-possibilities");
  await button("Find my check-in rhythm").click();
  await field("My morning anchor").fill("After my first coffee");
  await button("Keep this anchor").click();
  await field("My night anchor").fill("After brushing my teeth");
  await button("Keep this anchor").click();
  await expect(button("Choose my first I will")).toBeVisible();
  await button("Set reminder times · optional").click();
  await field("Time · HH:MM").fill("08:15");
  await button("Keep this time").click();
  await field("Time · HH:MM").fill("20:45");
  await expect(
    page.getByText(
      /add the reminders to your calendar, so they work when this page is closed/,
    ),
  ).toBeVisible();
  await button("Keep this time").click();
  await expect(button("Choose my first I will")).toBeVisible();
  await kept(
    (p) =>
      p.profile.onboarded &&
      p.profile.morning_time === "08:15" &&
      p.profile.evening_time === "20:45",
  );
  let p = await state();
  assert.equal(p.entries.filter((e) => e.kind === "interest").length, 3);
  assert.equal(p.entries.find((e) => e.title === "Ceramics").state, "love");
  assert.equal(
    p.entries.find((e) => e.title === "Learning guitar").meta.planet,
    "Grow",
  );
  assert.equal(
    p.entries.find((e) => e.kind === "why").body,
    "Make space for curiosity and care.",
  );
  assert(
    p.entries.some(
      (e) =>
        e.kind === "question" &&
        e.title === "What did you love doing as a kid?" &&
        e.state === "open",
    ),
  );
  assert(
    !p.entries.some((e) => e.meta?.period === "baseline"),
    "First session must not create scores",
  );
  const anchors = p.entries.find((e) => e.title === "Check-in anchors").meta;
  assert.equal(anchors.morning_anchor, "After my first coffee");
  assert.equal(anchors.evening_anchor, "After brushing my teeth");
  record(
    "First session: quick-pick undo/resume, one story at a time, skips, growth, why, anchors and times",
  );

  await go("/galaxy");
  await expect(heading("My Possibilities")).toBeVisible();
  await expect(button("Ceramics · Into it")).toBeVisible();
  await expect(button("Mindful walking · Maybe")).toBeVisible();
  await button("Ceramics · Into it").click();
  await expect(button("Go all in")).toHaveCount(0);
  await button("Put this on pause").click();
  await expect(button("Ceramics · On pause")).toBeVisible();
  await button("Ceramics · On pause").click();
  await button("Explore this again").click();
  await expect(button("Ceramics · Into it")).toBeVisible();
  await shot("possibilities");
  record(
    "Plain Possibilities labels, pause keeps the story, return preserves prior state",
  );

  await go("/rhythms");
  await button("My focus, Meaning To and Open Questions").click();
  await button("Focus on one area").click();
  await button("Passions").click();
  await kept((practice) =>
    practice.entries.some(
      (e) =>
        e.title === "Season" &&
        e.meta.pace === "stay" &&
        e.meta.orbit === "Passions",
    ),
  );
  await go("/ritual?value=Fairness");
  await expect(
    page.getByText("Passions is your focus.", { exact: true }),
  ).toBeVisible();
  await expect(button("People")).toHaveCount(0);
  const opener = await page.getByRole("heading").last().innerText();
  await button("Ask me something else").click();
  await expect(page.getByRole("heading").last()).not.toHaveText(opener);
  await button("I will…").click();
  await field("TODAY, I WILL…").fill(
    "Draw a bowl for ten minutes.\nRead a chapter at the library.",
  );
  await button("Ceramics").click();
  await button("Continue").click();
  await expect(
    heading("Which one do you want to focus on today?"),
  ).toBeVisible();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /matters most|most important/i,
  );
  await button("Save the others to Meaning To").click();
  await button("Draw a bowl for ten minutes.").click();
  await expect(heading("When will you do it?")).toBeVisible();
  await field("WHEN OR AFTER WHAT? · OPTIONAL").fill(
    "After lunch, at the kitchen table",
  );
  await button("For me").click();
  await shot("morning-plan");
  await button("Save for today").click();
  await expect(button("Done for now")).toBeVisible();
  await kept((practice) =>
    practice.intentions.some(
      (i) => i.action === "draw a bowl for ten minutes." && i.person === "me",
    ),
  );
  p = await state();
  const intention = p.intentions[0];
  assert.equal(intention.planet, "Passions");
  assert.equal(intention.value, "Fairness");
  assert.equal(intention.interest, "Ceramics");
  assert.equal(intention.when_context, "After lunch, at the kitchen table");
  assert(
    p.entries.some(
      (e) =>
        e.kind === "backlog" && e.title === "Read a chapter at the library.",
    ),
  );
  await button("Done for now").click();
  await expect(page).toHaveURL(`${base}/`);
  await page.reload();
  await expect(
    page.getByText("I will draw a bowl for ten minutes.", { exact: true }),
  ).toBeVisible();
  record(
    "Morning: fixed area, different opener, one focus without ranking, Meaning To, For me, plan and reload persistence",
  );

  await button("Reflect on today").click();
  await expect(
    page.getByText("After lunch, at the kitchen table", { exact: true }),
  ).toBeVisible();
  await button("I did").click();
  await expect(
    heading("Did it light you up, feel neutral, or drain you?"),
  ).toBeVisible();
  await button("Lit me up").click();
  for (const name of [
    "Keep it",
    "Still deciding",
    "Let it go",
    "Another value matters more",
  ])
    await expect(button(name)).toBeVisible();
  await button("Another value matters more").click();
  await field("A VALUE TO TRY ON").fill("Courage");
  await button("Try this value on").click();
  if (await button("Add a thought from today").isVisible())
    await button("Add a thought from today").click();
  await field("WHAT I NOTICED").fill(
    "I enjoyed working with my hands and taking a chance.",
  );
  await shot("night-reflection");
  await button("Keep this reflection").click();
  await expect(button("Done for tonight")).toBeVisible();
  await kept(
    (practice) =>
      practice.checkIns[0]?.energy === "lit" &&
      practice.checkIns[0]?.value_choice === "not_mine" &&
      practice.entries.some(
        (e) =>
          e.kind === "value" && e.title === "Courage" && e.state === "trying",
      ),
  );
  await noGuilt();
  await go("/galaxy");
  await button("Values").click();
  await expect(button("Fairness · Let go")).toBeVisible();
  await expect(button("Courage · Trying it on")).toBeVisible();
  record(
    "Night: planned context, energy, four value answers, replacement and quiet close",
  );

  await go("/explore");
  await field("Find a possibility").fill("Teaching");
  await button("Explore Teaching").click();
  await button("Save as a Maybe").click();
  await expect(
    page.getByText("Teaching is saved as a Maybe.", { exact: true }),
  ).toBeVisible();
  await kept((practice) =>
    practice.entries.some((e) => e.title === "Teaching" && e.state === "spark"),
  );
  await go("/why");
  await button("Make a little room").click();
  await field("One thought is enough").fill(
    "I want to help people trust their own curiosity.",
  );
  await button("Keep this thought").click();
  await field("In my words").fill("Help others find their own curiosity.");
  await button("Keep this version").click();
  await expect(
    heading("Would this help you choose between two options?"),
  ).toBeVisible();
  assert.equal(
    (await state()).entries.filter(
      (e) => e.kind === "why" && e.state === "accepted",
    ).length,
    1,
    "The practical choice test does not silently accept a new why",
  );
  await button("Yes, use this why").click();
  await expect(button("Done for now")).toBeVisible();
  await kept(
    (practice) =>
      practice.entries.filter((e) => e.kind === "why" && e.state === "accepted")
        .length === 2,
  );
  await go("/why");
  await button("Earlier versions").click();
  await expect(
    page.getByText("Make space for curiosity and care.", { exact: true }),
  ).toBeVisible();
  await shot("why-versions");
  record("Explore saves a Maybe; an edited why preserves the first version");

  await go("/telescope");
  await field("The life I picture").fill(
    "Calmer mornings and Sundays with my sisters.",
  );
  await button("Add a little detail by area").click();
  await button("People").click();
  await field("People · optional").fill("Sunday lunches with my sisters");
  await button("Keep this picture").click();
  await expect(heading("Does this sorting feel right?")).toBeVisible();
  assert.equal(
    (await state()).entries.filter(
      (e) => e.kind === "vision" && e.meta.horizon === "year",
    ).length,
    0,
    "A proposed area map does not save before confirmation",
  );
  await button("Remove Be").click();
  await button("Confirm these areas").click();
  await expect(button("Done for now")).toBeVisible();
  await go("/telescope");
  await button("Still true").click();
  await kept(
    (practice) =>
      practice.entries.filter(
        (e) => e.kind === "vision" && e.meta.horizon === "year",
      ).length === 2,
  );
  // Explicit fixture: a previously saved draft differs from the visible picture.
  // Reaffirming the visible picture must never commit this hidden draft.
  await page.evaluate(() =>
    localStorage.setItem(
      "iwillbe.draft.v1.guest.vision.year",
      JSON.stringify({
        text: "An unfinished move to another country",
        notes: { Grow: "A hidden draft detail" },
        age: 80,
      }),
    ),
  );
  await go("/telescope");
  await expect(
    page
      .getByText("Calmer mornings and Sundays with my sisters.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await expect(field("The life I picture")).toHaveCount(0);
  await button("Still true").click();
  await kept(
    (practice) =>
      practice.entries.filter(
        (e) => e.kind === "vision" && e.meta.horizon === "year",
      ).length === 3,
  );
  const reaffirmed = (await state()).entries
    .filter((e) => e.kind === "vision" && e.meta.horizon === "year")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  assert.equal(reaffirmed.body, "Calmer mornings and Sundays with my sisters.");
  assert.equal(
    reaffirmed.meta.planet_notes.People,
    "Sunday lunches with my sisters",
  );
  assert.equal(reaffirmed.meta.planet_notes.Be || "", "");
  assert.equal(reaffirmed.meta.planet_notes.Grow || "", "");
  await go("/telescope");
  await button("Tweak it").click();
  await expect(field("The life I picture")).toHaveValue(
    "An unfinished move to another country",
  );
  record(
    "Still true reaffirms the visible picture and preserves a separate unfinished draft",
  );
  await button("Later in life").click();
  await button("Me at 100").click();
  await field("The life I picture").fill(
    "Surrounded by family, proud I kept making things and sharing them.",
  );
  await button("Keep this picture").click();
  await kept((practice) =>
    practice.entries.some(
      (e) =>
        e.kind === "vision" &&
        e.meta.horizon === "life" &&
        e.meta.life_age === 100,
    ),
  );
  await shot("future-me");
  record("Future me: areas, reaffirmed versions and chosen later-life age");

  await go("/rhythms");
  await button("Sunday Explore").click();
  await button("My focus, Meaning To and Open Questions").click();
  await button("Let Chloe choose").click();
  await button("Close my rhythm tools").click();
  await expect(
    heading("Here’s what I noticed about you this week"),
  ).toBeVisible();
  await expect(
    page.getByText("“draw a bowl for ten minutes.” lit you up.", {
      exact: true,
    }),
  ).toBeVisible();
  await button("Make a little space").click();
  await field("A thought to keep").fill(
    "Making time for people and for making things both felt like me.",
  );
  await button("Keep this thought").click();
  await button("Grow").click();
  await button("Sounds right").click();
  await kept(
    (practice) =>
      practice.entries.some(
        (e) =>
          e.kind === "review" &&
          e.title === "Sunday Explore" &&
          e.state === "done",
      ) &&
      practice.entries.some(
        (e) => e.title === "Weekly focus" && e.meta.focus_area === "Grow",
      ),
  );
  await button("My focus, Meaning To and Open Questions").click();
  await field("Something I’ve been meaning to do").fill("Visit the library");
  await button("Keep it for later").click();
  const backlogCard = page
    .getByText("Visit the library", { exact: true })
    .locator("..");
  await backlogCard
    .getByRole("button", { name: "Release it", exact: true })
    .click();
  await kept((practice) =>
    practice.entries.some(
      (e) => e.title === "Visit the library" && e.state === "released",
    ),
  );
  await expect(
    page.getByText("Visit the library · Released", { exact: true }),
  ).toBeVisible();
  await button("Monthly check-in").click();
  await button("Still true").click();
  await button("Keep this reflection").click();
  await kept((practice) =>
    practice.entries.some(
      (e) => e.title === "Monthly check-in" && e.state === "done",
    ),
  );
  await shot("rhythms");
  record(
    "Sunday evidence, why piece, next-week focus, Meaning To release and monthly picture check",
  );

  await go("/chloe");
  await field("DRAFT FOR CHLOE · OPTIONAL").fill(
    "My thought to continue later",
  );
  await button("Connect and continue with Chloe").click();
  await expect(field("EMAIL")).toBeVisible();
  await button("Go back").click();
  await expect(field("DRAFT FOR CHLOE · OPTIONAL")).toHaveValue(
    "My thought to continue later",
  );
  await page.reload();
  await expect(field("DRAFT FOR CHLOE · OPTIONAL")).toHaveValue(
    "My thought to continue later",
  );
  record("Account handoff preserves an unsent Chloe draft, including reload");

  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of [
    "/galaxy",
    "/rhythms",
    "/telescope",
    "/settings",
    "/membership",
    "/about",
    "/history",
  ]) {
    await go(route);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await noOverflow(route);
  }
  await shot("small-history");
  record("No horizontal overflow on secondary screens at 320px");

  // A separate, explicitly synthetic fixture tests returning after time away.
  const returningPractice = structuredClone(await state());
  const oldDate = new Date(Date.now() - 20 * 86400000).toISOString();
  const oldDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(oldDate));
  returningPractice.intentions = returningPractice.intentions.map((i) => ({
    ...i,
    day: oldDay,
    created_at: oldDate,
  }));
  returningPractice.checkIns = returningPractice.checkIns.map((c) => ({
    ...c,
    created_at: oldDate,
  }));
  returningPractice.messages = [];
  returningPractice.entries = returningPractice.entries.map((e) => ({
    ...e,
    created_at: oldDate,
    updated_at: oldDate,
    meta: {
      ...e.meta,
      ...(e.title === "Check-in session" ? { last_check_in_at: oldDate } : {}),
    },
  }));
  returningPractice.entries = returningPractice.entries.filter(
    (e) => e.kind !== "backlog",
  );
  returningPractice.entries.push({
    id: "11111111-1111-4111-8111-111111111111",
    kind: "backlog",
    title: "An old call to choose afresh",
    body: "",
    state: "open",
    source: "Synthetic UI test fixture",
    source_ids: [],
    meta: { passes: 3 },
    created_at: oldDate,
    updated_at: oldDate,
  });
  const returnContext = await browser.newContext(contextOptions);
  await returnContext.addInitScript(
    ({ key, practice }) => {
      if (!localStorage.getItem("iwillbe.ui.fixture.seeded")) {
        localStorage.setItem(key, JSON.stringify(practice));
        localStorage.setItem("iwillbe.ui.fixture.seeded", "true");
      }
    },
    { key: storageKey, practice: returningPractice },
  );
  const returnPage = await returnContext.newPage();
  activePage = returnPage;
  returnPage.on("pageerror", (error) => errors.push(error.message));
  await go("/ritual", returnPage);
  await expect(
    heading("What's true for you right now?", returnPage),
  ).toBeVisible();
  await expect(
    returnPage.getByText("An old call to choose afresh", { exact: true }),
  ).toHaveCount(0);
  await noGuilt(returnPage);
  await shot("returning-morning", returnPage);
  await go("/reflect", returnPage);
  await expect(
    heading("What's true for you right now?", returnPage),
  ).toBeVisible();
  await noGuilt(returnPage);
  await button("Skip for now", returnPage).click();
  await expect(button("Done for tonight", returnPage)).toBeVisible();
  await go("/ritual", returnPage);
  await expect(
    heading("Do it this week, or let it go?", returnPage),
  ).toBeVisible();
  await expect(
    returnPage.getByText("An old call to choose afresh", { exact: true }),
  ).toBeVisible();
  await button("Let it go", returnPage).click();
  await expect(
    returnPage.getByText("Letting it go is a choice too.", { exact: true }),
  ).toBeVisible();
  assert.equal(
    (await state(returnPage)).entries.find(
      (e) => e.title === "An old call to choose afresh",
    ).state,
    "released",
  );
  await returnContext.close();
  activePage = page;
  record(
    "Returning morning/night start fresh; old Meaning To waits until the next check-in",
  );

  // Explicit empty-practice fixture with a profile day different from the browser day.
  const dateIn = (zone) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const browserDay = dateIn("America/New_York");
  const profileZone = ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find(
    (zone) => dateIn(zone) !== browserDay,
  );
  assert(profileZone, "Timezone fixture must cross a real date boundary");
  const profileDay = dateIn(profileZone);
  const emptyFixture = {
    profile: {
      ...(await state()).profile,
      timezone: profileZone,
      onboarded: true,
    },
    intentions: [],
    checkIns: [],
    messages: [],
    memories: [],
    entries: [],
  };
  const zoneContext = await browser.newContext(contextOptions);
  await zoneContext.addInitScript(
    ({ key, practice }) => {
      if (!localStorage.getItem("iwillbe.ui.zone.seeded")) {
        localStorage.setItem(key, JSON.stringify(practice));
        localStorage.setItem("iwillbe.ui.zone.seeded", "true");
      }
    },
    { key: storageKey, practice: emptyFixture },
  );
  const zonePage = await zoneContext.newPage();
  activePage = zonePage;
  zonePage.on("pageerror", (error) => errors.push(error.message));
  await go("/", zonePage);
  await expect(button("Night check-in", zonePage)).toBeVisible();
  await button("Night check-in", zonePage).click();
  await expect(field("A THOUGHT FROM TODAY", zonePage)).toBeVisible();
  await noGuilt(zonePage);
  record("Home offers a Night check-in without a morning commitment");
  await go("/ritual", zonePage);
  await button("I will…", zonePage).click();
  await field("TODAY, I WILL…", zonePage).fill("Walk to the water");
  await button("Continue", zonePage).click();
  await field("WHEN OR AFTER WHAT? · OPTIONAL", zonePage).fill(
    "After breakfast",
  );
  await button("For me", zonePage).click();
  await button("Save for today", zonePage).click();
  await expect(button("Done for now", zonePage)).toBeVisible();
  const zonePractice = await state(zonePage);
  assert.equal(zonePractice.profile.timezone, profileZone);
  assert.equal(zonePractice.intentions.length, 1);
  assert.equal(zonePractice.intentions[0].day, profileDay);
  assert.notEqual(zonePractice.intentions[0].day, browserDay);
  await go("/reflect", zonePage);
  await expect(heading("Did you show up?", zonePage)).toBeVisible();
  await expect(
    zonePage.getByText("I will walk to the water", { exact: true }),
  ).toBeVisible();
  await zoneContext.close();
  activePage = page;
  record(
    "Morning save and night lookup use the profile timezone across the date boundary",
  );

  // Stop the question through the UI, then simulate reopening the weekly flow
  // without its transient wizard draft. The persisted stop must still apply.
  const questionContext = await browser.newContext(contextOptions);
  const questionPage = await questionContext.newPage();
  activePage = questionPage;
  questionPage.on("pageerror", (error) => errors.push(error.message));
  await go("/rhythms", questionPage);
  await button("Sunday Explore", questionPage).click();
  await button("Make a little space", questionPage).click();
  const stoppedQuestion = await questionPage
    .getByRole("heading")
    .first()
    .innerText();
  await button("I don’t know yet", questionPage).click();
  await button("My focus, Meaning To and Open Questions", questionPage).click();
  await expect(
    questionPage.getByText(stoppedQuestion, { exact: true }),
  ).toBeVisible();
  const questionCard = questionPage
    .getByText(stoppedQuestion, { exact: true })
    .locator("..");
  await questionCard
    .getByRole("button", { name: "Stop asking this", exact: true })
    .click();
  await expect(
    questionPage.getByText(stoppedQuestion, { exact: true }),
  ).toHaveCount(0);
  assert.equal(
    (await state(questionPage)).entries.find(
      (e) => e.kind === "question" && e.title === stoppedQuestion,
    ).state,
    "stopped",
  );
  await questionPage.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("iwillbe.draft.v1.guest.brief.review.week:"))
        localStorage.removeItem(key);
  });
  await go("/rhythms", questionPage);
  await button("Sunday Explore", questionPage).click();
  await button("Make a little space", questionPage).click();
  await expect(questionPage.getByRole("heading").first()).not.toHaveText(
    stoppedQuestion,
  );
  await expect(
    questionPage.getByText(stoppedQuestion, { exact: true }),
  ).toHaveCount(0);
  await questionContext.close();
  activePage = page;
  record(
    "A stopped Sunday question stays stopped after reopening the weekly flow",
  );

  assert.deepEqual(errors, [], "Browser page errors");
  await writeFile(
    `${root}/results.json`,
    JSON.stringify({ passed: true, base, checks, errors }, null, 2),
  );
  console.log("Chloe brief UI regression passed");
} catch (error) {
  console.error(error);
  if (activePage) {
    console.log(
      await activePage
        .locator("body")
        .ariaSnapshot()
        .catch(() => "UI unavailable"),
    );
    await shot("failure", activePage).catch(() => {});
  }
  await writeFile(
    `${root}/results.json`,
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
