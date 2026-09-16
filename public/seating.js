export function createSeats(furniture) {
  return furniture.flatMap(([type, x, y, w, h]) => {
    if (type === 'chair') return [{ x: x + 14, y: y + 14, entry: { x: x + 14, y: y + 14 } }]
    if (type === 'armchair' || type === 'sofaH') {
      const positions = type === 'sofaH' ? [0.3, 0.7] : [0.5]
      return positions.map((part) => ({
        x: Math.round(x + w * part), y: y + h - 28,
        entry: { x: Math.round(x + w * part), y: y + h + 20 },
      }))
    }
    return []
  })
}

export function findSeat(seats, position, occupants, blocked) {
  let nearest = null
  let distance = 48
  for (const seat of seats) {
    const dx = seat.entry.x - position.x
    const dy = seat.entry.y - position.y
    const d = Math.hypot(dx, dy)
    if (d >= distance || occupants.some((p) => p.sitting && Math.hypot(p.x - seat.x, p.y - seat.y) < 24)) continue
    // Approach from the walkable side; never sit through a wall or another desk.
    const steps = Math.max(1, Math.ceil(d / 6))
    let clear = true
    for (let i = 0; i <= steps; i++) {
      if (blocked(position.x + dx * i / steps, position.y + dy * i / steps)) {
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
