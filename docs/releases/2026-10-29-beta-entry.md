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

## Release dependency

This branch is based on `feat/chloe-complete-followthrough` (PR #2), preserving that work. Migration history was read on October 29: `20261026230327_practice_revision_guards.sql` is still absent. The frontend's account write path requires it. This task does not apply that existing migration, change SMTP, publish to production, or change domain DNS.

The Vercel preview is for reviewing the new interface. Do not describe it as ready for a real beta until the migration, email delivery and sign-in callbacks have been verified with the final origin.
