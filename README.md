# iwillbe.me

An Expo app for finding and living a personal why through small, concrete commitments. Chloe helps a person notice what matters, choose how to show up, then get off the screen. React Native serves iOS/Android and Expo web, with optional Supabase accounts and an Anthropic-powered guide.

The implementation follows the Chloe brief supplied on **26 October 2026**: purpose develops through service, responsibility and lived experience; values matter more than mood; there are no streaks, guilt or pep talks.

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

The first session offers 30 picture cards across life, with **Curious / Already love / Not for me**, undo, skip and saved progress. Five original editorial illustrations represent the catalog's domains. Questions follow one at a time: three stories, something to grow into, and “Who do you want to be remembered as?” Uncertainty remains an Open Question; it never becomes a fabricated interest or purpose. A suggested value is an invitation that requires confirmation.

A first why can remain **still forming**. Once written, it stays a living draft, supported by real stories and choices. New accepted versions preserve earlier ones. A proposed why never replaces an accepted one automatically.

Morning and night anchors describe what happens just before each check-in. Clock times are chosen separately and saved with the profile. Native notification permission is requested explicitly; web onboarding explains that the browser does not send reminders.

### Daily check-ins

- **Where to today?** offers Be, People, Causes, Passions, Grow and Surprise me. Focus settings are **Focus on one area / Rotate areas / Let Chloe choose**. Future pictures and accepted weekly direction inform the selection.
- Morning screens ask one question at a time. A clear commitment continues without unnecessary confirmation; reworded commitments are checked briefly. Several ideas can be narrowed to one, with the others saved to Meaning To by choice. “For me” is a complete answer.
- Night recalls today's commitment and its planned context. Completion, energy and value choices stay separate. Values offer **Keep it / Still deciding / Let it go / Another value matters more**. Choosing another value releases the first without judgment and introduces the replacement as Trying it on.
- All in practice asks what was practiced and learned. A night check-in is also possible without a morning commitment. Returning after time away starts fresh without resurfacing old commitments or Meaning To.
- Skipped questions remain in **Open Questions**. Chloe can revisit an eligible question later; stopped questions stay stopped unless explicitly reopened. Daily exchanges stay short, with at most one discovery topic.
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

The visual galaxy also has an accessible list. A completed experience can establish Tried it; it does not establish enjoyment. Energy comes from explicit reflection. Practical exploration gives a small real-world try-on, with generic time/cost/access information rather than invented local availability or bookings.

### Weekly and future views

Sunday Explore draws short observations from actual check-ins, asks one reflective why question, offers a related possibility, and confirms how the week should shape mornings. It can also invite a first look at **One year out** and **Later in life**. The latter lets the person choose age 80, 90 or 100.

Monthly check-ins revisit One year out with **Still true / Tweak it / Something’s changed**. Why revisits become due after three calendar months from the start or the last completed revisit, rather than after a number of completed monthly check-ins. Both future views retain earlier versions. Life changes can prompt a revisit at any time. The why and future pictures change only through explicit acceptance.

### Privacy and connections

Chloe uses authenticated, private saved context; an AI provider processes conversation text and relevant context. The app does not describe device storage as an end-to-end encrypted vault. People can export their practice, remove memory, revoke invitation links and delete their account.

Comet, Ask a Friend and coach invitation links use the device share sheet. Guests can open links without accounts. A sender cannot see a Comet recipient's acceptance, pass or silence. Friend suggestions arrive for the owner's approval as Maybes with attribution. Coach links grant no journal access; weekly action titles can be shared only after preview. Optional usage events contain no journal text, and explicitly submitted product feedback remains separate from private reflections.

## Persistence and migration

Guest storage is versioned (`iwillbe.practice.v2.guest`). Existing v1 practice is read, converted, and retained as a backup until explicitly cleared. Account data uses the same structure with owner-scoped caching. Account writes require connectivity; there is no offline write queue or automatic resolution of concurrent edits to the same entry. Mutations from one client are serialized.

After sign-in, importing the guest practice requires explicit consent. The SQL function runs atomically with the caller's RLS and never overwrites account days, profiles, reflections or existing entries. Same-day conflicts remain in the guest backup. Drafts survive navigation; a Chloe draft is never sent automatically after authentication.

All new entities have stable UUIDs and provenance. Intentions link to interest/value identities while retaining historical labels. Legacy labels become unconfirmed entries, never invented enjoyment or settled values. Stored legacy state names remain compatible with the plain labels shown in the app. Existing North Star names remain beneficiaries rather than becoming a why or an admired person automatically. Historical accepted why text remains a user-owned version when its source changes. Saving an intention or reflection and updating its linked value are separate remote writes. If the value update fails after the main record saves, that record is retained and the error explains that retry is needed; retries update existing identities.

## Backend

Connected project: `mvhqovdznrzoduntyryh`. Migrations in `supabase/migrations/` match its applied history.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy chloe --use-api
supabase functions deploy connections --use-api
```

Chloe uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in Supabase secrets. The supplied 26 October 2026 Chloe brief is implemented by the versioned prompt in `supabase/functions/chloe/prompt.ts`. It covers discovery, morning, night, exploration, Sunday, monthly and why conversations.

Replies are validated structured proposals. The server builds context from the accepted why, dated commitments and reflections, saved discoveries, future pictures, focus preferences, anchors and question status. It uses a longer evidence window for a three-month why revisit and separates old conversation evidence from the active exchange. An exact-repeat guard supplements the instructions for deferred and stopped questions. Intentions, discoveries, memory notes and why proposals require explicit acceptance in the UI. The endpoint does not perform autonomous actions, send messages, schedule reminders, stream responses or book activities.

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

Custom SMTP still needs a provider configuration and real delivery verification. Supabase's default email sender restricts delivery. The existing exact redirect allow-list includes the canonical/secondary Vercel `/account` and `/reset-password` routes, localhost:8081 callbacks and the `iwillbe://` native scheme. Add exact callbacks when introducing another domain. Magic-link entry, password fallback and reset are implemented; no six-digit code is promised.

`eas.json` contains development, preview and production profiles. Signed builds require the owner's Expo/Apple/Google credentials. Device lock uses Expo Local Authentication with the phone's biometric/device authentication; reminders use a rolling 14-day schedule, skip already completed rituals and link to the intended screen. Signed builds, Face ID, reminders and native cold-start links must be tested on real devices before distribution. On the web, sign-out removes the account cache; a retained guest backup still belongs to that browser.

## Verification

Run static and domain checks, then build the web export:

```sh
npm run check
npm run build
```

Serve that export with `npm run preview` in another terminal, then run the browser suite against it:

```sh
UI_BASE_URL=http://localhost:4173 npm run test:browser
```

For a correctly linked Supabase project, the existing SQL checks roll back their fixtures:

```sh
supabase db query --linked --file tests/rls.sql
supabase db query --linked --file tests/import.sql
supabase db query --linked --file tests/journey.sql
supabase db query --linked --file tests/friend-suggestions.sql
supabase db advisors --linked --type security --level warn
```

The domain and prompt tests cover timezone boundaries, import conflicts, plain possibility/value states, explicit value retries, accepted why selection, focus preferences, weekly scheduling, calendar-quarter evidence, fresh returns and deferred/stopped question handling. Onboarding tests cover uncertain answers, resuming earlier discovery drafts, quick-pick meanings, grounded value invitations and valid reminder times. SQL tests check ownership, immutable reflected intentions, legacy/new imports, retries, anonymous denial and server-only functions.

The browser suite exercises the guest journey through picture picks, one-question stories, growth, why, anchors, a concrete commitment and evening reflection. It also covers multiple ideas, explicit value replacement, returning after time away, Meaning To decisions, exploration, why/future versioning, weekly/monthly flows, focus settings, small screens, contextual authentication and retained drafts. Auth tests mock email and failure cases. Screenshots and results are written locally in `test-results/`; set `UI_BASE_URL` and `UI_ARTIFACT_DIR` to target a specific export or deployment.

These checks do not replace live verification of the exact deployed commit, real AI responses, email delivery or signed native builds. Deployment and live-service results should be recorded separately for each release. Historical checks from the earlier MVP are not evidence that this revision has been deployed or verified live.

`docs/plans/2026-10-19-refonte/requirements.json`, its adjacent `implementation.json`, and `design-qa.md` retain the earlier concept and visual review history. The current Chloe behavior is defined by the supplied 26 October brief and its implementation in the application and versioned prompt. Raw research PDF copies and local audit exports remain outside Git.
