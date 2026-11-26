// Behavioral regression suite for the optional, fictional Round 4 QA export.
// The app's network interceptor and this context route both prevent live calls.
import { chromium } from "playwright";
import { expect } from "playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = (process.env.UI_BASE_URL || "http://localhost:4184").replace(
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
const escaped = [];
let sequence = 0;
await mkdir("test-results/round4-ui", { recursive: true });
async function setup(
  scenario = "morning",
  path = "/",
  width = 390,
  height = 844,
) {
  const context = await browser.newContext({
    viewport: { width, height },
    timezoneId: "America/New_York",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.origin === new URL(base).origin ||
      ["data:", "blob:"].includes(url.protocol)
    )
      return route.continue();
    escaped.push(url.origin + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const reset = `round4-${++sequence}`;
  const go = async (target = "/") => {
    const url = new URL(target, base);
    url.searchParams.set("qaScenario", scenario);
    url.searchParams.set("qaReset", reset);
    await page.goto(url.href);
    await page.waitForFunction(() => !!window.__ROUND4_QA__);
  };
  const state = () => page.evaluate(() => window.__ROUND4_QA__.inspect());
  const button = (name) => page.getByRole("button", { name, exact: true });
  const advance = async (clock, target = "/") => {
    await page.evaluate(
      (value) => window.__ROUND4_QA__.advanceTo(value),
      clock,
    );
    await go(target);
  };
  await go(path);
  return { context, page, button, state, go, advance };
}
const assertNoOverflow = async (page) => {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  assert.ok(
    widths.body <= widths.viewport + 1,
    `Horizontal overflow: ${JSON.stringify(widths)}`,
  );
};

try {
  const morning = await setup();
  await expect(
    morning.page.getByRole("heading", {
      name: "Who will you be today, and for whom?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(morning.button("Set my focus")).toBeDisabled();
  await expect(
    morning.page.getByRole("button", { name: /^Use idea:/ }),
  ).toHaveCount(3);
  await expect(
    morning.page.getByRole("button", { name: /^Priority:/ }),
  ).toHaveCount(0);
  await morning.button("More ideas").click();
  await expect(
    morning.page.getByRole("button", { name: /^Use idea:/ }),
  ).toHaveCount(5);
  await morning.page
    .getByRole("button", { name: /^Use idea:/ })
    .first()
    .click();
  await expect(
    morning.page.getByRole("textbox", { name: "My focus", exact: true }),
  ).not.toHaveValue("");
  assert.equal(
    (await morning.state()).intentions.length,
    0,
    "Using an idea must not commit it",
  );
  const words = "CALL NASA about the API";
  await morning.page
    .getByRole("textbox", { name: "My focus", exact: true })
    .fill(words);
  await morning.button("Set my focus").click();
  await expect(
    morning.page.getByText("When will you do it?", { exact: true }),
  ).toBeVisible();
  assert.equal(
    (await morning.state()).intentions.length,
    0,
    "Choosing words must still wait for a time",
  );
  await morning.page
    .getByRole("textbox", { name: "My own time", exact: true })
    .fill("when I get home at 6 PM");
  await morning.button("Save my focus").click();
  await expect(morning.page.getByTestId("today-focus-card")).toBeVisible();
  await expect(
    morning.page.getByText(`I will ${words}`, { exact: true }),
  ).toBeVisible();
  const saved = (await morning.state()).intentions[0];
  assert.equal(saved.action, words);
  assert.equal(saved.source, "typed");
  assert.equal(saved.when_context, "when I get home at 6 PM");
  await assertNoOverflow(morning.page);
  await morning.page.screenshot({
    path: "test-results/round4-ui/today-saved.png",
    fullPage: true,
  });
  console.log(
    "PASS Today has 3+2 ideas, editable selection, no wheels, exact typed capitals and an explicit time before saving",
  );
  await morning.context.close();

  const map = await setup("morning", "/galaxy");
  for (const name of [
    "My why · Shape my why",
    "Who I'm becoming",
    "What I'm growing",
    "Who I show up for",
    "Try something new",
    "Future me",
  ])
    await expect(map.button(name)).toBeVisible();
  await map.page.screenshot({
    path: "test-results/round4-ui/my-map.png",
    fullPage: true,
  });
  await map.button("Build an action").click();
  for (const name of ["Priority", "Interest", "People or place"])
    await expect(map.page.getByLabel(name, { exact: true })).toBeVisible();
  await expect(map.page.getByTestId("wheel-page-scroll-margin")).toHaveCount(3);
  const wheelHeights = await Promise.all(
    ["Priority", "Interest", "People or place"].map((name) =>
      map.page
        .getByLabel(name, { exact: true })
        .evaluate((element) => element.getBoundingClientRect().height),
    ),
  );
  assert.deepEqual(wheelHeights, [230, 170, 170], "Wheels show five word rows");
  await expect(map.button("Make it today's focus")).toBeEnabled();
  await map.button("Remind me of this action").click();
  await expect(map.button("Added to the top of Today")).toBeVisible();
  const reminder = (await map.state()).journey_entries.find(
    (row) => row.entry.title === "Action reminder",
  );
  assert.ok(reminder);
  assert.equal(reminder.entry.meta.reminder_day, "2026-11-27");
  assert.equal(
    (await map.state()).intentions.length,
    0,
    "A reminder is not a scheduled focus",
  );
  await map.advance("2026-11-27T14:00:00Z");
  await expect(
    map.page.getByRole("button", { name: /^Use idea:/ }).first(),
  ).toHaveAccessibleName(`Use idea: ${reminder.entry.body}`);
  await assertNoOverflow(map.page);
  console.log(
    "PASS illustrated My map tiles, three five-row wheels, and next-day reminder at the top of Today",
  );
  await map.context.close();

  const night = await setup("evening", "/reflect");
  for (const name of [
    "Did you show up?",
    "How did it feel?",
    "Anything worth noting?",
  ])
    await expect(night.page.getByText(name, { exact: true })).toBeVisible();
  await expect(night.button("Done")).toBeDisabled();
  await night.button("I did").click();
  await night.button("Gave me energy").click();
  await night.page
    .getByRole("textbox", { name: "My note", exact: true })
    .fill("I kept my own words today.");
  await night.page.screenshot({
    path: "test-results/round4-ui/night-inline.png",
    fullPage: true,
  });
  await night.button("Done").click();
  await expect(
    night.page.getByText("Same focus tomorrow?", { exact: true }),
  ).toBeVisible();
  const check = (await night.state()).check_ins[0];
  assert.equal(check.outcome, "yes");
  assert.equal(check.energy, "lit");
  assert.equal(check.reflection, "I kept my own words today.");
  await night.button("Yes, keep it").click();
  await expect(night.button("Ready for tomorrow morning")).toBeVisible();
  assert.equal(
    (await night.state()).intentions.length,
    1,
    "Goodnight must not create tomorrow's focus",
  );
  await night.page.screenshot({
    path: "test-results/round4-ui/goodnight.png",
    fullPage: true,
  });
  await night.advance("2026-11-27T14:00:00Z");
  await expect(
    night.page.getByRole("textbox", { name: "My focus", exact: true }),
  ).toHaveValue("Call NASA about the API");
  assert.equal(
    (await night.state()).intentions.length,
    1,
    "Prefill must still await confirmation",
  );
  console.log(
    "PASS inline Night saves priority-only energy and Goodnight carries tomorrow's editable prefill without auto-committing",
  );
  await night.context.close();

  const obstacle = await setup("evening", "/reflect", 320, 568);
  await obstacle.button("Not this time").click();
  await obstacle.button("Drained me").click();
  await expect(obstacle.button("Ran out of time")).toBeVisible();
  await obstacle.button("Ran out of time").click();
  await obstacle.button("Done").click();
  await expect(
    obstacle.page.getByText("A smaller step for tomorrow", { exact: true }),
  ).toBeVisible();
  const smaller = (await obstacle.state()).journey_entries.find(
    (row) =>
      row.entry.title === "Action reminder" &&
      row.entry.meta.created_from === "night_obstacle",
  );
  assert.ok(smaller?.entry.body);
  assert.equal((await obstacle.state()).check_ins[0].energy, "drained");
  await obstacle.button("Goodnight").scrollIntoViewIfNeeded();
  await expect(obstacle.button("Goodnight")).toBeVisible();
  await assertNoOverflow(obstacle.page);
  await obstacle.page.screenshot({
    path: "test-results/round4-ui/goodnight-320.png",
    fullPage: true,
  });
  await obstacle.advance("2026-11-27T14:00:00Z");
  await expect(
    obstacle.page.getByRole("button", { name: /^Use idea:/ }).first(),
  ).toHaveAccessibleName(`Use idea: ${smaller.entry.body}`);
  console.log(
    "PASS Not this time retains energy, offers a smaller step next morning, and Goodnight remains reachable at 320px",
  );
  await obstacle.context.close();

  const repeated = await setup("previous-obstacle", "/reflect");
  await repeated.button("Not this time").click();
  await expect(repeated.button("Ran out of time")).toHaveCount(0);
  await repeated.button("Neutral").click();
  await repeated.button("Done").click();
  await expect(repeated.button("Goodnight")).toBeVisible();
  assert.equal(
    (await repeated.state()).journey_entries.filter(
      (row) => row.entry.title === "Night obstacle",
    ).length,
    1,
  );
  console.log(
    "PASS obstacle questions are not repeated on consecutive nights for the same focus",
  );
  await repeated.context.close();

  assert.deepEqual(
    escaped,
    [],
    "The fixture attempted a live external request",
  );
  assert.deepEqual(errors, [], "Unexpected browser page errors");
  console.log(
    "PASS Round 4 browser regression with fictional data and zero live external requests",
  );
} finally {
  await browser.close();
}
