# pixel-office · experimento oficina virtual

Avatares pixel (hombre, mujer, orco, lagarto, robot, fantasma) + cabeza = webcam live.
Movimiento WASD/flechas o click. Voz por proximidad WebRTC (acércate para hablar). Chat con links + burbujas.

## run

```bash
bun --cwd /home/genesis/workspace/pixel-office dev
# abre http://localhost:3000
```

Abre 2 pestañas, elige cuerpos distintos, activa cámara, acércate para hablar.
Chat: pega `https://example.com`, abre en pestaña nueva. Burbuja trunca a 72px con ellipsis, click expande.

## stack

Bun.serve + WebSocket nativo (señalización + posiciones + chat). WebRTC mesh P2P solo audio/video entre cercanos. Sin deps.

## límites experimento

- Sin persistencia, sin auth, una sola sala.
- STUN público Google. En NAT simétrica puede fallar voz; chat y movimiento siguen.
- Video 320p para ahorrar ancho de banda.
