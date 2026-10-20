import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = process.env.UI_ARTIFACT_DIR || "test-results/redesign";
const base = process.env.UI_BASE_URL || "http://localhost:8081";
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
const button = (name) => page.getByRole("button", { name, exact: true });
const field = (name) => page.getByRole("textbox", { name, exact: true });
const go = async (path) => {
  await page.goto(base + path);
  await page.waitForTimeout(500);
};
const shot = async (name) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${root}/${name}.png` });
};
const state = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("iwillbe.practice.v2.guest")),
  );
try {
  await go("/");
  await button("Find my sparks").waitFor();
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    const b = await button("Find my sparks").boundingBox();
    assert(b.y + b.height <= size.height);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await shot(`home-${size.width}`);
  }
  await button("Find my sparks").click();
  await page
    .getByRole("heading", { name: "What might light you up?", exact: true })
    .waitFor();
  await button("Find my sparks").click();
  await page.getByRole("heading", { name: "Ceramics", exact: true }).waitFor();
  await shot("spark-sort");
  await button("I’m curious").click();
  await button("Undo last choice").click();
  await page.getByRole("heading", { name: "Ceramics", exact: true }).waitFor();
  await button("I already love this").click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Mindful walking", exact: true })
    .waitFor();
  await button("I’m curious").click();
  await button("Continue for now").click();
  await field("When did you last lose track of time?").fill(
    "Making a bowl with a friend.",
  );
  await field("A first why, in your words · optional").fill(
    "Make space for curiosity and care.",
  );
  await button("Continue").click();
  await button("See my galaxy").click();
  await button("Explore my galaxy").click();
  await page
    .getByText("Make space for curiosity and care.", { exact: true })
    .waitFor();
  await shot("galaxy");
  const p = await state();
  assert.equal(p.entries.filter((e) => e.kind === "interest").length, 2);
  assert.equal(p.entries.find((e) => e.title === "Ceramics").state, "love");
  assert.equal(p.profile.onboarded, true);
  await button("Ceramics · Glow").click();
  await page.getByText("Glow", { exact: true }).first().waitFor();
  await button("Make it my craft").click();
  assert.equal(
    (await state()).entries.find((e) => e.title === "Ceramics").state,
    "craft",
  );
  await button("Ceramics · Craft").click();
  await button("Return to exploring").click();
  await go("/ritual");
  await field("TODAY, I WILL…").fill("Draw a bowl for ten minutes.");
  await button("Passions").click();
  await button("Creativity").click();
  await field("WHEN OR AFTER WHAT? · OPTIONAL").fill("After lunch");
  await field("FOR WHOM? · OPTIONAL").fill("Sam");
  await button("Ceramics").click();
  await button("Review my intention").click();
  await shot("commitment");
  await button("Save for today").click();
  await button("Reflect on today").click();
  await button("I did").click();
  await button("Lit me up").click();
  await button("Yes, it’s mine").click();
  await field("WHAT DID YOU NOTICE?").fill("I enjoyed working with my hands.");
  await shot("reflection");
  await button("Keep this reflection").click();
  await button("See my galaxy").click();
  assert.equal((await state()).checkIns[0].energy, "lit");
  assert.equal((await state()).checkIns[0].value_choice, "yes");
  assert.equal((await state()).intentions[0].when_context, "After lunch");
  await go("/explore");
  await field("Find a possibility").fill("Teaching");
  await button("Explore Teaching").click();
  await shot("explorer");
  await button("Save as a Spark").click();
  await page
    .getByText("Teaching is saved as a Spark.", { exact: true })
    .waitFor();
  assert((await state()).entries.some((e) => e.title === "Teaching"));
  await go("/why");
  await field("In my words").fill("Help others find their own curiosity.");
  await button("Keep this version").click();
  await page
    .getByText("Your why is saved. Earlier versions are still yours.")
    .waitFor();
  assert.equal(
    (await state()).entries.filter((e) => e.kind === "why").length,
    2,
  );
  await shot("why");
  await go("/telescope");
  await field("The life I picture").fill(
    "Calmer mornings and Sundays with my sisters.",
  );
  await button("Keep this picture").click();
  await button("Still true").click();
  await page
    .getByText("A little space for the life you want. Saved privately.")
    .waitFor();
  assert.equal(
    (await state()).entries.filter((e) => e.kind === "vision").length,
    2,
  );
  await shot("telescope");
  await go("/rhythms");
  await field("A thought to keep · optional").fill(
    "Making time for people mattered.",
  );
  await button("Keep this reflection").click();
  await page.waitForTimeout(250);
  assert(
    (await state()).entries.some(
      (e) => e.kind === "review" && e.state === "done",
    ),
  );
  await field("Something I have been meaning to do").fill("Visit the library");
  await button("Keep it for later").click();
  await page.getByText("Visit the library", { exact: true }).waitFor();
  await button("Release it").click();
  assert.equal(
    (await state()).entries.find((e) => e.title === "Visit the library").state,
    "released",
  );
  await button("Stay in one orbit").click();
  await button("Grow").click();
  assert.equal(
    (await state()).entries.find((e) => e.title === "Season").meta.orbit,
    "Grow",
  );
  await shot("rhythms");
  await go("/connections");
  await page
    .getByText("Draw a bowl for ten minutes.", { exact: true })
    .first()
    .waitFor();
  await shot("connections");
  await go("/chloe");
  await field("DRAFT FOR CHLOE · OPTIONAL").fill(
    "My thought to continue later",
  );
  await button("Connect and continue with Chloe").click();
  await field("EMAIL").waitFor();
  await button("Go back").click();
  await field("DRAFT FOR CHLOE · OPTIONAL").waitFor();
  assert.equal(
    await field("DRAFT FOR CHLOE · OPTIONAL").inputValue(),
    "My thought to continue later",
  );
  await go("/history");
  await shot("history");
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of [
    "/galaxy",
    "/rhythms",
    "/telescope",
    "/settings",
    "/membership",
    "/about",
  ]) {
    await go(route);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      route + " overflows",
    );
  }
  await shot("small-settings");
  assert.deepEqual(errors, []);
  await writeFile(
    `${root}/results.json`,
    JSON.stringify(
      {
        passed: true,
        errors,
        checks: [
          "320/390 responsive CTA",
          "Spark Sort undo/resume",
          "optional stories and baseline",
          "why persistence",
          "explicit craft",
          "intention context",
          "separate energy and value choice",
          "explorer save",
          "why version history",
          "telescope version/reaffirmation",
          "monthly review",
          "backlog release",
          "season choice",
          "constellation from lived moments",
          "contextual auth and draft return",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Redesign UI regression passed");
} catch (error) {
  console.error(error);
  console.log(await page.locator("body").ariaSnapshot());
  await shot("failure");
  process.exitCode = 1;
} finally {
  await browser.close();
}
