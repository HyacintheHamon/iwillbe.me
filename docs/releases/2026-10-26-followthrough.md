# Chloe follow-through — 26 October 2026

## Release checkpoint

This note records the implementation and verification checkpoint **before publication**. It is not a production deployment receipt.

| Component            | Observed status at this checkpoint                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public app           | `https://iwillbe-me.vercel.app`; production still uses earlier `main` commit `09e8d0d`.                                                                                              |
| Candidate source     | Local branch `feat/chloe-complete-followthrough`, not yet pushed. GitHub and Vercel publication are being handled separately.                                                        |
| Frontend             | Integrated web export built and tested locally at `http://localhost:4173`.                                                                                                           |
| Revision migration   | `20261026230327_practice_revision_guards.sql` is prepared and frozen. Two application attempts timed out. A subsequent migration-history read confirmed it **has not been applied**. |
| Chloe function       | New prompt, onboarding synthesis and reflection/focus proposal contracts are implemented in source but **not deployed**.                                                             |
| Custom domains       | `iwillbe.me` and `www.iwillbe.me` are attached to the Vercel project and report `verified: true`; external DNS still serves Namecheap parking.                                       |
| SMTP                 | Provider setup and real email delivery remain unverified. The dashboard presented a sign-in wall; no outbound email was sent.                                                        |
| Supabase access      | Read operations through the connector work. No authenticated CLI session is available for the pending publication steps.                                                             |
| Devices and duration | Signed native builds, physical-phone behavior and timed human sessions have not been validated for this release.                                                                     |

## Implemented audit fixes

### A shorter first session with useful proposals

The first observation now shares the first story screen, and a detailed answer can receive one contextual follow-up. The person can keep only the original story or save the added detail. Interests, strengths, values and admired people are separate proposals supported by the person's own words. They require individual acceptance; an admired person's quality is not silently assigned as the user's strength. The why remains user-owned and is not rewritten by onboarding synthesis.

Guests receive conservative local proposals. A signed-in person can request a bounded AI synthesis explicitly. Failed requests retain the answers and local options; fabricated evidence and repeated questions are rejected. Corrected quick picks change only entries owned by that onboarding session, preserving pre-existing interests. Clock settings are optional after the morning and night anchors, rather than adding compulsory steps before the first commitment.

### Daily rituals that carry useful context forward

Morning can refer briefly to a real positive experience from the previous day. The why influences guidance through accepted evidence links; the person can also explicitly connect today's commitment to their why. An eligible Open Question can be carried through the day without demanding an immediate answer.

Night uses unified question eligibility, including nights without a morning commitment and All in practice. A deferred or stopped question is not asked again as a paraphrase. A carried question takes the optional discovery slot. A new possibility requires the person to name and keep it. Occasional night insights connect actual current and earlier choices and are omitted when the evidence is insufficient.

The existing one-question flow, “For me” answer, concrete context, explicit value decisions, fresh return after absence and short closing remain in place. Ritual dates follow the saved profile timezone. All in eligibility now measures time spent Into it rather than the age of an old Maybe.

### Chat proposals become real saved choices

Chloe can propose a reflection tied to today's intention, retaining source evidence for outcome, energy, value choice, replacement value and the person's words. Receiving a proposal does not save it. The person reviews or completes the fields, then explicitly saves; absent answers remain unknown. A pending proposal survives reload, and a failed or partially completed save can be retried without duplicating the check-in.

Sunday chat can propose a focus for the coming mornings. It remains pending until confirmation and cannot silently override a fixed area selected elsewhere. A real single question can be recovered from response text when the model omits its question field, allowing Skip/Open Questions to remain available without inventing wording. The visible reply keeps only its first question and one actionable card. Field evidence is checked in its full sentence for negation, timing and the actual target of the commitment; ambiguous answers remain open. New cards require an explicit client capability, preserving usable conversations in older open tabs during rollout.

These source changes require deployment of the updated `chloe` function before live model behavior can be checked.

### Sunday, future pictures and the living why

Sunday suggestions use the current week's lived experiences, including custom interests. Stale history, future commitments and untried actions do not count as positive weekly evidence. The person explicitly confirms the proposed weekly focus. Additional tools are collapsible so the main closing stays short.

One year out now presents an editable proposed area map. Nothing is saved merely by opening the sorting step; the person confirms the areas or keeps the picture without area guidance. Earlier versions are retained. A successful new save clears the completed map draft, while reaffirming the currently displayed picture preserves a separate unfinished edit.

The why revisit is guided: recent evidence, one question, an editable draft, a practical choice test, explicit acceptance, then one future view at a time. New versions retain their selected clues and newly saved reflection. Archives are available without dominating the first screen. Quarterly timing follows three calendar months and handles month ends; monthly future checks remain separate.

### Safer account persistence and retained drafts

The provider captures revision numbers and uses compare-and-swap writes for editable account records. A stale edit or delete presents both the saved version and the draft for an explicit decision. An identical retry can recognize a write that already succeeded; it does not silently treat a different draft as a successful retry. Foreground refresh preserves unfinished editors. Draft writes are ordered, and clearing an owner invalidates late callbacks that could otherwise restore discarded text.

The SQL migration adds revision columns and incrementing triggers to profiles, intentions, check-ins, memories and journey entries. It retains ownership rules and supports older clients. Older clients do not gain stale-edit protection unless they send revision predicates. **The new account persistence path depends on the pending migration.** Prepared SQL tests cover stale updates, stale deletes, legacy-client revision increments and owner isolation; they have not yet been run against the new live schema.

### Reminders with a usable web path

Native reminders now recur daily at phone-local morning and evening times and link to the appropriate ritual. The app reconciles settings and the phone timezone when it returns to the foreground. Delivery and travel behavior still need physical-device verification.

Settings on the web downloads two daily calendar events in the profile timezone, including daylight-saving information and links to the public app. The file contains no journal entries, stories or commitments. Imported reminders are managed in the calendar; there is no claim of browser background push, automatic updates to an already imported file, or cancellation after a check-in is completed. Calendar import and actual alert delivery still need human verification in the chosen calendar app.

## Verification recorded

All browser results below use the integrated **local export**, synthetic guest data or intercepted account/API responses. They are not live AI, SMTP or production-database tests.

| Check                                           | Result                                                              | Evidence                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------- |
| TypeScript                                      | Passed after provider and captured-revision integration.            | `npm run typecheck`                                  |
| Patch whitespace                                | Passed.                                                             | `git diff --check`                                   |
| Journey and guidance unit checks                | Passed; 17 journey and 7 guidance cases in the targeted run.        | `tests/journey.test.ts`, `tests/guidance.test.ts`    |
| General UI browser flow                         | Passed, 15 scenarios, no page errors.                               | `test-results/followthrough-ui/results.json`         |
| Targeted guidance browser flow                  | Passed, 8 scenarios, no page errors.                                | `test-results/followthrough-guidance/results.json`   |
| Onboarding browser flow                         | Passed, 7 scenarios, no page errors.                                | `test-results/followthrough-onboarding/results.json` |
| Chloe proposals and calendar browser flow       | Passed, 7 scenarios, no page errors.                                | `test-results/followthrough-chloe/results.json`      |
| Dedicated synchronization browser flow          | Passed, 8 scenarios, no page errors or unexpected endpoints.        | `test-results/sync/report.json`                      |
| Auth, import and selected-question browser flow | Passed, 14 grouped checks with strict revision-aware account mocks. | `test-results/followthrough-auth/auth-results.json`  |
| New revision SQL tests                          | Prepared; live execution pending migration.                         | `tests/revisions.sql`                                |

The general and targeted guidance checks include 320-pixel layouts, keyboard interaction with a reduced viewport, reload persistence, skipped and stopped questions, a changed profile date across timezones, explicit value replacement, source-linked whys and preserved future versions. The onboarding and Chloe checks exercise explicit consent, malformed evidence, request failure, pending proposals, partial-save retry and fixed-focus conflict behavior through mocked services.

The synchronization suite uses two independent browser devices against a shared synthetic account. A stale form keeps its original revision after foreground refresh; both conflict choices and a second edit during review are checked. Sign-out removes all account caches and drafts while retaining separate guest and other-account backups. Failed deletion retains the account data. Successful deletion is tested while a private Chloe reply is still pending on another mounted tab: the late reply cannot restore account drafts, add private entries to guest practice or perform follow-up writes. Account-bound queues and invalidated draft leases enforce that boundary. The auth regression also confirms that a selected Open Question and two separate drafts survive authentication/import without sending anything automatically.

One real bug was found during these checks: confirming a future area map left its completed wizard state in the draft, so the next “Tweak it” opened the old sorting step. The successful-save cleanup was corrected and both new edits and hidden-draft reaffirmation were verified afterwards.

### Reproduce the local checks

```sh
npm run check
npm run build
```

Start `npm run preview` separately, then:

```sh
UI_BASE_URL=http://localhost:4173 npm run test:browser
UI_BASE_URL=http://localhost:4173 node scripts/verify-guidance.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-onboarding.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-chloe.mjs
UI_BASE_URL=http://localhost:4173 node scripts/verify-sync.mjs
```

The recorded run used an existing Chrome installation selected with `PLAYWRIGHT_EXECUTABLE_PATH`; each suite can write a separate folder with `UI_ARTIFACT_DIR`. Results and screenshots are local test artifacts, not committed personal data. Historical reports in other folders describe earlier revisions and must not be reused as evidence for this candidate.

## Remaining publication and owner steps

### Database and Chloe deployment

An operator with authenticated access to Supabase project `mvhqovdznrzoduntyryh` needs to confirm migration history, apply the frozen revision migration, and verify the new columns, triggers and transactional checks. The two timed-out attempts are not a successful deployment. Recheck history before another attempt so a late result is not assumed either way. Do not edit the frozen migration to disguise an uncertain application result.

Deploy the updated `chloe` function and verify the new onboarding, night-reflection and weekly-focus contracts with real authenticated requests. Function source availability, connector read access and successful mocked browser responses do not prove that the endpoint is live. The exact deployed frontend commit, function deployment and migration result should be added to a subsequent publication entry.

### GitHub and Vercel

Publish the reviewed branch and deploy the matching verified frontend only after its database dependency is ready. Confirm the Vercel project `snag-live/iwillbe-me`; a Git push alone must not be assumed to publish a deployment. Record the resulting commit and deployment URL, then verify the actual public build at `https://iwillbe-me.vercel.app`, including account persistence and the real Chloe endpoint. The current public release remains `09e8d0d` at this checkpoint.

### Website DNS

The domains are attached and report verified in Vercel, but the external Namecheap DNS account is not accessible in this working session. An owner with access to the authoritative zone needs to replace the conflicting website parking records with the values returned by Vercel's domain configuration:

| Host  | Type    | Required value                        |
| ----- | ------- | ------------------------------------- |
| `@`   | `A`     | `216.150.1.1`                         |
| `@`   | `A`     | `216.150.16.1`                        |
| `www` | `CNAME` | `273a6ef44d6d4b67.vercel-dns-016.com` |

The two apex addresses are the rank-one values reported for this project. Keep existing email records, including MX and the relevant SPF, DKIM and DMARC TXT records, and preserve unrelated records. No email DNS values are invented here. Vercel already has a **308 project redirect from `www.iwillbe.me` to `iwillbe.me`**; that redirect is separate from the DNS records. After the zone change propagates, verify DNS, HTTPS and the redirect against the actual deployed app.

### Email

An owner must sign into the Supabase dashboard, configure the selected SMTP provider with its actual verified sender and credentials, then test real sign-in and reset delivery using an authorized mailbox. No provider credentials, sender identity or test recipient were supplied or fabricated, and no email was sent during this work. Review exact authentication callback URLs when bringing the custom domain into service; preserve the existing working Vercel callbacks during the transition.

### Physical devices and human sessions

Build and install signed iOS and Android versions with the owner's platform credentials. Verify notification permission, recurring delivery, timezone changes, biometric/device lock and cold-start links on actual phones. Import the web calendar into the intended calendar app and confirm reminder behavior. Finally, time real first sessions, daily check-ins, Sunday Explore and why revisits against the intended approximately 5/2/10/15-minute experience. Automated tests establish behavior and persistence; they do not establish these human durations.
