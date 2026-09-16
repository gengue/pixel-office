import { ROOMS, roomAt, fullRoomAt } from './rooms.js'
import { WORLD, BODY_R, hitsSolid } from './world.js'

const invalid = { notice: "This destination link is invalid. You'll enter the welcome lounge." }

export function parseDestination(search = '') {
  if (typeof search !== 'string' || search.length > 2048) return invalid
  const params = new URLSearchParams(search)
  if (params.has('room')) {
    const room = ROOMS.find((room) => room.alias && room.alias === params.get('room'))
    return room ? { point: room.arrival, room, label: room.label.toLowerCase() } : invalid
  }
  if (!params.has('x') && !params.has('y')) return null
  const x = Number(params.get('x')), y = Number(params.get('y'))
  if (!params.get('x')?.trim() || !params.get('y')?.trim() || !Number.isFinite(x) || !Number.isFinite(y) ||
    x < 0 || x > WORLD.w || y < 0 || y > WORLD.h) return invalid
  return { point: { x, y }, label: `position ${x}, ${y}` }
}

export function meetingURL(base, destination) {
  const url = new URL('/', base)
  url.search = new URLSearchParams(typeof destination === 'string'
    ? { room: destination } : { x: Math.round(destination.x), y: Math.round(destination.y) }).toString()
  if (parseDestination(url.search)?.notice) throw new Error('Invalid meeting destination')
  return url.href
}

export function resolveArrival(search, occupants = [], id = '') {
  const destination = parseDestination(search)
  if (!destination?.point) return destination
  const full = fullRoomAt({ ...destination.point, id }, occupants)
  if (full) return { notice: `The ${full.label.toLowerCase()} is full. You'll enter the welcome lounge.` }
  const point = {
    x: Math.max(30, Math.min(WORLD.w - 30, destination.point.x)),
    y: Math.max(40, Math.min(WORLD.h - 40, destination.point.y)),
  }
  const available = (p) => p.x >= 30 && p.x <= WORLD.w - 30 && p.y >= 40 && p.y <= WORLD.h - 40 &&
    (!destination.room || roomAt(p) === ROOMS.indexOf(destination.room)) && !hitsSolid(p.x, p.y) &&
    !fullRoomAt({ ...p, id }, occupants) && occupants.every((other) => other.id === id || Math.hypot(other.x - p.x, other.y - p.y) >= BODY_R * 2)
  if (available(point)) return { ...destination, point }
  // Search only at arrival, near the requested point; keep ordinary movement unchanged.
  let nearest = null, distance = Infinity
  for (let dy = -160; dy <= 160; dy += 8) for (let dx = -160; dx <= 160; dx += 8) {
    const d = dx * dx + dy * dy
    if (d >= distance) continue
    const candidate = { x: point.x + dx, y: point.y + dy }
    if (available(candidate)) { nearest = candidate; distance = d }
  }
  return nearest ? { ...destination, point: nearest } : { notice: "There is no free arrival spot here. You'll enter the welcome lounge." }
}
