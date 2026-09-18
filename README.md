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
- Walk up to the meeting room's wall whiteboard and select **Open whiteboard**.
  Draw, erase or place text in any color. Nearby participants see saved changes
  as each stroke or note is submitted; closing the board or restarting the server
  keeps its contents.
- The reading room's existing turntable plays quiet jazz (Bill Evans, Peace Piece).
  Nearby listeners share the song, play/pause and server-timed playback position.
  The music panel appears only in range; close it to stop listening locally or
  reopen it to rejoin the current position. Closing, leaving or hiding your tab
  does not pause the music for others. The Pause button pauses it for everyone.
  Volume peaks at 50% within 80 world pixels, fades to silence at 320 pixels and
  stays silent outside the reading room. YouTube requires an embeddable video;
  some browsers require clicking Listen once. Drift is corrected periodically,
  including after buffering. Shared music resets when the server restarts.
- Near the turntable, press **B** or click **Dance** to dance in place; everyone
  sees your dance. Press B again, walk or sit to stop. E still controls sitting.
  Reduced-motion mode shows a static dance pose instead of animation.

Each room allows one presenter. Outside rooms, screen sharing reaches nearby people
who are also outside rooms. Screen capture targets 720p at 15 fps without system audio.

## Admin access

Open `/admin` and enter the password from `data/admin/password.txt` on the server.
The server generates this private file automatically on first start; no environment
variables are required. It is outside the public directory and excluded from Git.
The file and its directory are readable only by the operating-system user running
the server. Do not put the password in frontend code or a shared invitation link.

The browser remembers your admin session for 90 days with an HttpOnly cookie.
Changing your display name or avatar does not change your admin identity. A private
**Admin** link appears beside your name in the office. Other browsers remain guests;
sign in separately on each trusted device. Browser fingerprints are not used.
**Forget this browser** in `/admin` revokes that session, including open office tabs.
After signing in, return to the office or reload any previously open office tabs.

Preserve `data/admin/` across releases to keep the password and sessions. To rotate
the password and invalidate every session, remove only `data/admin/password.txt`
and restart; the server generates a new password. Production requires HTTPS.
Future privileged HTTP routes must check `admin.isAdmin(admin.token(req))`, and
WebSocket actions must check `admin.isAdmin(ws.data.adminToken)` on each action;
hiding a control in the browser is not authorization.

### Reload connected users after an update

Build and restart the server, then select **Reload everyone** in `/admin`.
The Admin link opens in another tab so your office session stays connected too.
Connected office tabs retry their connection during a server restart; the button
requests a reload from everyone currently joined. Each tab saves its own name,
appearance, position, seat and raised hand, then rejoins automatically. A previous
meeting-link destination does not override the saved position. Room capacity
rules still apply if the destination has filled up during the reload.

Microphone and camera choices are saved in browser storage whenever you toggle
them and applied before media is attached to any call, including after a normal
manual entry. Resume checkpoints expire after 15 minutes and are cleared after
rejoining; clicking **Leave** still returns to the lobby. Temporary connection
failures retry automatically; browser permission failures show the normal retry
message. Screen sharing must be started again because browsers require a new
selection. Browser storage must be available to save a reload checkpoint.

HTML, scripts and styles are served without caching to pick up the published
build. This command takes effect for clients already running this feature; older
clients need one manual reload to install it. Publishing does not itself trigger
a global reload.

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

The shared whiteboard uses Bun's built-in SQLite in `data/whiteboard.sqlite`,
relative to the server's working directory. Set `WHITEBOARD_DB` to an absolute
path on persistent storage when deploying; preserve that directory across releases.
The board currently accepts 10,000 operations (up to 512 points per stroke and
200 characters per note). At capacity it rejects new changes without deleting
existing content. All office visitors near the board can edit it.

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

This is an experiment: one shared office with a single owner password and no guest
accounts. The whiteboard and admin sessions persist; other shared state lives in memory.
Anyone with the deployment URL can join; chat and positions are public to that office.
The TURN configuration endpoint is also public, so operate it with provider quotas.

WebRTC uses a peer mesh, including one screen stream per viewer. It is intended for
small groups. Seats avoid occupied positions on the client but simultaneous claims
are not arbitrated by the server. Camera capture targets 320×240 to limit bandwidth.

Click a person in **People** to walk quickly beside them, following a free route around walls and furniture. Select them again, press Esc, or move manually to cancel. Full rooms remain inaccessible.

Successful meeting-link arrivals play a brief cyan teleport portal, beam, and particle effect for the arriving person and connected peers. Reduced-motion mode uses a short static halo.
