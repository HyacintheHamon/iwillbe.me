# Round 3 mission catalogue

Source: Kelly's mission workbook accompanying the November 18, 2026 developer pack.
The workbook contains **1,152 missions**, including 27 healthy additions and 36 kind-with-kids
variants. The earlier 1,116 count in the PDF predates the kids additions. Its SHA-256 is
recorded in `source.json`.

All 1,089 Round 2 IDs remain present, with their original mission text and first step.
`CA-MEN-3b` also gains the `teens` age tag. The 56 books and 44 interest links are retained.
`data/round2` is the historical source; the app reads `data/round3`.

Rebuild the JSON without editing the source workbook:

```sh
python scripts/extract-round3.py path/to/workbook.xlsx
node scripts/build-round3-seed.mjs
```

The migration file must first be created using `supabase migration new round3_mission_catalogue`.
The seed builder only writes that existing migration. Neither command applies database changes.
The SQL upserts by stable ID and does not remove private missions or user history.

## Added metadata

- `ages`: source labels `under 6`, `6–12`, `teens`; an empty list means any age.
- `family_id`: the common ID without its a/b/c size marker; extra ideas (`1a2`)
  remain separate from the main family (`1a`, `1b`, `1c`).
- `theme`: explicit HL themes plus derived health classifications for existing missions.
  Unclassified missions keep an empty theme. The mission wording and tags remain unchanged.

## Selection and preferences

`selectMission` in `src/mission-selection.ts` keeps priority and who/where together.
When that combination has no eligible mission, it falls back to the priority and returns
`whereCleared: true`, `effectiveWhere: "anywhere"` so the UI clears the selection.
It never falls back to who/where alone when a priority was selected.

The family is chosen independently of size. Pass its `familyId` when changing size.
Use `availableLevels` and `unavailableReasons` to disable variants that do not fit the
local time, weekday, or children's ages; do not generate another idea for a disabled size.

Preferences live in existing journey entries, not new profile columns:

- `kind: "preferences"`, `title: "Kids ages"`, `meta: { ages: [...], asked: true }`.
  Skipping stores an empty array, so Chloe does not repeatedly ask.
- `kind: "preferences"`, `title: "Priority theme"`,
  `meta: { priority: "healthy", theme: "sleep", asked: true }`.
- Passing a suggestion: `kind: "event"`, `title: "Mission feedback"`,
  `meta: { mission_id, priority, theme, outcome: "passed" }`.

Existing intentions and check-ins supply picked, completed, and "lit me up" signals.
The weighted theme rotation is deterministic by the user's local calendar day.

The workbook permits `on the road` but has no missions tagged for it. The explicit
priority fallback handles this gap. The workbook describes every kids easy/normal
step as evening-compatible, but `KK-02a` is explicitly an outing and `KK-10b` takes
60 minutes. Selection respects those actual settings and durations.
