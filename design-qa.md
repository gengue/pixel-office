# Office visual review

Visual target: the supplied cozy pixel-office references, especially the first image.
This is an adaptation of their furniture detail, pastel palette and distinct room
zones to the existing office, rather than an exact reproduction of their floor plans.

## Verification

- Inspected rendered entrance, studio, kitchen, full map, and 390px mobile layout.
- Original generated sprites provide desks, upholstery, plants, books, windows,
  framed art, whiteboard, aquarium and kitchen accessories.
- Corrected chair and cabinet proportions, north-edge clipping, and a plant in
  the random spawn area. Furniture and avatars render in depth order.
- Verified join over HTTPS/WebSocket, WASD movement, chat, sitting and standing.
- No page JavaScript errors or horizontal mobile overflow in the browser check.
- Follow-up: added snake plants, palms, rubber trees, ferns and flowers, positioned
  beside furniture and room edges, plus bamboo planters. Added teal sofas, mustard
  armchairs, dining chairs, laptop desks, bistro tables and record-player sideboards.
- Browser-checked all 30 seats, including both cushions of each sofa and every
  armchair. Verified safe exits via E, walking and clicking, the contextual button,
  and seated-state synchronization/occupied-seat avoidance with two clients.
- `bun test`: 3 passing tests covering both atlases, readiness, depth ordering,
  reachable seats, occupied seats, blocked approaches and early ICE candidates.
- `git diff --check`: passed.
- Follow-up: north windows now fit entirely within a taller wall with wainscot
  and baseboard; its footprint also blocks walking into the wall. Desktop map
  and sidebar fill the available viewport height. ResizeObserver preserves
  sprite proportions and updates camera, click coordinates and minimap dimensions.
- Verified layout at 1440x960, 1920x1080, 1024x768 and 390x844 with no horizontal
  overflow, no unused desktop strip below the map, and matching canvas proportions.

Browser captures: `/tmp/pixel-office-check/screenshots/`.
Browser check: `/tmp/pixel-office-check/check.cjs` (temporary Playwright install).
Seat interaction check: `/tmp/pixel-office-check/seats.cjs`.
Responsive layout check: `/tmp/pixel-office-check/layout.cjs`.
Camera/microphone permissions used synthetic devices. Two production browsers
received audio packets and decoded video frames with relay-only ICE, confirming
Cloudflare TURN in both directions. Physical microphones and cameras on separate
user devices still require user verification. Existing avatars retain their
original simpler art style.

final result: passed

## Screen sharing verification

- Native Chromium display capture with synthetic devices delivered decoded screen
  video over a selected TURN relay candidate while preserving the camera track.
- Verified separate-room exclusion, audience removal closing the sender connection,
  re-entry, expand/restore, manual stop, picker cancellation, browser track-ended
  handling, automatic stop on room exit, and a 390px layout without overflow.
- Server regression covers room exclusivity, unauthorized signaling, room exit,
  proximity audience and presenter disconnect. UI regression covers an empty
  initial state and crossing back over a boundary before a server audience update.

## Reactions verification

- Server integration: emoji allowlist, server-assigned sender identity, 650 ms rate limit, same-room delivery across distance, nearby delivery and distant exclusion.
- Production Chromium: avatar reaction and automatic expiry; keyboard Space sends and Escape dismisses the native picker; presenter and expanded viewer receive named notices; 390 px layout fits and reduced-motion rendering works.
- Screen sharing regression passed with forced TURN relay and decoded frames; camera track remained unchanged.

## Bottom controls review

- Call controls stay in the same bottom position in office and expanded presentation views.
- Picker opens immediately above React; 1440, 390 and 320 px layouts fit without horizontal overflow.
- Microphone and raised-hand state are conveyed by labels and aria-pressed, with distinct styling.
- Removed the duplicate stop-sharing action and repeated presentation copy; content reserves the measured dock height.

## Map expansion

- Added tiled restrooms with two stalls and a wash area, an outdoor lawn/deck terrace, and a four-seat huddle room.
- Walkability search confirms every new zone and all 36 seat approaches are reachable from the entrance. Browser checks exercise every seat, safe exit, and occupancy synchronization.
- Capacity is checked by both the client and server on join/move/sit; the fifth visitor sees a full-room notice and can enter when a place is released.
- Minimap uses a dark/gold double outline and dims the area outside the current viewport. Desktop and mobile artwork reviewed.

## Meeting links

- Reusable aliases for Meeting Room/Huddle Room and numeric x/y destinations; server validates arrivals against shared geometry, existing occupants and room capacity.
- Browser-tested link creation before joining, clipboard copy/manual fallback, exact coordinates, furniture avoidance, unknown-room fallback, full-room fallback and reload after a place opens.
- Native dialog fits 390 px, traps focus, dismisses with Escape and prevents movement while interacting.
- Existing layout moved unchanged to a shared world module so link validation and player movement use the same collision footprints.
