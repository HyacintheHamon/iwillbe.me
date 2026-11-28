# One-minute onboarding and mission library v2

## Purpose

Implement the November 26 onboarding developer pack, the accompanying mission
library v2 workbook, and the Today typography correction. The current long
onboarding becomes a welcome screen and four short steps; later discovery moves
to the first nights and first two Sunday reviews.

## User-visible behavior

- The account screen shows the AI disclosure before signup.
- Welcome uses the supplied copy. Progress starts at step 1 of 4 after Welcome.
- A new person chooses exactly seven of 39 priorities, without preselection.
  They begin as Working on. The faith question is inline when relevant.
- Interests and people are optional. Interests begin as Want to try. Selecting
  my kids offers under 6, 6–12, teens, and adults, without requiring an answer.
- My why requires at least three words and is saved as a first draft.
- Chloe introduces herself on the first visible Today visit, then explains the
  evening check-in after the first focus is saved.
- Today restores orange on the word “today”; “I will” is 28 px.
- The first completed night offers morning/night time pickers, initially 08:00
  and 21:00. Native builds use scheduled notifications; web exports a calendar
  file that the person must import. The following night asks about places.
- During the first 14 days, a relevant onboarding interest can trigger one
  question about its place in the person's life. A reserved question cannot
  reveal another question that same night, including after a reload.
- Unanswered follow-ups stay reachable in Open Questions, including when the
  person leaves the screen without choosing Skip. Answering closes that entry.
- The first Sunday actually visited asks the three existing baseline questions,
  then childhood interests and strengths. The second asks about helping others
  and desired growth. Missed Sundays do not discard the initial baseline.
- After about five explicit Keep it decisions, a priority can be offered as
  Important to me. Promotion always requires the person's decision. The old
  automatic promotion after two keeps has been removed.

## Catalogue and personalization

The complete curated library contains 1,284 missions, 59 books, and 44 interest
links. It preserves the prior 1,257 mission IDs and adds 27 missions: 15 Joy,
three Learn entries related to joy, and nine adult-children missions. Twenty-four
existing missions gain the joyful priority tag. The priority list contains 39
words.

Client and server both enforce the adults-only family rule. Families with only
adult children do not receive untagged kid missions, which were written for
younger children. Mixed ages retain the broader compatible set.

Fresh recommendations exclude a mission family for 28 local days after it was
shown, picked, or explicitly passed. Explicit requests to repeat a focus, saved
reminders, and alternative sizes remain available. The family displayed on a
screen stays stable while its impression is saved. Energy and explicit passes
influence bounded, decaying preferences; energy is independent of completion.
See `data/round5/README.md` for the exact scoring assumptions and source checks.

Monthly metrics are internal. Aggregation requires explicit current analytics
consent, excludes private mission identifiers and personal text, and is exposed
only to the service role. Personal recommendations can still use the person's
own private feedback when aggregate analytics is off.

## Database and service changes

1. `20261128013101_round5_mission_catalogue.sql` performs a non-destructive
   catalogue upsert, adds joyful, and permits the adults age label. It cancels
   the entire import if a curated ID collides with a private mission.
2. `20261128013107_mission_recommendation_metrics.sql` provides the restricted
   monthly aggregate RPC. Its public wrapper is a security invoker; its private
   implementation checks the SQL role as well as function grants.
3. The Chloe function contains the current supplied master prompt, explicit
   onboarding timing rules, Sunday scheduling, and server-side recommendation
   history/age filtering.

The application uses the existing entry schema for follow-up reservations and
open questions. Existing accounts do not receive a new-user onboarding schedule.
Existing priority states and private missions are preserved.

## Review and release

The production build remains `npm run build`. The isolated QA build is a
separate opt-in script, `node scripts/build-onboarding-fixture.mjs`, after the
web build. Its fictional transport and strict content security policy prevent
calls to live Supabase or AI. It must never be promoted to production.

Release the catalogue migrations, the Chloe function, and the normal app build
as one coordinated release after review. A preview of the isolated fixture
validates interface behavior, not real email delivery, AI responses, native
notification permissions, or live migration execution.

## Validation commands

```sh
npm run check
npm run build
node scripts/verify-round5-catalogue.mjs
node scripts/build-onboarding-fixture.mjs
git diff --check
```

Automated coverage includes exact priority counts, optional interest/people
steps, mandatory why, stable onboarding save IDs, follow-up reservations,
Sunday scheduling, explicit priority promotion, adults-only filtering,
recommendation cooldown/scoring, and database import/metrics permissions.
