# Avatar motion prototype — option 3

final result: passed

Scope: isolated `/proposals/avatars.html` study, not a replacement for production avatars. One forest outfit, four cardinal views (left mirrors right), four whole-body walking poses per direction with shared timing, idle and seated poses. Eight-direction art and the other outfits remain outside this first approval preview. The chronological corrections below record superseded attempts; the final whole-body correction is the current implementation.

## Evidence

- Source visual truth: `public/proposals/avatar-reference.png` (1536×1024), selected “Pixel con volumen” concept sheet.
- Browser implementation: `/tmp/avatar-preview-front.png` (1280×900), `/tmp/avatar-preview-seated.png` (1280×900), `/tmp/avatar-preview-mobile.png` (390×1263 full page; viewport 390×844).
- Full-view and enlarged character comparison: `/tmp/avatar-preview-comparison.png` (1600×1100), source and browser capture together. Source concept sheet and functional study have intentionally different controls and content counts. The enlarged source character walks; the implementation detail is paused. Compare palette, proportions and detail here, not contact timing.
- Density: browser device scale factor 1. Full views normalized to 790 CSS pixels wide in comparison; character crops enlarged independently for art inspection. No pixel-exact layout equivalence is claimed for a concept sheet versus a working control page.
- Existing office raster assets are reused through `createOfficeArt`. New transparent atlas generated from the selected reference; its uneven cells are measured and grounded at runtime. Source atlas is 1254×1254.

## Findings and comparison history

1. P2: detail canvas initially used a fixed height at narrow widths, stretching the avatar. Fixed with the canvas's intrinsic aspect ratio; final mobile screenshot shows circular camera framing and unchanged body proportions.
2. P2: initial desktop detail was too small for inspection. Increased detail magnification from 3.1 to 4.5 while retaining scene scale. Final desktop screenshot shows readable folds, hands and boots.
3. P2: stopping the camera left an “activated” status. Updated the status when tracks stop. Browser check verifies activation and deactivation using a synthetic camera.

No remaining actionable P0/P1/P2 findings within this study's scope.

## Required fidelity surfaces

- Typography: Georgia display titles reproduce the reference's serif hierarchy; native sans-serif controls remain readable. Mobile heading and controls wrap without clipping.
- Spacing/layout: ivory page, large office scene and separate detail panel preserve the visual hierarchy. Controls wrap at 390px without horizontal overflow. Detail remains proportional.
- Colors/tokens: forest jacket and outlines, cream shirt, indigo trousers and brown boots match the selected palette; muted ivory and green frame the existing office.
- Image quality: real transparent raster body art, source portrait crop, independent circular camera layer. Boots share a floor baseline. Back view displays the backpack; the webcam remains visible for identity. No placeholder illustrations or replacement CSS artwork.
- Copy/content: Spanish labels describe the working controls and explicitly identify this as a four-view study. Camera consent is button-driven and the sample portrait is identified.

## Verification

- `scripts/check-avatar-preview.mjs`: walking changes frames, pause settles, front/back differ, seated pose, existing-body comparison, fake camera activation/deactivation, 390px overflow check, reduced-motion initial pause, zero browser page errors.
- `bun run build`: passed. Preview URL exercised through Tailscale MagicDNS.
- `git diff --check`: passed.
- `bun test`: 26 passed / 0 failed / 7359 assertions in an isolated temporary checkout of current source. Direct workspace run was 20 passed / 6 failed because the existing local admin password file is shorter than the startup requirement. The local credential was left untouched; this is unrelated to the static avatar study.

## Follow-up polish

- Front/back generated walking frames are a style/movement study, not a final eight-direction animation set. Front/back second contacts are mirrored to alternate the leading leg. Lateral movement now uses continuous joints instead of switching complete poses.
- Physical webcam hardware was not tested; browser media lifecycle was exercised with Chromium's synthetic camera.

## Implementation checklist

- [x] Selected reference and generated atlas included.
- [x] Functional preview remains separate from main avatar renderer.
- [x] Desktop and mobile captures inspected against reference.
- [x] Corrections recaptured; browser checks pass.
- [x] Preview remains available at `https://workbox.bengal-balance.ts.net:8444/proposals/avatars.html`.

## Lateral-motion correction after user feedback

- Reproduced the reported arm/leg jumps with deterministic browser animation at 60 Hz. The old lateral cycle held 52 of 60 frames unchanged, then abruptly changed up to 47.5% of the sampled body region in one frame. Its independently generated poses changed limb silhouette, position and torso width at only eight changes per second.
- Replaced lateral frame swapping with one generated transparent set of torso/arm/leg pieces (`public/proposals/avatar-side-parts.png`). Torso, backpack and head remain stable; short opposing arm and leg swings progress continuously with distance. The same parts settle into idle as movement decelerates, in both directions.
- The real browser regression in `scripts/check-avatar-preview.mjs` now checks both directions at normal and 150% speed. Peak pixel changes: 6.1% at normal speed and 7.9% at 150%; motion progresses in all 60 sampled frames. The test failed on the previous implementation.
- Visual evidence: `/tmp/avatar-side-smooth.png` and eight sequential rendered detail views together in `/tmp/avatar-side-cycle.png`. Inspected the stable head/backpack/torso, connected shoulders and hips, and short alternating steps against the approved forest outfit. Palette, detailed raster style and circular camera are retained. Controls and responsive layout remain unchanged.
- Build, browser interactions, camera lifecycle, mobile overflow, reduced motion and diff checks passed after the correction. JavaScript is served with `Cache-Control: no-store`; reopening the preview receives the correction.
- Remaining scope: this is a visual prototype with rigid limb pieces, not a full knee/ankle animation system.

### Lateral cadence correction

The user found the continuous side animation too slow. Its full cycle covered 56 world pixels versus 40 for front/back. Matched the lateral cycle to 40 pixels (40% higher cadence) without increasing limb swing or changing travel speed. Added a deterministic browser assertion for a complete cycle every 40 pixels; it failed before the fix and passed afterward in both directions at normal and 150% speed. The existing smoothness check still passes: maximum adjacent-frame changes 7.5% and 9.7%, respectively, with motion in 60/60 frames. Build and all 26 tests passed in the isolated source checkout.

### Foot planting and clearance correction

User feedback identified dragging feet despite the increased cadence. Replaced lateral rigid-leg oscillation with alternating planted and airborne phases: the stance foot cancels world travel exactly, while the returning foot clears the floor by eight world pixels. Two connected leg segments bend at the knee; boot soles stay level. Front/back rendering is unchanged.

`tests/avatar-motion.test.js` passes 802 assertions covering stationary world-space support, alternating legs, full foot clearance, continuous cycle boundaries, and fixed segment lengths. The browser check passes in both directions at both speeds, along with the existing camera/mobile/reduced-motion interactions. Pixel-change peaks are now 12.2% and 15.2% because knees and lifted feet cover more area; the browser threshold accommodates this larger motion while the geometric test checks continuity directly. Visual contact sheet `/tmp/avatar-side-lift.png` shows eight sequential poses together, including visible clearance and connected knees. Build and diff checks passed. Earlier rigid-leg scope limitation is superseded by this correction; the torso and arm assets remain unchanged.

final result: passed


## Reference-led whole-body replacement (current implementation)

The user rejected the articulated walk as crouched and explicitly requested the style and pacing of the approved front/back views. Research is recorded in `docs/avatar-walk-references.md`. Primary visual references actually inspected: Saint11's Top Down Walk Cycle and Walk Cycle diagrams, and J. K. Riki's four-pose diagram. Code measurement confirmed the support knee remained flexed 32.5–52.9 degrees with fixed hip height; the prior checks could not detect this inappropriate posture.

Removed the lateral joint solver, segmented-limb renderer, obsolete parts atlas and solver-specific tests. Generated complete upright side poses (`public/proposals/avatar-side-walk.png`) using the approved original character and the reference contact/passing structure. Both contact halves and both passing halves are present. The new sprites anchor at the collar and share a 68-pixel body height so changing stride width does not move the torso sideways. Front/back drawing and art remain unchanged.

The shared `frame` now drives every direction. Browser verification compares actual rendered frame-change times against the front view: all four directions use exactly four poses, eight changes/second at normal speed and twelve at 150%. Camera, seated pose, comparison toggle, mobile overflow, reduced motion and browser-error checks also pass. The old continuous-motion pixel threshold is intentionally removed: it contradicted the user's explicit request for the approved pose-based rhythm and had not established visual naturalness.

Visual evidence: `/tmp/avatar-matched-poses.png` places front, side and back cycles together (four poses per row, identical drawing scale). Inspected extended support legs, lifted passing feet, collar alignment, outfit palette and complete silhouettes, with no segmented knees. Native scene and enlarged detail were both checked. This is visual QA evidence, not a claim of subjective user approval; the moving preview remains available for review.

final result: passed
