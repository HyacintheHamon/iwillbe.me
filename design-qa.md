# Design QA — iwillbe.me MVP

**final result: passed**

This result covers visual fidelity and the verified guest practice. It does not certify signed native builds, live email authentication, or Claude responses; those configuration-dependent checks remain open in README.md.

## Evidence

- Source visual truth: `docs/design/approved-reference.png`, 853 × 1844 px.
- First browser implementation: `docs/design/home-before.jpg`, 480 × 936 px.
- Revised browser implementation: `docs/design/home-final.jpg`, 430 × 936 px.
- Full-view comparisons: `docs/design/comparison-before.jpg` and `docs/design/comparison-final.jpg`.
- Focused typography comparison: `docs/design/typography-comparison.jpg`.
- Additional rendered states: `docs/design/reflection-final.jpg`, `docs/design/galaxy-final.jpg`.
- Browser viewport: 1363 × 936 CSS px. App viewport: 430 × 936 CSS px, captured at 1 image pixel per CSS pixel. The app is cropped from the centered browser viewport, without browser chrome or a simulated device frame.
- Normalization: the source was downsampled to 430 × 930 px for the final comparison; its six-pixel height difference is recorded, not treated as a layout defect. Source and implementation were composed into one side-by-side input and visually inspected together.
- State: light theme, guest, no intention yet. The reference is a first-visit state; the final capture has an already-onboarded guest with no intention, whose visible home state is identical. Settings access is an intentional functional addition.

## Findings and iterations

1. Initial comparison: **blocked**.
   - [P2] The 480px implementation canvas was wider relative to its height than the reference, weakening the mobile composition. Fixed by using a 430px web maximum while keeping native/full-small-screen width responsive.
   - [P2] The main headline was too small relative to the source. Increased the homepage display size from 44/49 to 52/55px and kept the intended two-line wrap.
   - [P2] Hero scale and background transition made the illustration read as a separate rectangle. Matched the paper token to the illustration's warm ivory edge, increased the hero region, and used a controlled cover crop.
   - [P2] Supporting text and the primary action needed more presence. Increased subtitle, Chloe helper, and button typography. Removed an unnecessary additional section from the no-intention state.
2. Revised comparison: **passed**. The final full-view and focused comparisons were opened after the changes. The headline, primary action, illustration, and persistent navigation are legible and visible. No actionable P0/P1/P2 visual findings remain in the compared state.

## Required fidelity surfaces

- **Typography:** Fraunces provides the soft high-contrast display character and DM Sans the supporting UI. The headline retains the same wording and two-line hierarchy. The generated target has no deterministic font specification; small letterform differences are an accepted implementation choice. Fonts load from bundled files rather than a live font CDN.
- **Spacing:** the revised viewport restores the intended mobile proportions. The hero and primary action occupy comparable regions. The navigation is fixed outside the scrolling content. System safe areas are supplied by the native platform, not baked into the artwork.
- **Colors:** warm ivory, deep navy, ochre gold, muted blue, and clay follow the reference. The uniform UI paper surface is intentionally flatter than the raster mock's texture. Text and controls remain separate native UI elements.
- **Images:** the standalone generated illustration preserves the bowl, paper note, coffee, sprig, stones, gold star, and orbital composition. It is a newly generated asset rather than an exact crop of the mock; the blank note and slight arrangement differences are accepted to keep illustration text out of the asset. Other ritual illustrations follow the same material and lighting direction. No raster artwork was replaced by hand-drawn code approximations. The galaxy itself is an interactive data visualization.
- **Copy:** the home headline, subtitle, Chloe helper and main CTA match the approved direction. Other screens use concise English, explicit confirmation, and non-punitive reflection language. Literal backslash-newline strings found in development were corrected.
- **Icons:** one Phosphor family, light strokes, navy inactive and gold selected states. Sun / constellation graph / speech bubble reflect the selected version-2 navigation direction. The exact graph silhouette differs slightly from the image-generated constellation; accepted standard-library equivalent.

## Interaction verification

Verified in the browser using fictional guest data:

- Start → three-step onboarding → values/interests/north-star saved.
- Choose an inspiration → review intention → explicit confirmation → today's card.
- Galaxy shows zero steps after planning alone.
- Evening reflection with “A little” → confirmation → one step on the correct value.
- Reload → the intention, reflection and galaxy count remain present.
- Open a galaxy value → correct action history and suggestions.
- Chloe guest state → clear account requirement and a route to self-guided practice.
- Add a memory explicitly → confirmation and saved note.
- Export → downloaded JSON contains the saved intention, reflection and memory.
- Settings correctly disables native reminders on web.

Runtime defects caught and fixed during development: a stale/invalid icon import bundle, UUID generation on the HTTP development origin, and raw newline text in titles. The final browser route sequence rendered without app error overlays. Console review found browser-extension metadata errors; these are outside the application. Native keyboard, notification permission and email-link behavior require device verification.

## Implementation checklist

- [x] Compare source and actual browser output together.
- [x] Fix P2 typography, proportions and hero presentation; recapture.
- [x] Inspect focused typography and persistent navigation.
- [x] Verify the core guest loop and persistence.
- [x] Verify explicit memory save and JSON export.
- [x] Pass TypeScript, lint, domain tests and web/iOS/Android bundle export.
- [x] Run transactional Supabase ownership/quota checks.
- [ ] Owner adds Anthropic secret and tests a real authenticated conversation.
- [ ] Owner configures allowed email redirects and tests email confirmation/reset.
- [ ] Link Expo, build and test on physical iOS/Android devices.

## Follow-up polish

- [P3] Consider richer star transitions after the first device beta.
- [P3] A subtle paper texture across UI surfaces could move even closer to the raster concept.
- Small-device and large accessibility-font visual checks remain part of the native beta acceptance pass.
