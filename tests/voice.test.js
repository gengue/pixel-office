import { test, expect } from 'bun:test'
import { voiceVolume } from '../public/voice.js'

test('voice reaches farther nearby and covers a shared room without distance fading', () => {
  const rooms = [{ x: 100, y: 100, w: 1000, h: 800 }, { x: 1200, y: 100, w: 500, h: 800 }]
  const a = { x: 110, y: 110 }
  const b = { x: 1090, y: 890 }
  expect(voiceVolume(a, b, rooms)).toBe(1)
  expect(voiceVolume(b, a, rooms)).toBe(1)
  expect(voiceVolume(a, { x: 1210, y: 110 }, rooms)).toBe(0)
  expect(voiceVolume(a, { x: 1100, y: 890 }, rooms)).toBe(0)
  expect(voiceVolume({ x: 0, y: 950 }, { x: 280, y: 950 }, rooms)).toBeGreaterThan(0)
  expect(voiceVolume({ x: 0, y: 950 }, { x: 320, y: 950 }, rooms)).toBe(0)
  expect(voiceVolume(a, { x: 90, y: 110 }, rooms)).toBeLessThan(1)
})

test('meeting rooms isolate both directions across every wall and connect all occupants inside', async () => {
  const { ROOMS } = await import('../public/rooms.js')
  for (const room of ROOMS.filter((r) => ['meeting', 'huddle'].includes(r.alias))) {
    const inside = { x: room.x + 1, y: room.y + 1 }
    const opposite = { x: room.x + room.w - 1, y: room.y + room.h - 1 }
    expect(voiceVolume(inside, opposite, ROOMS)).toBe(1)
    for (const outside of [
      { x: room.x - 1, y: inside.y },
      { x: inside.x, y: room.y - 1 },
      { x: room.x + room.w, y: opposite.y },
      { x: opposite.x, y: room.y + room.h },
    ]) {
      for (const occupant of [inside, opposite]) {
        expect(voiceVolume(occupant, outside, ROOMS)).toBe(0)
        expect(voiceVolume(outside, occupant, ROOMS)).toBe(0)
      }
    }
  }
})
