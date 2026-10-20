# iwillbe.me

An Expo app for discovering what matters, trying one small thing, and reflecting on what to keep. React Native for iOS/Android and Expo web, with optional Supabase accounts and Chloe, an Anthropic-powered guide.

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

- Discover 30 possibilities through an optional Spark Sort, with undo, skip, saved progress, three personal stories, a first why and optional baseline questions. Five original editorial illustrations represent the catalog's domains.
- Choose a planet: Be, People, Causes, Passions, Grow or Surprise. Keep one intention per day with optional time/context, place, beneficiary and companion. A value is optional. Choose a steady orbit, variety or guidance.
- Reflect separately on completion, energy and whether a value is worth choosing again. An old reflection with no energy remains unknown. No streaks or penalties for absence.
- Explore a galaxy of interests, values, strengths and people around a versioned why. Spark/Glow/Blaze describe curiosity and explicit positive experiences; Ember and Craft are deliberate choices. Completed actions alone never establish joy or conviction. Every map also has an accessible list.
- Explore practical try-ons, save sparks, follow related possibilities and keep a “Meaning to…” list that can be released. Generic costs/access information never implies an available local booking.
- Keep near/far telescope pictures with versions and optional details by planet. Review weekly, monthly (“Full Moon”, a calendar-month reflection), and revisit the why every third completed monthly reflection or after a life change. Monthly questions use the same versioned wording as the baseline; scores stay hidden until requested.
- Talk with Chloe in discovery, morning, night, exploration, Sunday, Full Moon or why modes. Intentions, discoveries, memory notes and why revisions require confirmation. Deferred/stopped questions are retained as explicit context.
- Send Comet, Ask a Friend and coach invitation links through the device share sheet. Guests can open links without accounts. A sender cannot see a Comet recipient's acceptance, pass or silence. Friend suggestions require the owner's approval. Coach links grant no journal access; weekly action titles can be shared after preview.
- Export the complete practice, revoke invitation links, delete memory and delete the account. Optional usage events contain no journal text or scores; explicitly sent product feedback is separate from private reflections.

## Persistence and migration

Guest storage is versioned (`iwillbe.practice.v2.guest`). Existing v1 practice is read, converted, and retained as a backup until explicitly cleared. Account data uses the same structure with owner-scoped caching. Account writes require connectivity; there is no offline write queue or automatic resolution of concurrent edits to the same entry. Mutations from one client are serialized.

After sign-in, importing the guest practice requires explicit consent. The SQL function runs atomically with the caller's RLS and never overwrites account days, profiles, reflections or existing entries. Same-day conflicts remain in the guest backup. Drafts survive navigation; a Chloe draft is never sent automatically after authentication.

All new entities have stable UUIDs and provenance. Intentions link to interest/value identities while retaining historical labels. Legacy labels become unconfirmed entries, never fabricated Blaze/Steady states. Existing North Star names remain beneficiaries rather than becoming a why or an admired person automatically. Historical accepted why text remains a user-owned version when its source changes.

## Backend

Connected project: `mvhqovdznrzoduntyryh`. Migrations in `supabase/migrations/` match its applied history.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy chloe --use-api
supabase functions deploy connections --use-api
```

Chloe uses `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in Supabase secrets. The prompt is versioned in `supabase/functions/chloe/prompt.ts`; it implements the concept brief. No separate author-supplied master prompt was available. Replies are validated structured proposals, with bounded recent history and saved journey context. No streaming, autonomous actions or bookings are performed.

The `connections` function permits anonymous token-based reads/replies but authenticates creation/redemption itself. Invitation tokens contain 256 bits of randomness; only their hashes are stored. Public responses contain only the explicitly shared message, chosen sender name, kind and opaque sender key. Links expire after 30 days and can be revoked. Friend replies are bounded and deduplicated. Comet choices are never stored on sender-readable tables. Before sign-in, recipient limits and blocking are device-local and can be reset by clearing browser storage; this is not a verified-person abuse limit.

Every exposed table uses RLS and explicit grants. `ai_usage` and `sponsor_codes` are service-only. Clients cannot forge assistant messages, quota counters, entitlements or cross-owner references. Deleting an account cascades to its data and invitations after revoking sessions. Device storage is not a separately encrypted journal vault.

## Beta access and sponsors

The beta remains free, with no checkout, trial countdown or automatic charge. The concept's proposed paid prices and employer/coach dashboards are not activated. A server-controlled `entitlements` table and atomic seat-limited sponsor redemption are ready for provisioned codes. Sponsors receive no practice access or individual engagement API. Future billing must use verified server webhooks rather than client-writable flags.

Provision codes with a trusted administrative process: generate at least 20 random characters, uppercase/trim the code, SHA-256 hash it, then insert only the hash, label, seat count and expiration in `sponsor_codes`. Distribute the original code privately. There are no sample production codes or fabricated subscriptions in this repository. Any sponsor reporting should be aggregate-only and suppress small groups; no employer reporting dashboard is shipped.

## Distribution and owner configuration

The existing public web origin is `https://iwillbe-me.vercel.app`, Vercel project `snag-live/iwillbe-me`. The previous web release was deployed by CLI; pushing this repository does not configure automatic Vercel deployment. To publish a verified working copy:

```sh
npm run check
npm run build
vercel deploy --prod --scope snag-live
```

`vercel.json` exports Expo and serves `dist` with SPA routing. The export includes an installable web manifest and 192/512 pixel icons. There is no service-worker claim of full offline operation. The private Anthropic variable also exists as a sensitive Production variable in Vercel at the owner's request; the SPA does not consume it, since Chloe runs in Supabase.

Custom SMTP still needs a provider configuration and real delivery verification. Supabase's default email sender restricts delivery. The existing exact redirect allow-list includes the canonical/secondary Vercel `/account` and `/reset-password` routes, localhost:8081 callbacks and the `iwillbe://` native scheme. Add exact callbacks when introducing another domain. Magic-link entry, password fallback and reset are implemented; no six-digit code is promised.

`eas.json` contains development, preview and production profiles. Signed builds require the owner's Expo/Apple/Google credentials. Device lock uses Expo Local Authentication with the phone's biometric/device authentication; reminders use a rolling 14-day schedule, skip already completed rituals and link to the intended screen. Signed builds, Face ID, reminders and native cold-start links must be tested on real devices before distribution. On the web, sign-out removes the account cache; a retained guest backup still belongs to that browser.

## Verification

```sh
npm run check
npm run build
npm run test:browser
supabase db query --linked --file tests/rls.sql
supabase db query --linked --file tests/import.sql
supabase db query --linked --file tests/journey.sql
supabase db advisors --linked --type security --level warn
```

The domain tests cover timezone boundaries, import conflicts, separate energy/value signals, explicit star states, review deduplication and accepted why selection. SQL tests roll back all fixtures and check ownership, immutable reflected intentions, legacy/new imports, retries, anonymous denial and server-only functions.

The browser suite exercises the full guest discovery-to-reflection flow, exploration, why/telescope versions, monthly reflection, backlog, season, narrow screens, contextual auth and drafts. Auth tests mock email and failure cases. Screenshots/results are local in `test-results/`; use `UI_BASE_URL` and `UI_ARTIFACT_DIR` to test an export or deployment.

A separate live check verified real authentication, a displayed Chloe response, persisted messages and why, guest Comet acceptance, and private friend suggestions. No email was sent; the temporary account and session were removed afterward. Supabase advisors report no database security errors; leaked-password protection remains an Auth configuration warning. The current npm audit also reports upstream Expo-toolchain advisories; its suggested automatic fix downgrades Expo and was not applied. The app's direct UUID dependency was removed in favour of Expo Crypto.

`docs/plans/2026-10-19-refonte/requirements.json` preserves the requirements trace. `implementation.json` maps the delivery and remaining external activation work. `design-qa.md` records the visual check. Raw research PDF copies and local audit exports remain outside Git.
