import { WORLD } from './world.js'
import { BODY_KINDS, normalizeAppearance } from './avatars.js'

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key) ?? 'null') } catch { return null }
}
function write(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

export function mediaPreferences(storage) {
  const value = read(storage, 'po-media')
  return { muted: value?.muted === true, cameraOff: value?.cameraOff === true }
}
export function saveMediaPreferences(storage, muted, cameraOff) {
  return write(storage, 'po-media', { muted, cameraOff })
}

export function saveReloadSession(storage, player, media, seatReturn) {
  const { name, body, appearance, x, y, sitting, hand } = player
  return write(storage, 'po-reload', { name, body, appearance, x, y, sitting, hand, ...media, seatReturn, expires: Date.now() + 15 * 60 * 1000 })
}

export function reloadSession(storage) {
  const value = read(storage, 'po-reload')
  const point = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y) && p.x >= 24 && p.x <= WORLD.w - 24 && p.y >= 40 && p.y <= WORLD.h - 24
  if (!value || !Number.isFinite(value.expires) || value.expires <= Date.now() || typeof value.name !== 'string' || !value.name.trim() || !BODY_KINDS.includes(value.body) || !point(value)) return null
  return { name: value.name.slice(0, 24), body: value.body, appearance: normalizeAppearance(value.appearance), x: value.x, y: value.y, sitting: value.sitting === true && point(value.seatReturn), seatReturn: point(value.seatReturn) ? { x: value.seatReturn.x, y: value.seatReturn.y } : null, hand: value.hand === true, muted: value.muted === true, cameraOff: value.cameraOff === true }
}

export function clearReloadSession(storage) {
  try { storage.removeItem('po-reload') } catch {}
}
