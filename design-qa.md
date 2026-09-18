# Avatar motion prototype — option 3

final result: passed

Scope: isolated `/proposals/avatars.html` study, not a replacement for production avatars. One forest outfit, four cardinal views (left mirrors right), continuous lateral limb animation, four front/back walking frames, idle and seated poses. Eight-direction art and the other outfits remain outside this first approval preview.

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

final result: passed
