# iwillbe.me

An Expo app for finding and living a personal why through small, concrete commitments. Chloe helps a person notice what matters, choose how to show up, then get off the screen. React Native serves iOS/Android and Expo web, with Supabase accounts and an Anthropic-powered guide.

The current implementation follows the supplied **25 November 2026 Round 4 developer pack** and mission workbook. Purpose develops through service, responsibility and lived experience; values matter more than mood; there are no streaks, guilt or pep talks.

## 26 November — Round 4

The [Round 4 release notes](docs/releases/2026-11-26-round4.md) and [PR #9](https://github.com/HyacintheHamon/iwillbe.me/pull/9) record the current behavior, source hashes, validation checkpoint and rollout steps. This branch contains **1,257 missions, 57 books and 44 interest links**, plus **216 night thoughts, of which 207 are eligible**. All 1,152 previous mission records are retained unchanged. Nine night-library entries with source caveats remain excluded.

Today now has an editable **I will** field, **Set my focus**, three idea cards and **More ideas** to add two. **Use idea** fills the field for review; a separate timing choice saves the focus. The wheels move to **Build an action** in My map, where three five-row wheels combine priority, interest and person/place. My map has six illustrated entries and two groups of interest-discovery suggestions.

Night keeps outcome, energy and an optional note on one screen. Explicit energy is saved for every outcome, including priority-only focuses. Optional obstacle support can offer a smaller step for tomorrow. Goodnight can carry the same focus into tomorrow's editable field without creating a commitment automatically. New interests require an explicit choice before entering My map.

Type checking, lint, 205 unit tests, the local database suite and the web build have passed on the final functional commit. Manual checks in connected Chrome have also exercised the [final isolated Vercel QA preview](https://iwillbe-jnfcd0fvs-snag-live.vercel.app/qa.html) at 390 × 844 and 320 × 568 using fictional data. The [manual review record](docs/releases/2026-11-26-round4.md#manual-chrome-review) includes successful final retests of the five-row wheels, focus-specific time-obstacle suggestion and Goodnight scroll position. The Playwright CLI suite is authored but has not been executed; native and live-service checks remain unverified. Production is unchanged. After merge, apply `20261126090001_round4_night_library.sql` and `20261126140000_round4_mission_catalogue.sql`, deploy the matching `chloe` function and publish the normal frontend export. Use the [isolated QA instructions](#isolated-round-4-browser-qa) below for preview testing; the release note distinguishes local checks, manual preview review and live activation.

### Previous release checkpoints

The [Round 3 notes](docs/releases/2026-11-19-round3.md) record the 19 November catalogue, administrator report and backend activation. [Round 2](docs/releases/2026-11-15-round2.md), the [3 November beta update](docs/beta-feedback-2026-11.md), the [29 October entry update](docs/releases/2026-10-29-beta-entry.md) and the [26 October follow-through release](docs/releases/2026-10-26-followthrough.md) retain earlier implementation and deployment history. Their old screen layouts and version numbers are historical checkpoints.

## Run locally

Use Node 22 or 24 and npm:

```sh
npm ci
cp .env.example .env.local
npm run web
```

The client configuration contains only the Supabase URL and publishable key. Never put Anthropic or service-role credentials in `EXPO_PUBLIC_*` variables. For a production-like local preview:

```sh
npm run build
npm run preview
# http://localhost:4173
```

## The practice

| Session                 | Intended length       | Experience                                                                                                   |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Find your possibilities | About five minutes    | Picture picks, three short stories, growth, a first why, check-in anchors and one small commitment.          |
| Morning                 | About two minutes     | One concrete “I will” or “I will be”, followed by when or how it will happen.                                |
| Night                   | About two minutes     | What happened, what gave energy or felt worth choosing, then a short send-off.                               |
| Sunday Explore          | About ten minutes     | Specific observations, one why question, a possibility to explore and the direction for the coming mornings. |
| Why revisit             | About fifteen minutes | Recent evidence, the current why and both future pictures, with changes only by choice.                      |

### Find your possibilities

The first session offers 30 picture cards across life, with **Curious / Already love / Not for me**, undo, skip and saved progress. Five original editorial illustrations represent the catalog's domains. The observation about the picks shares the first story screen. Questions follow one at a time: three stories, something to grow into, and “Who do you want to be remembered as?” A relevant story can invite one short contextual follow-up. Uncertainty remains an Open Question; it never becomes a fabricated interest or purpose.

Story-derived interests, admired people, strengths and values are reviewable proposals. Each needs supporting words from the person's answer and an explicit choice to keep it. Admiring someone's quality does not make it the person's own strength. Guest discovery uses conservative local rules; a signed-in person can explicitly request an AI synthesis. Failed requests preserve the stories and local suggestions. Corrected picture picks reconcile the entries created by that onboarding session without changing pre-existing interests.

A first why can remain **still forming**. Once written, it stays a living draft, supported by real stories and choices. New accepted versions preserve earlier ones. A proposed why never replaces an accepted one automatically.

Morning and night anchors describe what happens just before each check-in and are saved one at a time. Clock setup is optional at the end, so it does not add required steps before the first commitment. Native notification permission is requested explicitly. The web offers a calendar download for reminders that work after the page is closed; the browser itself does not run a background reminder service.

### Daily check-ins

- Today asks **Who will you be today, and for whom?** Typed words and capitals stay intact. Selecting an idea only fills the editable field. **Set my focus** opens **When will you do it?**, and the chosen time saves with the focus.
- Three initial idea cards can expand by two. Due action reminders lead the list on their local day; Meaning To and other grounded suggestions remain optional. A reminder or Goodnight prefill does not create an intention until the person confirms it.
- **Build an action** in My map combines three explicit wheel selections. **Harder** changes the size within one action family; **Another idea** selects a different family. The result can become today's focus or a next-day reminder.
- Night recalls today's focus and displays completion, energy and the optional note together. Outcome and energy are independent: **Not this time** can still have **Gave me energy**, **Neutral** or **Drained me**. Missing answers remain unknown. Priority review is occasional; no value decision is inferred from completion.
- Partial or uncompleted focuses can invite an optional obstacle answer and a smaller next step. A hard day, a skipped night and the previous night's obstacle prompt suppress that coaching. Repeated stalls can draw on the new skill ladders, without displaying private reason history or counts as judgments.
- Goodnight offers **Same focus tomorrow?** and a credited thought or fallback. Keeping the focus prepares an editable field for the next local day. Choosing in the morning leaves it open.
- A newly noticed interest needs explicit consent before it is added to My map. Accepted why, priorities, saved discoveries and Open Questions remain grounded in the person's own choices. Deferred or stopped questions are not reintroduced as paraphrases.
- Ritual dates use the profile timezone. Existing revisions, owner isolation, explicit value changes, saved history and nights without a morning focus remain supported.

### My map

Six illustrated entries lead to **My why**, **Who I'm becoming**, **What I'm growing**, **Who I show up for**, **Try something new** and **Future me**. **Build an action** brings the three wheels together. The stored parts remain distinct:

| Part                 | Plain names and behavior                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interests            | **Want to try / From time to time / Into it**, with **On pause** retained as part of the person's story. **All in** is an explicit choice to practice more deeply, limited to one or two interests. |
| Priorities           | Who the person is working on becoming and what matters to them. Worthwhile repeated choices can support an explicit review; completion alone never proves conviction.                               |
| People I admire      | The person and the specific quality admired, alongside the why rather than merged into it.                                                                                                          |
| Practices and habits | Regular actions that support the why and daily ritual.                                                                                                                                              |
| Open Questions       | Questions to let sit, answer later, or stop asking.                                                                                                                                                 |
| Meaning To           | Things postponed until done or released. Older items or repeated passes invite a decision without guilt.                                                                                            |

What I'm growing leads with Into it, then From time to time and Want to try; All in and On pause remain available. A completed experience does not establish enjoyment. Energy comes from explicit reflection. All in eligibility uses time actually spent Into it. Interest discovery offers **Close to what you love** and **Something different**, excludes interests already on the map and avoids repeats when refreshed. Passed ideas have a seven-day cooldown; adding one requires confirmation. Practical exploration gives a small real-world try-on without inventing local availability or bookings.

### Weekly and future views

Sunday Explore draws short observations from the current week's actual check-ins, asks one reflective why question, offers a related possibility, and confirms how the week should shape mornings. Custom interests can inform the suggestion; old history, future commitments and things not yet tried are excluded from the week's positive evidence. A proposed weekly focus changes mornings only after confirmation and respects a fixed-area preference. Optional focus, Meaning To and Open Question tools sit behind a separate control so the closing stays short.

The first Sunday can invite a first look at **One year out** and **Later in life**. The latter lets the person choose age 80, 90 or 100. A One year out narrative produces a proposed area map that can be edited or removed before confirmation. The person can also keep the picture without area guidance. No version is saved merely by reaching the sorting screen.

Monthly check-ins revisit One year out with **Still true / Tweak it / Something’s changed**. Why revisits become due after three calendar months from the start or the last completed revisit, rather than after a number of completed monthly check-ins. The guided revisit shows recent evidence, asks one question, offers an editable draft, tests whether it would help a choice, then reviews each future view separately. The new why cites the selected clues and any newly saved thought. Both future views and accepted why versions retain earlier versions; archives are optional. Reaffirming a displayed picture preserves a separate unfinished draft. Life changes can prompt a revisit at any time.

Session lengths are design targets, not measured results from timed human sessions.

### Privacy and connections

Chloe uses authenticated, private saved context; an AI provider processes conversation text and relevant context. The app does not describe device storage as an end-to-end encrypted vault. People can export their practice, remove memory, revoke invitation links and delete their account.

Comet, Ask a Friend and coach invitation links use the device share sheet. Guests can open links without accounts. A sender cannot see a Comet recipient's acceptance, pass or silence. Friend suggestions arrive for the owner's approval as Maybes with attribution. Coach links grant no journal access; weekly action titles can be shared only after preview. Optional usage events contain no journal text, and explicitly submitted product feedback remains separate from private reflections.

## Persistence and migration

Guest storage is versioned (`iwillbe.practice.v2.guest`). Existing v1 practice is read, converted, and retained as a backup until explicitly cleared. Account data uses the same structure with owner-scoped caching. Account writes require connectivity; there is no offline write queue. Mutations from one client are serialized, and returning to the app refreshes account data while retaining unfinished drafts.

New account writes use compare-and-swap revisions: edits and deletes match the saved revision captured by the editor. A conflict shows the saved version and the person's draft, with explicit choices to keep the saved version, save the draft after review, or decide later. An identical retry can adopt a write that already succeeded; a different draft requires review. Owner-scoped draft writes are ordered, and clearing an owner invalidates late callbacks so they cannot restore cleared text.

**`supabase/migrations/20261029154648_practice_revision_guards.sql` was applied on 29 October 2026.** Its SQL is unchanged from the original `20261026230327` candidate; the filename now matches the version assigned by Supabase. The migration adds revisions to profiles, intentions, check-ins, memories and journey entries without changing ownership rules. Live transactional checks passed for stale edits/deletes, legacy-client revision increments and owner isolation. Older clients remain compatible, but only clients sending revision predicates can detect their own stale edits.

After sign-in, importing the guest practice requires explicit consent. The SQL function runs atomically with the caller's RLS and never overwrites account days, profiles, reflections or existing entries. Same-day conflicts remain in the guest backup. Drafts survive navigation; a Chloe draft is never sent automatically after authentication.

All new entities have stable UUIDs and provenance. Intentions link to interest/value identities while retaining historical labels. Legacy labels become unconfirmed entries, never invented enjoyment or settled values. Stored legacy state names remain compatible with the plain labels shown in the app. Existing North Star names remain beneficiaries rather than becoming a why or an admired person automatically. Historical accepted why text remains a user-owned version when its source changes. Saving an intention or reflection and updating its linked value are separate remote writes. If the value update fails after the main record saves, that record is retained and the error explains that retry is needed; retries update existing identities.

## Backend

Configured Supabase project: `mvhqovdznrzoduntyryh`. The [Round 3 release note](docs/releases/2026-11-19-round3.md#backend-activation) records the previous backend activation. Round 4 adds two pending catalogue migrations and changes the Chloe function. Local validation applies all 15 repository migrations to PostgreSQL/PGlite; it does not establish that the remote history contains the new versions.

After merge and release verification, confirm the linked project and applied history, then apply the Round 4 migrations and matching function:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push
supabase functions deploy chloe --use-api
```

The new migrations are `20261126090001_round4_night_library.sql` and `20261126140000_round4_mission_catalogue.sql`. They retain stable IDs and user history. No `connections` source change is part of Round 4. Deploy the normal frontend export after the matching backend is available, and record live results in the release notes.

Chloe uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in Supabase secrets. The supplied Round 4 current prompt is in `supabase/functions/chloe/master-prompt.ts`, with screen rules and compatibility contracts in `prompt.ts`; its version is `chloe-2026-11-25-round4`. It covers discovery, morning, night, exploration, Sunday, monthly and why conversations.

Replies are validated structured proposals. The server builds context from the accepted why, dated commitments and reflections, saved discoveries, future pictures, focus preferences, anchors and question status. It uses a longer evidence window for a three-month why revisit and separates old conversation evidence from the active exchange. Exact-question recovery keeps a real question skippable when the model omits its question field; it does not invent a question or combine several. Repeat guards supplement the instructions for deferred and stopped questions.

Intentions, discoveries, memory notes and why proposals require explicit acceptance in the UI. Chat can also propose a night reflection tied to today's intention and a Sunday focus, with supporting evidence checked against saved sources. Proposed outcomes, energy, value decisions and replacements remain editable until explicitly saved; missing answers remain unknown. Pending proposals survive reload and failed saves. A Sunday proposal cannot silently replace a fixed area chosen elsewhere. Onboarding synthesis is a separate bounded action that returns proposals and at most one follow-up without editing the why. These new contracts require the updated function deployment.

The endpoint does not perform autonomous actions, send messages, schedule reminders, stream responses or book activities.

The `connections` function permits anonymous token-based reads/replies but authenticates creation/redemption itself. Invitation tokens contain 256 bits of randomness; only their hashes are stored. Public responses contain only the explicitly shared message, chosen sender name, kind and opaque sender key. Links expire after 30 days and can be revoked. Friend replies are bounded and deduplicated. Comet choices are never stored on sender-readable tables. Before sign-in, recipient limits and blocking are device-local and can be reset by clearing browser storage; this is not a verified-person abuse limit.

Every exposed table uses RLS and explicit grants. `ai_usage` and `sponsor_codes` are service-only. Clients cannot forge assistant messages, quota counters, entitlements or cross-owner references. Deleting an account cascades to its data and invitations after revoking sessions. Device storage is not a separately encrypted journal vault.

## Beta access and sponsors

The beta remains free, with no checkout, trial countdown or automatic charge. The concept's proposed paid prices and employer/coach dashboards are not activated. A server-controlled `entitlements` table and atomic seat-limited sponsor redemption are ready for provisioned codes. Sponsors receive no practice access or individual engagement API. Future billing must use verified server webhooks rather than client-writable flags.

Provision codes with a trusted administrative process: generate at least 20 random characters, uppercase/trim the code, SHA-256 hash it, then insert only the hash, label, seat count and expiration in `sponsor_codes`. Distribute the original code privately. There are no sample production codes or fabricated subscriptions in this repository. Any sponsor reporting should be aggregate-only and suppress small groups; no employer reporting dashboard is shipped.

## Distribution and owner configuration

The configured web origin is `https://iwillbe-me.vercel.app`, in Vercel project `snag-live/iwillbe-me`. The previous web release used CLI deployment. Do not assume that a Git push publishes this project unless its Git integration has been configured. Confirm the linked project before publishing a verified working copy:

```sh
npm run check
npm run build
vercel project inspect iwillbe-me --scope snag-live
vercel deploy --prod --scope snag-live
```

`vercel.json` exports Expo and serves `dist` with SPA routing. The export includes an installable web manifest and 192/512 pixel icons. There is no service-worker claim of full offline operation. The private Anthropic variable also exists as a sensitive Production variable in Vercel at the owner's request; the SPA does not consume it, since Chloe runs in Supabase.

At the release-note checkpoint, `iwillbe.me` and `www.iwillbe.me` are attached and verified in the Vercel project, but public DNS still points at Namecheap parking. The exact required website records and remaining owner actions are recorded in the release note. The project has a 308 redirect from `www` to the apex. Preserve existing email DNS when changing website records; attachment and verification alone do not establish that the custom domain serves the app.

Custom SMTP still needs a provider configuration and real delivery verification. Supabase's default email sender restricts delivery. The dashboard was behind a sign-in wall during this release work; no outbound email was sent. The existing exact redirect allow-list includes the canonical/secondary Vercel `/account` and `/reset-password` routes, localhost:8081 callbacks and the `iwillbe://` native scheme. Add exact callbacks when introducing another domain. Magic-link entry, password fallback and reset are implemented; no six-digit code is promised.

`eas.json` contains development, preview and production profiles. Signed builds require the owner's Expo/Apple/Google credentials. Device lock uses Expo Local Authentication with the phone's biometric/device authentication. Native reminders recur daily at phone-local morning and night times and link to the intended screen; returning to the app reconciles reminder settings and the phone timezone. The web downloads two recurring calendar events in the saved profile timezone, with daylight-saving information and links back to the public app. Calendar entries contain no private stories or commitments and are edited or removed in the calendar after import. These are recurring invitations; they do not promise to suppress an event after a check-in is completed.

Signed builds, Face ID, timezone travel behavior, reminder delivery and native cold-start links remain to be tested on real iOS/Android devices. Browser download and calendar-file validation do not prove delivery by a calendar application. On the web, sign-out removes the account cache; a retained guest backup still belongs to that browser.

## Verification

Run static and domain checks, the isolated database suite, then build the web export:

```sh
npm run check
npm run test:database
npm run build
```

The final functional commit `185a94c8c2ac986ae2739928a5848b1b9c6a6792` passed type checking, lint, 205 unit tests, the local database suite with all 15 migrations and the production web export. GitHub Actions runs [45848742442](https://github.com/HyacintheHamon/iwillbe.me/actions/runs/45848742442) and [45848730819](https://github.com/HyacintheHamon/iwillbe.me/actions/runs/45848730819) both succeeded on that exact commit. Manual connected-Chrome checks on the hosted fictional fixture covered Today, My map, action reminders, discovery, Night energy and obstacles, Goodnight and the next-day prefill; the three final visual/behavior corrections were retested successfully. The [dated release note](docs/releases/2026-11-26-round4.md#verification-checkpoint) records the exact preview and observations. The Playwright CLI suite remains unexecuted. Local database tests use PostgreSQL/PGlite and do not mutate the connected Supabase project.

### Regenerate the Round 4 source data

The checked-in JSON and SQL are sufficient for normal builds. To regenerate them from the supplied attachments:

```sh
python scripts/extract-round4.py '/path/to/iwillbe-mission-library(2).xlsx'
node scripts/build-round4-seed.mjs
python scripts/extract-round4-night-library.py '/path/to/iwillbe-me-developer-pack-round4.pdf'
```

The workbook importer uses the Python standard library and validates the 1,257 missions, 57 books and 44 links while preserving historical records. The PDF importer requires `pdfplumber` and `pdftotext`; it writes the current master prompt, the 216-entry night library, source metadata and the night-library migration. Review generated changes before committing. Neither importer sends data to production.

### Isolated Round 4 browser QA

The final [Round 4 QA controller](https://iwillbe-jnfcd0fvs-snag-live.vercel.app/qa.html) was reviewed manually in connected Chrome on 26 November. It serves QA commit `f452248c232a435ac9d9aea03336010f1833b93c`, based on functional commit `185a94c8c2ac986ae2739928a5848b1b9c6a6792`, as the unpromoted Preview deployment `dpl_4nMe9GFERsoXvix2Mc49TVNe1cgn`. The final retest confirmed five visible cyclic words on each Build an action wheel, working difficulty/idea changes, the exact focus-specific five-minute reminder, and Goodnight opening at the top with a working closing button. On the following morning the reminder appeared first without creating a new intention. The fixture uses fictional local records; the review observed no live external service calls and a blocked-call counter of zero. This establishes no live provider/database or native verification, and production is unchanged.

Build the product, copy it into the isolated fixture and start its local server:

```sh
npm run build
node scripts/build-round4-fixture.mjs
node scripts/serve-round4-fixture.mjs
# http://localhost:4184
```

Open **http://localhost:4184/qa.html** for the visible controller. It switches between the four scenarios and 390 × 844 / 320 × 568 viewports, opens app screens, resets fictional data and advances to the same evening or the following morning. Its saved-state panel displays service counters, intention/check-in/reminder counts and the exact saved words, time, outcome and energy. Advancing the clock keeps the scenario's saved data; choosing or resetting a scenario starts fresh.

The separate Playwright CLI suite has been authored but was not executed in this workspace, where a usable CLI Chromium executable was unavailable. To run it with an available Playwright Chromium installation, use another terminal:

```sh
UI_BASE_URL=http://localhost:4184 node scripts/verify-round4.mjs
```

`PLAYWRIGHT_EXECUTABLE_PATH` or `PLAYWRIGHT_CHANNEL` can select an existing browser. The fixture lives in `test-results/round4-preview`; it leaves production `dist` untouched and refuses `VERCEL_ENV=production`. Fictional local responses and a restrictive content security policy block live Supabase/AI calls. This fixture must not be published as the production app.

Use `/?qaScenario=morning&qaReset=1`, `/reflect?qaScenario=evening&qaReset=2`, `/?qaScenario=next-day&qaReset=3` or `/reflect?qaScenario=previous-obstacle&qaReset=4`. Change `qaReset` to reset fictional data. The authored suite targets 390 × 844 and 320 × 568, with screenshots configured for `test-results/round4-ui`. Its intended assertions cover editable ideas and exact wording, timing, My map, five-row wheels, reminders, inline Night, explicit energy, Goodnight prefill and obstacle cooldown. Fixture syntax and mock-transport checks have passed. Completed manual browser observations, including the successful final retests, are recorded separately in the release note.

### Earlier browser and live database checks

The earlier browser scripts remain available for their original flows. Serve the normal export with `npm run preview` in another terminal, then run them against it:

```sh
UI_BASE_URL=http://localhost:4173 npm run test:browser
UI_BASE_URL=http://localhost:4173 node scripts/verify-guidance.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-onboarding.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-chloe.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-sync.mjs
```

`test:browser` runs the general UI and auth scripts. The additional scripts exercise targeted guidance, onboarding, Chloe proposals and synchronization/privacy flows. Set `PLAYWRIGHT_EXECUTABLE_PATH` or `PLAYWRIGHT_CHANNEL` when using an existing browser installation. These scripts use synthetic guest fixtures or intercepted account/API responses; they do not prove live AI behavior, email delivery or database conflict handling.

For a correctly linked Supabase project, run the SQL checks only after their required migrations are applied; they roll back their fixtures. `db query` requires a CLI that exposes that command, and advisors likewise need a compatible CLI. Inspect `supabase db --help` first; an authorized SQL connection or MCP can run the same files when the CLI is unavailable:

```sh
supabase db query --linked --file tests/rls.sql
supabase db query --linked --file tests/import.sql
supabase db query --linked --file tests/journey.sql
supabase db query --linked --file tests/friend-suggestions.sql
supabase db query --linked --file tests/revisions.sql
supabase db advisors --linked --type security --level warn
```

The domain and prompt tests cover timezone boundaries, import conflicts, plain possibility/value states, explicit value retries, accepted why selection, focus preferences, weekly scheduling, calendar-quarter evidence, fresh returns and deferred/stopped question handling. Guidance tests cover source-grounded continuity, current-week custom interests, confirmed future area proposals and All in eligibility. Onboarding tests cover uncertain answers, correcting session-owned picks, resumed drafts, supported proposals and one contextual follow-up. Additional unit tests validate reflection/focus contracts, revision retry comparisons, draft write ordering and calendar output. SQL tests cover ownership, immutable reflected intentions, imports, anonymous denial and server-only functions. The revision checks passed against the live project on 29 October, with all fixtures rolled back.

Earlier browser suites were written for the guest journey through picture picks, one-question stories, growth, why, anchors, a concrete commitment and evening reflection. They also cover multiple ideas, explicit value replacement, returning after time away, Meaning To decisions, exploration, why/future versioning, weekly/monthly flows, focus settings, 320-pixel screens, keyboard interaction, contextual authentication and retained drafts. Targeted Chloe checks cover pending proposals, save failures, partial-save retries, confirmed focus and calendar download with intercepted services. Auth tests mock email and failure cases. Their historical results do not establish coverage of the new Round 4 screen layouts. Screenshots and results are written locally in `test-results/`; set `UI_BASE_URL` and `UI_ARTIFACT_DIR` to target a specific export or deployment. The dated release note records which checks have passed and which remain pending.

The dedicated synchronization suite passed eight checks using two simulated devices and strict revision-aware responses: foreground refresh preserves unfinished edits, stale saves show both versions, another edit during review requires a new review, an approved retry uses the reviewed revision, and sign-out/deletion remove only the account's local data. It also verifies failed deletion preserves data and a late Chloe reply cannot recreate account drafts or enter guest practice. Its generated [local report](test-results/sync/report.json) and the final [auth/import report](test-results/followthrough-auth/auth-results.json) record the runs; those local artifacts are not committed to Git.

These checks do not replace live verification of the exact deployed commit, real AI responses, email delivery or signed native builds. Deployment and live-service results should be recorded separately for each release. Historical checks from the earlier MVP are not evidence that this revision has been deployed or verified live.

`docs/plans/2026-10-19-refonte/requirements.json`, its adjacent `implementation.json`, and `design-qa.md` retain the earlier concept and visual review history. The current Chloe behavior is defined by the supplied Round 4 pack, its screen-specific rules and the versioned prompt. Raw source PDFs, workbooks and local audit exports remain outside Git.
