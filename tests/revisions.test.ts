import assert from "node:assert/strict";
import test from "node:test";
import { matchesDraft, recordSummary } from "../src/revisions";

test("a response-lost reflection retry accepts identical saved content without rewriting", () => {
  const draft = {
    intention_id: "today",
    outcome: "yes",
    reflection: "I called my aunt.",
    energy: "lit",
    value_choice: null,
    created_at: "old timestamp",
  };
  const saved = {
    ...draft,
    user_id: "owner",
    revision: 2,
    created_at: "saved timestamp",
    updated_at: "later",
  };
  assert.equal(matchesDraft(draft, saved), true);
  assert.equal(
    matchesDraft({ ...draft, reflection: "Different reflection" }, saved),
    false,
  );
  assert.equal(matchesDraft({ ...draft, outcome: "not_yet" }, saved), false);
  assert.equal(matchesDraft(draft, null), false);
});

test("journey retries ignore server metadata but retain meaningful nested fields", () => {
  const entry = {
    id: "story",
    kind: "interest",
    title: "Pottery",
    body: "Make a bowl",
    state: "love",
    source_ids: ["today"],
    meta: { into_it_since: "2026-10-26", planet: "Passions" },
  };
  const draft = { id: "story", entry, kind: "interest" };
  const saved = {
    ...draft,
    revision: 3,
    user_id: "owner",
    entry: {
      ...entry,
      revision: 2,
      created_at: "yesterday",
      updated_at: "now",
      meta: { planet: "Passions", into_it_since: "2026-10-26" },
    },
  };
  assert.equal(matchesDraft(draft, saved), true);
  assert.equal(
    matchesDraft({ ...draft, entry: { ...entry, state: "on_pause" } }, saved),
    false,
  );
  assert.equal(
    matchesDraft(
      {
        ...draft,
        entry: {
          ...entry,
          meta: { ...entry.meta, into_it_since: "2026-09-01" },
        },
      },
      saved,
    ),
    false,
  );
  assert.equal(
    matchesDraft(
      { ...draft, entry: { ...entry, source_ids: ["different day"] } },
      saved,
    ),
    false,
  );
});

test("partial updates compare all supplied fields while leaving other saved fields untouched", () => {
  const saved = {
    id: "owner",
    revision: 8,
    timezone: "Europe/Paris",
    morning_time: "08:00",
    evening_time: "21:00",
    display_name: "Sam",
  };
  assert.equal(matchesDraft({ timezone: "Europe/Paris" }, saved), true);
  assert.equal(matchesDraft({ timezone: "America/New_York" }, saved), false);
  assert.equal(
    matchesDraft({ morning_time: "07:00", evening_time: "21:00" }, saved),
    false,
  );
});

test("conflict review includes settings, the planned context, and explicit state changes", () => {
  assert.match(
    recordSummary({
      timezone: "Europe/Paris",
      morning_time: "08:00",
      evening_time: "21:00",
    }),
    /Timezone: Europe\/Paris/,
  );
  assert.match(
    recordSummary({
      action: "Call my aunt",
      when_context: "After breakfast",
      place: "At home",
    }),
    /After breakfast\nAt home/,
  );
  assert.match(
    recordSummary({
      entry: { kind: "interest", title: "Pottery", state: "on_pause" },
    }),
    /On pause/,
  );
  assert.match(
    recordSummary({ entry: { title: "Privacy", meta: { analytics: false } } }),
    /Share usage measurements: No/,
  );
  assert.match(
    recordSummary({
      outcome: "not_yet",
      energy: "lit",
      value_choice: "not_mine",
    }),
    /Not this time\nIt lit me up\nLet it go/,
  );
});
