import test from "node:test";
import assert from "node:assert/strict";
import { entryInput, type Entry } from "../src/journey";
import { PRIORITY_WORDS, QUICK_PICKS } from "../src/priorities";
import {
  ONBOARDING_VERSION,
  customOnboardingWords,
  onboardingEntriesToRemove,
  onboardingEntryPlan,
  selectedOnboardingInterests,
  selectedOnboardingPlaces,
  toggleOnboardingPick,
  validFirstWhy,
  validOnboardingPriorities,
  type OneMinuteOnboardingDraft,
} from "../src/one-minute-onboarding";

const draft = (
  extra: Partial<OneMinuteOnboardingDraft> = {},
): OneMinuteOnboardingDraft => ({
  step: 4,
  priorities: [
    "kind",
    "patient",
    "calm",
    "joyful",
    "curious",
    "healthy",
    "creative",
  ],
  interests: [],
  customInterests: "",
  who: [],
  customWho: "",
  kidsAges: [],
  faith: "",
  why: "Someone who listened with care.",
  entryIds: {},
  createdPlaceIds: {},
  ...extra,
});
const savedEntry = (
  kind: Entry["kind"],
  title: string,
  extra: Partial<Entry> = {},
): Entry => ({
  ...entryInput(kind, title),
  id: `${kind}-${title}`,
  revision: 4,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: "2026-10-02T12:00:00Z",
  ...extra,
});

test("one-minute catalogue has 39 priorities and 15 tap-any interests", () => {
  assert.equal(PRIORITY_WORDS.length, 39);
  assert.equal(new Set(PRIORITY_WORDS.map((word) => word.name)).size, 39);
  assert.equal(PRIORITY_WORDS.at(-2)?.name, "seeing beauty");
  assert.equal(PRIORITY_WORDS.at(-1)?.name, "joyful");
  assert.equal(QUICK_PICKS.length, 15);
});

test("exactly seven known unique priorities are required and an eighth tap has no effect", () => {
  const seven = draft().priorities;
  assert.equal(validOnboardingPriorities(seven), true);
  assert.deepEqual(toggleOnboardingPick(seven, "honest", 7), seven);
  const six = toggleOnboardingPick(seven, "patient", 7);
  assert.equal(six.length, 6);
  assert.equal(validOnboardingPriorities(six), false);
  assert.equal(
    validOnboardingPriorities(toggleOnboardingPick(six, "honest", 7)),
    true,
  );
  assert.equal(validOnboardingPriorities([...seven, "honest"]), false);
  assert.equal(
    validOnboardingPriorities([...seven.slice(0, 6), "kind"]),
    false,
  );
  assert.equal(
    validOnboardingPriorities([...seven.slice(0, 6), "invented priority"]),
    false,
  );
});

test("all selected priorities start Working on and every interest starts Want to try", () => {
  const selection = draft({
    interests: ["hiking", "reading"],
    customInterests: "salsa dancing",
  });
  const plan = onboardingEntryPlan(selection, []);
  const values = plan.filter((entry) => entry.kind === "value");
  const interests = plan.filter((entry) => entry.kind === "interest");
  assert.equal(values.length, 7);
  assert.ok(values.every((entry) => entry.state === "working_on"));
  assert.deepEqual(
    interests.map((entry) => entry.title),
    ["hiking", "reading", "salsa dancing"],
  );
  assert.ok(
    interests.every(
      (entry) =>
        entry.state === "want_to_try" &&
        entry.meta.onboarding_session === ONBOARDING_VERSION,
    ),
  );
  assert.ok(plan.every((entry) => entry.meta.onboarding_key));
});

test("interests and people can be empty; custom entries are literal and deduplicated", () => {
  assert.deepEqual(selectedOnboardingInterests(draft()), []);
  assert.deepEqual(selectedOnboardingPlaces(draft()), []);
  assert.deepEqual(
    customOnboardingWords(" salsa dancing, pottery; SALSA DANCING\n painting "),
    ["salsa dancing", "pottery", "painting"],
  );
  assert.deepEqual(
    selectedOnboardingInterests(
      draft({
        interests: ["reading"],
        customInterests: "Reading, bird watching",
      }),
    ),
    ["reading", "bird watching"],
  );
  assert.deepEqual(
    selectedOnboardingPlaces(
      draft({
        who: ["for myself", "with my kids"],
        customWho: "my students, with my kids",
      }),
    ),
    ["for myself", "with my kids", "with my students"],
  );
  assert.equal(
    onboardingEntryPlan(draft(), []).filter(
      (entry) => entry.kind === "interest",
    ).length,
    0,
  );
});

test("a Why needs a few actual words and saves the person's wording as accepted", () => {
  for (const text of ["", "  ", "Kind", "Be kind", "... ... ..."])
    assert.equal(validFirstWhy(text), false, text);
  assert.equal(validFirstWhy("  Be kind always.  "), true);
  const why = onboardingEntryPlan(
    draft({ why: "  Be kind always.  " }),
    [],
  ).find((entry) => entry.kind === "why");
  assert.equal(why?.body, "Be kind always.");
  assert.equal(why?.state, "accepted");
  assert.throws(
    () => onboardingEntryPlan(draft({ why: "" }), []),
    /three words/,
  );
  assert.throws(
    () => onboardingEntryPlan(draft({ priorities: [] }), []),
    /seven/,
  );
});

test("adult kids and an optional unanswered age card are both explicit saved choices", () => {
  for (const ages of [
    ["adults"],
    ["adults", "under 6"],
    [],
  ] as OneMinuteOnboardingDraft["kidsAges"][]) {
    const plan = onboardingEntryPlan(
      draft({ who: ["with my kids"], kidsAges: ages }),
      [],
    );
    const saved = plan.find((entry) => entry.title === "Kids ages");
    assert.deepEqual(saved?.meta.ages, ages);
    assert.equal(saved?.meta.asked, true);
  }
  assert.ok(
    !onboardingEntryPlan(draft({ kidsAges: ["adults"] }), []).some(
      (entry) => entry.title === "Kids ages",
    ),
  );
});

test("existing identities and notes survive while a previous Why version is preserved", () => {
  const prior = [
    savedEntry("value", "Patience", {
      body: "My own existing note",
      meta: { priority_group: "Character" },
    }),
    savedEntry("why", "My why", {
      body: "An earlier accepted version",
      state: "accepted",
    }),
  ];
  const before = structuredClone(prior);
  const plan = onboardingEntryPlan(
    draft({ entryIds: { "why:my why": "new-why" } }),
    prior,
  );
  const value = plan.find((entry) => entry.title === "Patience");
  assert.equal(value?.id, prior[0].id);
  assert.equal(value?.revision, 4);
  assert.equal(value?.body, "My own existing note");
  assert.equal(value?.state, "working_on");
  assert.equal(value?.meta.onboarding_session, undefined);
  assert.equal(plan.find((entry) => entry.kind === "why")?.id, "new-why");
  assert.deepEqual(prior, before);
});

test("retry plans reuse stable identities and only remove this session's deselected records", () => {
  const selected = draft({ interests: ["hiking"] });
  const first = onboardingEntryPlan(selected, []).map((entry, index) => ({
    ...entry,
    id: `first-${index}`,
    revision: 2,
    created_at: "2026-11-27T12:00:00Z",
    updated_at: "2026-11-27T12:00:00Z",
  }));
  const unrelated = savedEntry("interest", "pottery", { state: "into_it" });
  const previousWhy = savedEntry("why", "My why", {
    state: "accepted",
    body: "A previous why version",
  });
  const known = [...first, unrelated, previousWhy];
  const again = onboardingEntryPlan(selected, known);
  assert.deepEqual(
    again.map((entry) => entry.id),
    first.map((entry) => entry.id),
  );
  assert.deepEqual(onboardingEntriesToRemove(known, again), []);
  const changed = onboardingEntryPlan(draft(), known);
  assert.deepEqual(
    onboardingEntriesToRemove(known, changed).map((entry) => entry.title),
    ["hiking"],
  );
});
