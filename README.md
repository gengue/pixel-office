# Pixel Office

A cozy multiplayer office with pixel avatars, live webcam faces, proximity voice,
screen sharing and emoji reactions. Built with Bun and browser APIs. No runtime dependencies.

## Run locally

Install [Bun](https://bun.sh), then:

```sh
git clone https://github.com/gengue/pixel-office.git
cd pixel-office
bun run dev
```

Open `http://localhost:3000` in two tabs and allow camera and microphone access.
Other devices need HTTPS for camera, microphone and screen capture.

## In the office

- Move with WASD, arrow keys or a click. Press **E** near a chair or sofa to sit;
  move or press E again to stand.
- Choose your body, outfit and accessory before joining. Your appearance is saved
  on your device. Your live webcam remains your avatar's face.
- Explore the restrooms, outdoor terrace and a four-seat huddle room for smaller meetings.
  The huddle room admits at most four people; a place opens when someone leaves.
- Walk near someone to talk. Voice fades over 320 world pixels; people inside the
  same marked room hear each other at full volume, regardless of distance.
- Use the bottom controls to mute, react, raise your hand, share a screen or leave.
  Reactions float above avatars; presentations also show temporary named notices.
- Share a tab, window or display beside the office, or expand the presentation.
  Camera and microphone stay connected. Leaving the room ends your presentation.
- Chat messages go to the whole office. Reactions reach people in voice range or
  the same room and disappear after three seconds.
- The reading room's existing turntable plays quiet jazz (Bill Evans, Peace Piece).
  Use the music panel to play, pause or paste a YouTube video link; each listener
  controls their own selection. Volume peaks at 50% within 80 world pixels, fades
  to silence at 320 pixels and stays silent outside the reading room. YouTube
  requires internet access and an embeddable video; press Play to enable playback.
  Music pauses when the tab is hidden, the presentation is expanded or you leave.

Each room allows one presenter. Outside rooms, screen sharing reaches nearby people
who are also outside rooms. Screen capture targets 720p at 15 fps without system audio.

## Meeting links

Use **Meeting link** in the lobby or office header, choose a conference room and
copy the link into your Google Calendar event description. In the office you can
also choose **My current position**.

```text
/?room=meeting
/?room=huddle
/?x=1200&y=900
```

Guests choose their name and grant camera/microphone permission before arriving.
Room aliases take precedence over coordinates. Coordinates must be finite numbers
within the 2400×1600 world; walls, furniture and occupied arrival points are adjusted
to a nearby free spot. Invalid destinations or a full huddle room lead to the welcome
lounge with an explanation. Room links are reusable, not time-slot reservations.

## TURN configuration

STUN works by default, but connections across restrictive networks require TURN.
Copy `.env.example` to `.env` and configure one provider:

- Cloudflare: `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` are a TURN key
  ID and secret, **not** the account management API token. Only the server uses the
  secret; browsers receive temporary ICE credentials.
- Another TURN provider: set comma-separated `TURN_URLS`, `TURN_USERNAME` and
  `TURN_CREDENTIAL`. These credentials are delivered to browsers.

`GET /rtc-config` returns the ICE configuration. A configured provider failure
returns 503. Restart the server after changing configuration.

## Production

```sh
bun run build
HOST=127.0.0.1 PORT=3000 bun run start:prod
```

Serve it behind an HTTPS reverse proxy with WebSocket support. The build bundles
browser code, CSS, the server and public assets into `dist/`.

## Checks

```sh
bun test
```

Tests cover artwork bounds, seats, avatar validation, voice range, early ICE
candidates, screen audience enforcement, reaction validation and viewer lifecycle.

## Structure

- `server.ts`: in-memory players, WebSocket events, presentation audiences and static files.
- `rtc-config.ts`: server-side TURN credential exchange.
- `public/app.js`: movement, rendering, chat, camera connections and meeting-link controls.
- `public/world.js`: shared furniture, walls and collision geometry.
- `public/meeting-links.js`: URL parsing, link creation and safe arrival resolution.
- `public/screen-share.js`: display capture and separate presentation connections.
- `public/office-art.js`, `avatars.js`, `seating.js`: artwork, bodies and usable seats.
- `public/rooms.js`, `voice.js`, `reactions.js`: shared room and interaction rules.

The three furniture atlases are original AI-generated assets. The basic renderer
keeps the office usable while images load or if they fail. Reduced-motion settings
suppress decorative animation.

## Limits

This is an experiment: one shared office, no accounts, access control or persistence.
Anyone with the deployment URL can join; chat and positions are public to that office.
The TURN configuration endpoint is also public, so operate it with provider quotas.

WebRTC uses a peer mesh, including one screen stream per viewer. It is intended for
small groups. Seats avoid occupied positions on the client but simultaneous claims
are not arbitrated by the server. Camera capture targets 320×240 to limit bandwidth.

Click a person in **People** to walk quickly beside them, following a free route around walls and furniture. Select them again, press Esc, or move manually to cancel. Full rooms remain inaccessible.
