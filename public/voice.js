export const TALK = 320
export const LINK = TALK + 110

export function voiceVolume(a, b, rooms) {
  const room = roomAt(a, rooms)
  if (room !== -1 && room === roomAt(b, rooms)) return 1
  return Math.max(0, 1 - Math.hypot(a.x - b.x, a.y - b.y) / TALK)
}

export function canViewScreen(share, owner, viewer) {
  if (!owner || !viewer || roomAt(owner, ROOMS) !== share.room || roomAt(viewer, ROOMS) !== share.room) return false
  return share.room !== -1 || Math.hypot(owner.x - viewer.x, owner.y - viewer.y) < TALK
}
import { ROOMS, roomAt } from './rooms.js'
