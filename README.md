# Pixel Office · virtual office experiment

Pixel avatars (man, woman, orc, lizard, robot, ghost) + your live webcam as the head.
Move with WASD/arrows or click. Proximity voice over WebRTC (walk up to talk). Chat with links + bubbles.

## run

```bash
bun --cwd /home/genesis/workspace/pixel-office dev
# open http://localhost:3000
```

Open 2 tabs, pick different bodies, allow camera + mic on entry, walk close to talk.
Chat: paste `https://example.com`, it opens in a new tab. Bubbles clamp to 72px with ellipsis, click to expand.

## stack

Bun.serve + native WebSocket (signaling + positions + chat). Mesh P2P WebRTC for audio/video between nearby peers only. Zero deps.

## experiment limits

- No persistence, no auth, single room.
- Public Google STUN. Voice can fail on symmetric NAT; chat and movement keep working.
- 320p video to save bandwidth.
