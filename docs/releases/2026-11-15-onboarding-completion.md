# Onboarding completion hotfix

The Round 2 onboarding requires ten priorities, but `profiles_values_check` still limited the profile's values array to eight. Both **Go to Today** and **Skip** on the baseline screen therefore failed with SQLSTATE `23514`. The app rendered that database error as a generic message mentioning a saved item and a draft.

The migration raises this existing limit to ten. It does not truncate priorities, rewrite answers, complete anyone's onboarding automatically, or change ownership policies and revision checks. The current frontend can retry the same save after the migration; no web or native update is needed.

`tests/onboarding-completion.sql` exercises the real profile write as an authenticated owner. It covers ten priorities, answered and skipped baseline questions, preservation of an earlier onboarding answer, rejection of eleven priorities, stale revisions and cross-account isolation. All test fixtures are rolled back. The test reproduced `profiles_values_check` / `23514` before the fix and is included in `npm run test:database`.

Applied to production project `mvhqovdznrzoduntyryh` as migration `20261115211852`. The same transactional authenticated-owner test passed against the hosted database after the migration. Security advisors reported no new findings.
