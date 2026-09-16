import { test, expect } from 'bun:test'
import * as avatars from '../public/avatars.js'

test('avatar choices are validated and walking changes the limbs instead of only bouncing', () => {
  expect(typeof avatars.normalizeAppearance).toBe('function')
  expect(avatars.normalizeAppearance(null)).toEqual({ color: 'original', accessory: 'none' })
  expect(avatars.normalizeAppearance({ color: 'rose', accessory: 'scarf', extra: 'ignored' })).toEqual({ color: 'rose', accessory: 'scarf' })
  expect(avatars.normalizeAppearance({ color: '__proto__', accessory: '<script>' })).toEqual({ color: 'original', accessory: 'none' })
  const render = (walk, motion, appearance = {}) => {
    const pixels = []
    const ctx = { fillStyle: '', fillRect(x, y, w, h) { pixels.push({ x, y, w, h, color: this.fillStyle }) } }
    avatars.drawBody(ctx, 'hombre', 0, 0, 4, walk, false, { motion, appearance })
    return pixels
  }
  const standing = render(0, 0)
  const walking = render(Math.PI / 2, 1)
  const offsets = new Set(walking.map((pixel, i) => pixel.y - standing[i].y))
  expect(offsets.size).toBeGreaterThan(1)
  expect(render(0, 0, { color: 'rose', accessory: 'scarf' })).not.toEqual(standing)
  expect(render(Math.PI / 2, 0)).toEqual(standing)
})
