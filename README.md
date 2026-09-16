# Pixel Office · virtual office experiment

Pixel avatars (man, woman, orc, lizard, robot, ghost) + your live webcam as the head.
Move with WASD/arrows or click. Proximity voice over WebRTC (walk up to talk). Chat with links + bubbles.

World is 2400x1600 with camera follow + minimap. Zones: lobby, open office (desks),
meeting room, lounge, kitchen. Walls and furniture collide.

## run

```bash
bun --cwd /home/genesis/workspace/pixel-office dev
# open http://localhost:3000
```

Open 2 tabs, pick different bodies, allow camera + mic on entry, walk close to talk.
Chat: paste `https://example.com`, it opens in a new tab. Bubbles clamp to 72px with ellipsis, click to expand.

## stack

Bun.serve + native WebSocket (signaling + positions + chat). Mesh P2P WebRTC for audio/video between nearby peers only. Zero deps.

## production

```bash
bun run build
HOST=127.0.0.1 PORT=3108 bun run start:prod
```

The build bundles/minifies the browser JavaScript, CSS and Bun server into
`dist/`, including the HTML and image assets. The production server serves only
the built files, without hot reload.

On workbox, `pixel-office-production.service` is an enabled user systemd service.
After rebuilding, restart it with `systemctl --user restart pixel-office-production`.
Logs: `journalctl --user -u pixel-office-production -f`.

Public test URL: https://workbox.bengal-balance.ts.net:8443/ (Tailscale Funnel;
visitors do not need Tailscale). Disable public access with
`tailscale funnel --https=8443 off`.

## office artwork

`public/assets/office-atlas.png` and `office-variety.png` are original AI-generated
transparent furniture atlases, including five plant species and varied seating.
`public/office-art.js` contains measured sprite regions, a cached floor layer and the
minimap. Furniture and avatars are painted in depth order. Layout and collision
footprints remain in `public/app.js`; keep those footprints aligned when moving props.
The original renderer remains available while the atlas loads or if it cannot load.

`public/seating.js` defines usable seats for chairs, armchairs and both sofa cushions.
Approach a seat and press E or use the on-screen button. Press E, move, or click
the floor to stand up at the previous safe position. Nearby occupied seats are
excluded by the client; simultaneous seat claims are not server-arbitrated.

Run the atlas and seating checks with `bun test`.

## experiment limits

- No persistence, no auth, single room.
- Public Google STUN by default. Configure TURN for networks that cannot connect directly; chat and movement do not need it.
- 320p video to save bandwidth.

## voice/video across networks

Set `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` on the server
to use Cloudflare TURN. These are the TURN key ID and its secret, not the account
management API token. The server exchanges them for temporary browser credentials.
Alternatively, set `TURN_URLS` (comma-separated), `TURN_USERNAME`, and
`TURN_CREDENTIAL` for an existing TURN service; those credentials are sent to clients.
Restart the production service after configuring its environment.

`GET /rtc-config` supplies the browser ICE configuration. A configured provider
failure returns 503 rather than silently disabling relay support.
