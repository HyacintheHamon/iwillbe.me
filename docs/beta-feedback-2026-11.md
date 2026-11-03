# November beta update

This change addresses the post-sign-up feedback: users could see interests but could not turn them into something concrete to do. My map now leads directly from an interest or priority to three action sizes, a time, a beneficiary and an explicit save on Today.

## Included

- Inter typography, off-white/black/orange palette, `be.` icon and short app name. Navigation: Today, My map, Me; Ask Chloe remains available from Today. Why is always visible and opens its editor.
- Fifteen typographic interest picks and four reactions. Ten important priorities, then three to work on, from the supplied 38 words; optional private faith tradition; explicit consent before keeping a proposed priority. Existing stories and why work remain.
- A conversational morning with an explicit area choice, mission cards, own-action entry, alternatives for Meaning To, when, optional beneficiary and final awaited save. Drafts survive failed saves. Save pulse and Today reveal respect reduced motion.
- Word-based map, explicit stage controls, pause/remove, current mission ladder, replacement confirmation and private generated ideas for interests without catalogue matches. A completed linked mission advances its ladder; it does not automatically change the interest stage.
- Full supplied master prompt plus runtime contracts. Night thoughts use a verified shortlist and seven recent thoughts; rendering keeps catalogue quotes and credits intact. Priorities, faith opt-in, 180-day exclusions, lifetime once-only exclusions and consecutive authors are checked before selection. Model classification supplements conservative distress fallback; held sessions do not receive missions or a night thought until the next check-in.
- Branded confirmation and magic-link email templates. Beta coach invitations and the local-import page are removed from the visible flow. Existing local backups remain intact.

## Data and compatibility

Migration `20261103153554_beta_action_library.sql` is additive. Existing journey IDs, revision checks, reflections and account ownership remain canonical. `priorities` and `user_interests` are security-invoker **views** over that data, rather than a second mutable copy. Old `value`/`strength` storage names remain internal for compatibility; the UI presents priorities. New catalogues and per-user history have explicit grants and row-level security. Private generated missions, faith tradition and history are deleted with the account.

The supplied night-thought PDF contains 209 entries. All are retained with source links and verification notes; 200 are eligible. Nine entries marked “Verified with caveat” are held as `needs_check` (50, 69, 73, 90, 96, 97, 105, 114, 142). “Verified with correction” entries remain eligible. The import preserves the source's verification claims; this implementation does not independently reverify every citation.

The 692-mission spreadsheet was not available among the supplied files or accessible project documents. The migration therefore includes **159 original starter missions**, covering the 15 interests and 38 priorities at step 1. These are not presented as Kelly's library. Later steps and custom interests use private Chloe suggestions. Importing Kelly's sheet gives those rows precedence over starters without a client release.

## Import the complete mission library

Export the sheet as UTF-8 CSV (or an array of JSON records). The importer accepts the supplied column names, including `Quick picks`, `Priorities` and `Who it's for`. List fields use semicolons. It validates every row before submitting a single transactional upsert, retains private missions and history, and updates matching IDs on re-import.

```sh
npm run missions:import -- missions.csv
npm run missions:import -- missions.csv --output validated-missions.json
# With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY provided securely in the environment:
npm run missions:import -- missions.csv --apply
```

Do not commit service-role keys or generated personal content.

## Release sequence and remaining checks

1. Done on 3 November 2026: the additive migration is applied to `mvhqovdznrzoduntyryh` (iwillbe.me), version `20261103153554`. The filename matches the server-assigned history version; the SQL is unchanged from the reviewed candidate.
2. Deploy `chloe` after the migration; retain the existing Anthropic secret/model configuration.
3. Publish the matching frontend build. The client needs the new catalogue RPC and commitment columns.
4. Apply the email templates and configure a verified custom SMTP sender named `iwillbe.me`. Templates alone cannot change the hosted Supabase sender. No SMTP credential or verified sending domain was supplied.
5. Import the 692-row sheet when available. Test real sign-in, a complete onboarding, map → action → Today, night completion and custom-interest AI generation on Android Chrome and iOS Safari.

The database migration is applied. Live checks confirm 159 missions, 38 priorities, 15 quick picks and 209 night thoughts (200 eligible), RLS on all new tables and security-invoker views. Existing profile, intention, reflection, message and journey row counts are unchanged. Authenticated-role read/privilege checks pass. Security advisors report no new findings. The pre-existing leaked-password-protection warning remains; see [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The two existing server-only tables without client policies retain their deliberate denial of client access.

The owner authorized direct pushes to `main` for this repository. Function deployment, SMTP setup and frontend publication are separate from this database/code update and have not been performed.

## Verification

- `npm run check`: TypeScript, ESLint and 125 unit tests.
- `npm run test:database`: all nine migrations in a clean embedded PostgreSQL engine; catalogue counts, owner isolation, mission ownership, history write protection, profile privacy, retry-safe quick picks and deletion cascade. This is a SQL/RLS check, not a replacement for hosted Supabase integration tests.
- `npx deno check supabase/functions/chloe/index.ts`: Edge function type check.
- `npm run build`: Expo web export.

The managed browser preview returned the document shell but stayed blank, with no app UI to exercise. Browser and live Anthropic/SMTP checks remain unverified. `npm run test:browser` now targets the new entry, priorities and action flow using fully intercepted backend fixtures, including a failed-save retry and 320/390px screenshots; it has not been executed here. Previous journey scripts are retained as `test:browser:legacy`. Run the new suite and live device checks against a dedicated test deployment before release.
