# iwillbe.me

A small daily practice for becoming a little more yourself. Expo / React Native app for iOS, Android, and a browser preview, with an optional Supabase account and Chloe, an AI guide.

## Included in this MVP

- Three-step onboarding: values, a personal north star, and interests.
- A morning intention, explicit confirmation, and an evening reflection.
- An interactive galaxy that grows from reported real-world actions. Planning, chatting, and opening the app never add progress. No streak penalties.
- Local practice without an account. Email/password accounts have separate cloud-backed practice.
- Chloe conversation interface, server-side context, proposed intentions, and memories saved only after confirmation.
- Preferences, local device reminders, memory management, full JSON export, sign-out and account deletion.
- Generated paper-and-ceramic illustrations, Fraunces + DM Sans, navy/ivory/gold palette, and consistent Phosphor tab icons.

The conversation endpoint is deployed, but **Chloe needs an `ANTHROPIC_API_KEY` configured on Supabase before it can reply**. Email redirects and signed mobile builds also need the owner configuration below. This is a development MVP, not an App Store release.

## Run

Use Node 22 or 24 and npm.

```sh
npm ci
cp .env.example .env.local
npm start
```

Use `npm run web` for the browser, `npm run ios` / `npm run android` with a simulator, or open the development server from an SDK-compatible Expo app. A native development build is needed to fully validate notification and deep-link behavior. `npm run dev -- --port 4173` starts the shared browser preview.

The included Supabase URL and publishable key are public client configuration. They grant no anonymous journal access. Never put a service-role or Anthropic key in `EXPO_PUBLIC_*` variables.

## Owner configuration still needed

### 1. Activate Chloe

In the Supabase project `mvhqovdznrzoduntyryh`, add an Edge Function secret named `ANTHROPIC_API_KEY`. Optionally set `ANTHROPIC_MODEL` to another Claude model that supports structured JSON output; the current default is `claude-sonnet-5-5`. Keep secrets out of the app, repository, and chat.

The deployed `chloe` function authenticates the user through Supabase Auth, reads only that user's context, reserves a limit of 30 requests per hour, calls Anthropic, validates the response, and saves the conversation. It returns one complete reply; streaming, voice, embeddings, and autonomous actions are outside this version.

### 2. Configure email authentication

In Supabase Authentication → URL Configuration, set the final web app URL and allow these exact callback URLs for the environments being used:

```text
iwillbe://account
iwillbe://reset-password
http://localhost:8081/account
http://localhost:8081/reset-password
```

Add the deployed web origin's `/account` and `/reset-password` routes before testing web email links. The temporary Work preview uses `http://terminal.local:4173`; its callbacks need explicit allow-list entries if used for email testing. Never add a broad wildcard for unrelated origins. Configure a production email provider before opening the beta to arbitrary addresses; the default Supabase email service has restrictions.

Account confirmation and password-reset routes are implemented. Their email delivery and native deep links have not been tested with a real account in this environment. Guest notes deliberately remain separate when signing in; there is no automatic migration of local notes into a cloud account.

### 3. Build for a phone

An Expo account/organization is required to link the project and create signed builds. Apple Developer access is needed for iOS distribution.

```sh
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile preview --platform ios
```

`eas.json` includes development, preview, and production profiles. The bundle identifier is `me.iwillbe.app`. Test notifications, keyboard behavior, cold-start email links, background/foreground transitions, and account deletion on real devices before distribution. No signed native binary has been built here.

## Backend

The SQL migrations have been applied to the connected project, and the `chloe` Edge Function is deployed with JWT verification enabled. For another environment:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy chloe
```

Tables: `profiles`, `intentions`, `check_ins`, `memories`, `messages`, and `ai_usage`. Row Level Security is enabled on every table. Clients cannot create assistant messages or change quota counters. A composite foreign key prevents a reflection from pointing to another user's intention. An intention cannot change meaning after a reflection is saved. Deleting an account cascades to its practice rows.

`ai_usage` intentionally has no client policies and is service-only. This produces an informational [RLS-enabled/no-policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). New indexes may also be reported as [unused](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) until traffic exists. Review [Auth connection allocation](https://supabase.com/docs/guides/deployment/going-into-prod) when resizing the database. The missing composite foreign-key index reported during development was added in the second migration.

## Data behavior

Guest practice is stored in app storage on that device/browser. Account writes require a working connection and are committed to the UI only after Supabase succeeds. Cached account practice can be read offline; there is no offline write queue or multi-device conflict resolution in this MVP. Signing out removes the previous account's practice cache. Authentication sessions use the Supabase React Native storage pattern. Device storage is not a separately encrypted journal vault.

Chloe receives the saved profile, up to seven recent intentions and reflections, eight explicitly confirmed memory notes, and twelve recent messages. Removing a memory removes that note from future prompts; a corresponding fact can still exist in recent conversation history. Export retrieves all owned conversation rows, not only the recent messages displayed on screen.

## Verification

```sh
npm run check
npm run build
npx expo export --platform all
```

`tests/domain.test.ts` covers action-based progress and local calendar-day boundaries. `tests/rls.sql` is a transactional integration check for ownership, cross-user writes, reflection integrity, forged messages, anonymous access, and server-only quotas; it rolls back its temporary rows. It was run successfully against the connected project. The browser flow and visual comparison are recorded in `design-qa.md`.

AI responses, live email authentication, signed mobile binaries, and device reminders remain unverified until the owner configuration above is completed.

## Source map

`app/` contains Expo Router screens. `src/` contains shared UI, domain rules, account/local persistence, reminders, and export. `assets/` contains the generated artwork. `supabase/` contains the schema and Edge Function. `docs/design/` holds the accepted visual target and implementation evidence.
