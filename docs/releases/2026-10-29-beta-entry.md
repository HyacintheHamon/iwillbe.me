# Neutral introduction and account-first beta entry

Visitors now see four swipeable introduction panels before any personal questions. “Join the beta” remains visible on every panel and opens account creation with a short privacy note. Existing members have a separate sign-in action. On authentication, a new member continues to discovery and an onboarded member returns to their practice.

The design uses ivory, charcoal and muted green. The star artwork and Chloe star mark have been removed from active screens. Possibilities are ordinary cards: Maybe uses a dashed border, Tried it a white surface, Into it a dark surface, and On pause remains visible. Existing route names and stored enums remain compatible. The app icons and web theme match the neutral design.

The four panels condense the supplied October 28 landing PDF: the daily promise, morning-to-night practice, possibilities with a living why, and the steps after joining. The user explicitly requested three or four panels, so the seven-panel reference was condensed. Google sign-in, a first-50 quota and waitlist were not advertised because they are not implemented. The October 28 master document was used for user-facing vocabulary; this change does not import the night-thought library or replace the server prompt.

## Verification

- TypeScript, lint, 116 unit tests, and production web export pass.
- Cloud-browser inspection covered the four-panel introduction, account CTA, privacy route, mobile layouts at 320 and 390 pixels, and direct onboarding access redirecting to account creation without questions.
- New `npm run test:entry` covers the public boundary without sending email. The auth regression was updated for account-first access and preserves selected-question/draft-import assertions. These Playwright scripts were not executed in this environment; browser checks used the supported cloud browser.
- UI, guidance and onboarding browser fixtures now use an intercepted synthetic account instead of starting personal questions as a guest. The dedicated auth and synchronization fixtures retain their separate servers. The full browser suite was not rerun; no full-suite pass is claimed.
- Real sign-in email delivery, authenticated first-session saves and native-device swipe behavior remain unverified.

## Database deployment — 29 October 2026

The user authorized applying the migrations and publishing this release. Supabase project `mvhqovdznrzoduntyryh` successfully applied `practice_revision_guards` as version `20261029154648`. The SQL is byte-for-byte identical to the frozen `20261026230327` candidate. The repository filename is aligned with the recorded server version so a subsequent migration push does not try to add the columns again.

Verification confirmed all five non-null integer revision columns, their defaults and update triggers. `tests/revisions.sql` passed against the live database: stale edits/deletes are rejected, legacy updates increment revisions, and cross-owner access remains denied. `tests/rls.sql` and `tests/import.sql` also passed, including reflected-intention integrity and atomic guest import. All three tests roll back their fixtures; a follow-up query after the revision checks confirmed zero fixture users or profiles remain. The migration history contains all eight repository migrations.

Security advisors are unchanged: the two intentionally service-only tables have RLS without client policies. The existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is still disabled. This release does not change Auth configuration.

Chloe v8 and connections v3 are active. Their deployment predates this frontend release; no new server prompt or night library is deployed here.

## Publication and remaining verification

PR #3 includes the follow-through work from PR #2 and the neutral introduction. The publication receipt in PR #3 records the exact production source and deployment after Vercel finishes its production build.

The canonical web origin is `https://iwillbe-me.vercel.app`. Vercel's domain check on 29 October still reports `iwillbe.me` misconfigured: its authoritative Namecheap DNS resolves to `192.64.119.208`, rather than Vercel's recommended records documented in the earlier release note. The custom domain is not the verified public app origin.

Real sign-in/reset email delivery, callbacks, authenticated first-session saves and live Chloe replies remain unverified. Publication does not establish that new outside testers can complete the full email-based journey. No test email was sent.
