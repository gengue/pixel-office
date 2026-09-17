export function createSeats(furniture) {
  return furniture.flatMap(([type, x, y, w, h]) => {
    const obstacle = { x, y, w: w ?? 28, h: h ?? 28 }
    if (type === 'chair') return [{ x: x + 14, y: y + 14, entry: { x: x + 14, y: y + 14 }, obstacle }]
    if (type === 'armchair' || type === 'sofaH' || type === 'toilet') {
      const positions = type === 'sofaH' ? [0.3, 0.7] : [0.5]
      return positions.map((part) => ({
        x: Math.round(x + w * part), y: y + h - 28,
        entry: { x: Math.round(x + w * part), y: y + h + 20 }, obstacle,
      }))
    }
    return []
  })
}

export function findSeat(seats, position, occupants, blocked) {
  let nearest = null
  let distance = Infinity
  for (const seat of seats) {
    const bounds = seat.obstacle
    const edgeDistance = Math.hypot(Math.max(bounds.x - position.x, 0, position.x - bounds.x - bounds.w), Math.max(bounds.y - position.y, 0, position.y - bounds.y - bounds.h))
    if (edgeDistance > 48) continue
    const dx = seat.x - position.x
    const dy = seat.y - position.y
    const d = Math.hypot(dx, dy)
    if (d >= distance || occupants.some((p) => p.sitting && Math.hypot(p.x - seat.x, p.y - seat.y) < 24)) continue
    // Ignore the seat itself, but never sit through a wall or another desk.
    const steps = Math.max(1, Math.ceil(d / 6))
    let clear = true
    for (let i = 0; i <= steps; i++) {
      if (blocked(position.x + dx * i / steps, position.y + dy * i / steps, seat)) {
        clear = false
        break
      }
    }
    if (clear) {
      nearest = seat
      distance = d
    }
  }
  return nearest
}
