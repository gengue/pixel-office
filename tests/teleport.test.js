import { test, expect } from 'bun:test'
import { drawTeleport, TELEPORT_DURATION } from '../public/teleport.js'

test('teleport effect expires, restores canvas state, and reduces motion to a static halo', () => {
  const calls = []
  const ctx = new Proxy({}, { get: (_, name) => (...args) => {
    calls.push([name, ...args])
    if (name === 'createLinearGradient') return { addColorStop() {} }
  } })
  const arrival = { x: 1850, y: 330, started: 100 }
  expect(drawTeleport(ctx, arrival, 99)).toBe(true)
  expect(calls).toHaveLength(0)
  expect(drawTeleport(ctx, arrival, 650)).toBe(true)
  expect(calls.filter(([name]) => name === 'fillRect')).toHaveLength(19)
  expect(calls.at(-1)[0]).toBe('restore')
  calls.length = 0
  expect(drawTeleport(ctx, arrival, 100 + TELEPORT_DURATION)).toBe(false)
  expect(calls).toHaveLength(0)
  expect(drawTeleport(ctx, arrival, 200, true)).toBe(true)
  const first = [...calls]
  calls.length = 0
  expect(drawTeleport(ctx, arrival, 600, true)).toBe(true)
  expect(calls).toEqual(first)
  expect(calls.filter(([name]) => name === 'fillRect')).toHaveLength(0)
  expect(drawTeleport(ctx, arrival, 800, true)).toBe(false)
})
