# Mission library v2

Source: Kelly's `iwillbe-mission-library-v2.xlsx`, supplied with the updated
onboarding instructions. The workbook contains **1,284 missions**, **44 interest
links** and **59 books**. The source SHA-256 is recorded in `source.json`.

Compared with Round 4, this version adds 15 Joy missions, three learning missions
about joy, and nine missions with grown children. It also appends the `joyful`
priority to 24 existing missions and adds two books. All 1,257 historical mission
IDs, mission wording, first steps, interest links and existing book IDs remain intact.

Rebuild these JSON files without editing the workbook:

```sh
python scripts/extract-round5.py path/to/iwillbe-mission-library-v2.xlsx
node scripts/build-round5-seed.mjs
```

The extractor validates the expected additions and checks that the only changes
to historical missions are the 24 `joyful` tags. The seed builder writes the existing
Round 5 catalogue migration. Neither command changes the database.

The migration extends the accepted age labels to include `adults`, then upserts
the catalogue by stable ID in one transaction. It rejects conflicts with private
mission IDs and does not remove private missions or user history.

## Selection details

- `joyful` is the 39th onboarding priority. It covers delight, wonder and savoring
  good moments; the existing `funny` priority covers humor.
- `ages` now permits `adults`, in addition to `under 6`, `6–12` and `teens`.
  When `adults` is the user's only age band, exclude kid missions with an empty
  age list: those existing untagged missions were written for younger children.
  The nine `KA-01a` through `KA-03c` missions explicitly target grown children.
- The learning shelf contains a prose instruction row without an author. It is
  deliberately excluded from the book catalogue.
- The workbook still allows `on the road` but contains no mission tagged for it.
- Size labels and minutes are preserved exactly. The guide describes approximate
  ranges, but 27 Normal missions exceed 45 minutes and nine Stretch missions are
  30 minutes. Select using the supplied size and check actual duration separately.

The workbook's general matching guide and the older developer specification differ
on fallback ordering. The new onboarding does not change that behavior implicitly;
the application selection code owns the effective policy.

## Personal suggestion history

Today and Build an action record private `Mission feedback` journey events for
`shown`, `picked` and an explicit `passed`. IDs include the owner, mission, local
day, surface and action; a render or network retry cannot create another event.
Showing a card does not imply disliking it. The currently visible family is kept
stable while its impression is saved. Another idea never clears the history to
recycle exhausted choices.

The recommendation engine excludes a previously shown, picked or passed family
for 28 local days, including its other sizes. A person can still explicitly keep
their current idea, use Same focus tomorrow, or retrieve a saved reminder. Age,
time and duration eligibility still apply to these explicit requests.

The supplied update specifies the direction of personalization, not numerical
weights. The implementation uses these bounded starting weights: picked +0.5,
done +0.5, lit +3, drained -4, explicit pass -2, neutral/showing 0. Signals decay
with a 28-day half-life and stop contributing after 84 days. Family preferences
also contribute at 60% to their ladder and 35% to related interests. The combined
score is clamped to -6…6 and drives a deterministic weighted daily draw, so a
preferred idea is more frequent without permanently crowding out alternatives.
A completed, energizing step boosts the next step. Recent ladders, places and
people rotate gently, and Today varies the order of priorities across days.

Energy is independent of completion; a drained completed step is still a negative
preference, and skipping the energy question stays unknown. Private generated
missions contribute through the person's saved interest/place metadata. None of
these private scores is shown in the UI. Personalization works independently of
the optional cross-user analytics consent described below.

## Monthly mission metrics

After applying `20261128013107_mission_recommendation_metrics.sql`, a service-role
client can call `get_mission_recommendation_metrics` with `p_month: YYYY-MM-01`.
The response has `month`, `month_start`, `month_end_exclusive` and a `missions`
array. A single JSON result retains the full catalogue beyond the REST row cap.

The report contains only public mission IDs and counts: `shown`, `picked`, `done`,
`energy`, `neutral`, `drained` and `skipped`. `energy` counts the `lit` rating and
is independent of completion. `done` counts only `outcome = yes`. It includes
zero rows for unseen public missions and retains inactive public missions so
older monthly reports remain meaningful. No private mission IDs, people IDs,
focus text or reflections are returned.

Feedback is counted once per owner, mission, local `feedback_day` and action,
across all surfaces. Completion and energy use the intention's local `day`, even
when its check-in was created after midnight. Only the latest Privacy preference
with a JSON boolean `analytics: true` permits a person's data to contribute.
Opting out removes their contributions from previously reported months too.

With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured in the environment:

```sh
node --import tsx scripts/export-mission-metrics.ts 2026-11 --output reports/mission-metrics-2026-11.csv
node --import tsx --test tests/mission-metrics-database.test.ts
```

The exporter validates the month and response, writes only the eight documented
CSV columns, and never prints credentials or server response contents on failure.
