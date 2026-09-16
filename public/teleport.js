export const TELEPORT_DURATION = 2200

// Return false when the one-shot effect has finished.
export function drawTeleport(ctx, arrival, now, reducedMotion = false) {
  const age = now - arrival.started
  const duration = reducedMotion ? 700 : TELEPORT_DURATION
  if (age < 0) return true // A queued frame can predate the arrival event.
  if (age >= duration) return false
  const t = age / duration
  const fade = reducedMotion ? 0.6 : Math.min(1, t * 8) * Math.min(1, (1 - t) * 3)
  ctx.save()
  ctx.translate(arrival.x, arrival.y + 54)
  ctx.globalAlpha = fade
  ctx.strokeStyle = '#78fff1'
  ctx.lineWidth = 3
  ctx.shadowColor = '#39dfff'
  ctx.shadowBlur = reducedMotion ? 0 : 16
  const ring = (radius, y) => {
    ctx.beginPath()
    ctx.ellipse(0, y, radius, radius * 0.28, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ring(reducedMotion ? 40 : 34 + t * 25, 0)
  if (!reducedMotion) {
    ring(25 + t * 18, -3)
    const beam = ctx.createLinearGradient(0, -170, 0, 0)
    beam.addColorStop(0, '#6defff00')
    beam.addColorStop(0.65, '#64e8ff24')
    beam.addColorStop(1, '#92fff866')
    ctx.fillStyle = beam
    ctx.fillRect(-32 * (1 - t * 0.5), -170, 64 * (1 - t * 0.5), 170)
    ctx.strokeStyle = '#d3fffd'
    ctx.lineWidth = 2
    ring(32 * (1 - t * 0.4), -135 * (1 - t))
    for (let i = 0; i < 18; i++) {
      const angle = i * 2.39996 + t * 1.5
      const radius = 26 + (i % 4) * 9 + t * 18
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius * 0.3 - ((i * 19 + t * 130) % 155)
      ctx.fillStyle = i % 2 ? '#dcfffa' : '#57cfff'
      ctx.fillRect(x, y, 3, 5)
    }
  }
  ctx.restore()
  return true
}
