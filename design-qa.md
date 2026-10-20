# Design QA — concept-brief refactor, 0.2.0

**final result: passed**

This pass covers the compiled web beta and the interactions below. It does not certify signed native builds, physical-device biometrics, notification delivery, real email delivery, or research acceptance by end users.

## Evidence and normalization

- Source: `iwillbe-me-concept-brief.pdf`, pages 8 and 10. Local rendered sources are `docs/audit/2026-10-19-concept/pdf/page-08.png` and `page-10.png`, 1100 × 1423 px. Raw source copies are intentionally excluded from Git.
- Browser-rendered implementation: `docs/design/redesign-galaxy.png`, `redesign-reflection.png`, and `redesign-telescope.png`. Captured from the production export at `http://localhost:4173`, Chrome, 390 × 844 CSS px, device scale 1.
- Combined source/implementation inputs: `test-results/release/comparisons/galaxy.png`, `reflection.png`, and `telescope.png`, each 820 × 890 px. Each combined image was opened and inspected after the final capture.
- Source app crops: galaxy `(118,113,274,591)`, reflection `(708,113,274,591)`, telescope `(555,102,435,944)`. Crops are normalized to 390 px width, preserving aspect ratio, inside an 844 px-high region. The galaxy/reflection crop is about three pixels shorter after normalization. Device surrounds and PDF annotations are excluded.
- States: galaxy with an accepted why and two selected interests; a reflection with completion, energy and value selected; telescope with a saved one-year vision. The reference contains illustrative activities and a fuller history. The implementation uses fictional test data and does not fabricate extra history to fill the image.
- Additional captures: `test-results/release/home-320.png`, `home-390.png`, `small-settings.png`, `spark-sort.png`, `commitment.png`, `explorer.png`, `why.png`, `rhythms.png`, `connections.png`, and `desktop.png` (1440 × 900).
- Full-view comparison was sufficient to assess the typography, map, lens and persistent controls at native capture resolution; no separate magnified region was needed.

## Findings and correction history

1. **P2 — image intrinsic dimensions distorted the galaxy.** Earlier renders used an image background that retained an oversized intrinsic height. The rendered map and glow pushed content away from the intended mobile composition. Replaced it with an explicitly sized image and container, bounded the map height to 300 px, and recaptured the final galaxy.
2. **P2 — primary galaxy action was below the fold.** Moved “Try one today” into the persistent footer. The final combined capture shows the action above the three-tab navigation. Secondary content remains scrollable.
3. **P2 — telescope lacked the circular visual focus of the brief.** Added a circular image-backed lens around the saved vision and retained visible reaffirm/change actions in the footer. The final telescope comparison confirms the lens, near/far choices and actions.
4. **P2 — web keyboard focus could be overridden by inline styles.** Added an explicit focus-visible outline in the export shell. A browser keyboard check verifies a solid 2 px outline; the reflection capture also shows the active field boundary.
5. **Test synchronization correction.** The compiled navigation changes screens faster than the development server. The browser regression now waits for the onboarding heading before clicking its similarly named action. The full compiled-export regression then passed.

The final combined comparisons contain no remaining actionable P0/P1/P2 visual findings in these tested states.

## Fidelity decisions

- **Typography:** retained the established bundled Fraunces/DM Sans family, using serif display headings and clear sans-serif controls. This is the implemented design direction, rather than a claim to reproduce every raster letterform.
- **Palette:** midnight background, indigo surfaces, warm gold primary actions, pale text and quieter secondary labels follow the brief.
- **Assets:** generated cosmic imagery and five domain illustrations are real compressed raster assets. Phosphor supplies consistent interactive icons. Galaxy nodes represent user data and have a complete accessible list.
- **Layout:** the app remains a narrow, centred mobile surface on desktop. Persistent footers preserve primary actions; scroll areas accommodate editable production content and smaller viewports. Layer chips scroll horizontally.
- **Content:** retained separate completion, energy and value questions. The reference's predicted star growth is omitted until sufficient explicit evidence exists. Two selected interests remain two stars. Telescope planet notes appear only when supplied. Extra production navigation, explanatory text and empty states are intentional.
- **Motion:** no required animated interaction; the export respects reduced motion.

## Interaction and technical verification

- Guest discovery: start, sort, undo, reload/resume, optional stories/baseline, why and galaxy.
- Practice: planet/value selection, intention context, explicit save, completion/energy/value reflection and persistence.
- Exploration and identity: save a Spark, explicit Craft choice, why versions, telescope versions/reaffirmation, monthly reflection, backlog release, season choice and dated shared moments.
- Authentication: contextual return, draft retention, explicit import consent, retry, conflict preservation and account-cache clearing. This suite uses mocked email/auth responses.
- Real backend verification separately exercised an authentication callback, a displayed Chloe response, owned message/why persistence, guest Comet saving and private friend suggestions with a temporary account. No email was sent, and fixtures were deleted.
- Compiled browser suite passed with zero application page errors. Responsive checks cover 320 px and 390 px widths; desktop has no horizontal overflow. Keyboard focus and manifest icon responses passed.
- TypeScript, ESLint, ten domain tests, transactional SQL checks and web/iOS/Android exports passed.

## Follow-up polish and external checks

- P3: tune star density and spacing after observing larger real galaxies; keep the list as the complete representation.
- P3: validate the retained typography and explanatory copy with beta users.
- Physical-device font scaling, signed builds, biometrics, reminders and native links still require device testing.
- SMTP delivery, paid billing and sponsor provisioning remain explicit external activation work in `README.md` and the implementation trace.
