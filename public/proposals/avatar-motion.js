export function lateralLegPose(distance, offset = 0, amount = 1) {
  const phase = ((distance + offset) % 40 + 40) % 40 / 40
  const swing = Math.max(0, (phase - .5) * 2)
  // Stance moves backward at travel speed; the returning foot clears the floor.
  const footX = (phase < .5 ? 10 - phase * 40 : -10 - 20 * swing + 120 * swing ** 2 - 80 * swing ** 3) * amount
  const footY = -8 * Math.sin(Math.PI * swing) ** 2 * amount
  const hip = { x:0, y:-33 }
  const ankle = { x:footX, y:footY - 7 }
  const dx = ankle.x - hip.x, dy = ankle.y - hip.y
  const length = Math.hypot(dx, dy)
  const upper = 16, lower = 13
  const along = (upper ** 2 - lower ** 2 + length ** 2) / (2 * length)
  const bend = Math.sqrt(Math.max(0, upper ** 2 - along ** 2))
  const knee = { x:hip.x + dx * along / length + dy * bend / length, y:hip.y + dy * along / length - dx * bend / length }
  return { hip, knee, ankle, foot:{ x:footX, y:footY }, planted:phase < .5 }
}
