# iwillbe.me

An Expo app for finding and living a personal why through small, concrete commitments. Chloe helps a person notice what matters, choose how to show up, then get off the screen. React Native serves iOS/Android and Expo web, with Supabase accounts and an Anthropic-powered guide.

The implementation follows the Chloe brief supplied on **26 October 2026**: purpose develops through service, responsibility and lived experience; values matter more than mood; there are no streaks, guilt or pep talks.

The [26 October follow-through release note](docs/releases/2026-10-26-followthrough.md) records the original implementation checkpoint. See the [29 October release update](docs/releases/2026-10-29-beta-entry.md) for the applied revision migration and current verification scope. Chloe v8 is active in Supabase.

## October 29 entry update

The [neutral beta entry release note](docs/releases/2026-10-29-beta-entry.md) describes the four-panel introduction and required sign-in before personal questions. Existing guest data remains available for explicit account import. The revision migration is applied and its transactional live checks pass; real email/callback verification remains outstanding before external beta testing.

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

- **Where to today?** offers Be, People, Causes, Passions, Grow and Surprise me. Focus settings are **Focus on one area / Rotate areas / Let Chloe choose**. Future pictures and accepted weekly direction inform the selection.
- Morning screens ask one question at a time. A clear commitment continues without unnecessary confirmation; reworded commitments are checked briefly. Several ideas can be narrowed to one, with the others saved to Meaning To by choice. “For me” is a complete answer.
- Recent lived experiences can supply a short carry-forward line. Accepted source links let the why shape an area or prompt without interpreting unrelated words as a purpose. A person can explicitly mark a commitment as expressing their why and, occasionally, carry an eligible Open Question into the day without answering it immediately.
- Night recalls today's commitment and its planned context. Completion, energy and value choices stay separate. Values offer **Keep it / Still deciding / Let it go / Another value matters more**. Choosing another value releases the first without judgment and introduces the replacement as Trying it on.
- All in practice asks what was practiced and learned. A night check-in is also possible without a morning commitment. Returning after time away starts fresh without resurfacing old commitments or Meaning To.
- Skipped questions remain in **Open Questions**. The same eligibility rules cover ordinary reflections, nights without a commitment and All in questions. Deferred or stopped questions are not reintroduced as paraphrases. A carried question takes precedence over another optional discovery question. Daily exchanges stay short, with at most one discovery topic.
- A new possibility noticed at night is named and kept explicitly. Occasional night insights connect actual earlier and current choices; when there is no supported connection, the closing stays brief.
- Ritual dates use the profile timezone. A missing energy or value answer stays unknown. Explicit value decisions, including edited reflections and choosing a released value again, update the value without inventing an answer.

### My Possibilities

**Your why, and strengths** contains the why, strengths and values the person keeps choosing. The other parts remain distinct:

| Part                 | Plain names and behavior                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Possibilities        | **Maybe → Tried it → Into it**, with **On pause** retained as part of the person's story. **All in** is an explicit choice to practice more deeply, limited to one or two interests. |
| Values               | **Trying it on / Mine / Let go**. Worthwhile repeated choices support Mine; completion alone never proves conviction.                                                                |
| People I admire      | The person and the specific quality admired, alongside the why rather than merged into it.                                                                                           |
| Practices and habits | Regular actions that support the why and daily ritual.                                                                                                                               |
| Open Questions       | Questions to let sit, answer later, or stop asking.                                                                                                                                  |
| Meaning To           | Things postponed until done or released. Older items or repeated passes invite a decision without guilt.                                                                             |

Possibilities use an accessible card list with distinct borders and surfaces for their stages. A completed experience can establish Tried it; it does not establish enjoyment. Energy comes from explicit reflection. All in becomes eligible based on time actually spent Into it, not the age of an old Maybe. Practical exploration gives a small real-world try-on, with generic time/cost/access information rather than invented local availability or bookings.

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

Connected project: `mvhqovdznrzoduntyryh`. All eight repository migrations match the applied history checked on 29 October 2026. Chloe v8 and connections v3 are active; this release does not change their deployed source. Authenticated AI behavior and real email delivery remain separate live checks.

For subsequent backend changes, confirm the linked project and applied history before publishing:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy chloe --use-api
supabase functions deploy connections --use-api
```

Chloe uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in Supabase secrets. The supplied 26 October 2026 Chloe brief is implemented by the versioned prompt in `supabase/functions/chloe/prompt.ts`. It covers discovery, morning, night, exploration, Sunday, monthly and why conversations.

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

Run static and domain checks, then build the web export:

```sh
npm run check
npm run build
```

Serve that export with `npm run preview` in another terminal, then run the browser checks against it:

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

The browser checks exercise the guest journey through picture picks, one-question stories, growth, why, anchors, a concrete commitment and evening reflection. They also cover multiple ideas, explicit value replacement, returning after time away, Meaning To decisions, exploration, why/future versioning, weekly/monthly flows, focus settings, 320-pixel screens, keyboard interaction, contextual authentication and retained drafts. Targeted Chloe checks cover pending proposals, save failures, partial-save retries, confirmed focus and calendar download with intercepted services. Auth tests mock email and failure cases. Screenshots and results are written locally in `test-results/`; set `UI_BASE_URL` and `UI_ARTIFACT_DIR` to target a specific export or deployment. The dated release note records which checks have passed and which remain pending.

The dedicated synchronization suite passed eight checks using two simulated devices and strict revision-aware responses: foreground refresh preserves unfinished edits, stale saves show both versions, another edit during review requires a new review, an approved retry uses the reviewed revision, and sign-out/deletion remove only the account's local data. It also verifies failed deletion preserves data and a late Chloe reply cannot recreate account drafts or enter guest practice. Its generated [local report](test-results/sync/report.json) and the final [auth/import report](test-results/followthrough-auth/auth-results.json) record the runs; those local artifacts are not committed to Git.

These checks do not replace live verification of the exact deployed commit, real AI responses, email delivery or signed native builds. Deployment and live-service results should be recorded separately for each release. Historical checks from the earlier MVP are not evidence that this revision has been deployed or verified live.

`docs/plans/2026-10-19-refonte/requirements.json`, its adjacent `implementation.json`, and `design-qa.md` retain the earlier concept and visual review history. The current Chloe behavior is defined by the supplied 26 October brief and its implementation in the application and versioned prompt. Raw research PDF copies and local audit exports remain outside Git.
