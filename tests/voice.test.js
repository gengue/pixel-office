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
