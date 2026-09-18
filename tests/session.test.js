import { test, expect } from 'bun:test'
import { mediaPreferences, saveMediaPreferences, saveReloadSession, reloadSession, clearReloadSession } from '../public/session.js'

const storage = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}

test('reload checkpoints retain each tab identity, position and controls without changing normal entry', () => {
  const browser = storage(), tab = storage(), otherTab = storage()
  expect(mediaPreferences(browser)).toEqual({ muted: false, cameraOff: false })
  const player = { name: 'Artist', body: 'orco', appearance: { color: 'forest', accessory: 'satchel' }, x: 1100.5, y: 400.25, sitting: true, hand: true }
  for (const muted of [false, true]) for (const cameraOff of [false, true]) {
    expect(saveMediaPreferences(browser, muted, cameraOff)).toBe(true)
    expect(mediaPreferences(browser)).toEqual({ muted, cameraOff })
    expect(saveReloadSession(tab, player, { muted, cameraOff }, { x: 1080, y: 420 })).toBe(true)
    expect(reloadSession(tab)).toMatchObject({ name: 'Artist', body: 'orco', appearance: player.appearance, x: 1100.5, y: 400.25, sitting: true, hand: true, muted, cameraOff, seatReturn: { x: 1080, y: 420 } })
    expect(reloadSession(otherTab)).toBe(null)
  }
  clearReloadSession(tab)
  expect(reloadSession(tab)).toBe(null)
  expect(mediaPreferences(browser)).toEqual({ muted: true, cameraOff: true })
})

test('stale or corrupt checkpoints do not trigger automatic entry; unavailable storage fails safely', () => {
  const tab = storage()
  const valid = { name: 'Guest', body: 'hombre', x: 100, y: 400, expires: Date.now() + 60000 }
  for (const invalid of [{ ...valid, expires: Date.now() - 1 }, { ...valid, name: '' }, { ...valid, x: -1 }, { ...valid, y: null }, { ...valid, body: 'unknown' }]) {
    tab.setItem('po-reload', JSON.stringify(invalid))
    expect(reloadSession(tab)).toBe(null)
  }
  tab.setItem('po-reload', '{')
  expect(reloadSession(tab)).toBe(null)
  const blocked = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') }, removeItem() { throw Error('blocked') } }
  expect(mediaPreferences(blocked)).toEqual({ muted: false, cameraOff: false })
  expect(reloadSession(blocked)).toBe(null)
  expect(saveReloadSession(blocked, valid, { muted: true, cameraOff: true }, null)).toBe(false)
  expect(() => clearReloadSession(blocked)).not.toThrow()
})
