import { test, expect } from 'bun:test'
import { walkFrame, movementDirection, coloredImage, transformDanceHead } from '../public/avatar-art.js'

test('detailed avatars keep four poses with a slower lateral cadence and retain direction at rest', () => {
  const changes = direction => {
    let last = 0, count = 0
    const poses = new Set()
    for (let i = 0; i <= 1000; i++) {
      const frame = walkFrame(i / 100, direction)
      poses.add(frame)
      if (frame !== last) count++
      last = frame
    }
    expect(poses.size).toBe(4)
    return count
  }
  expect(changes('front')).toBe(8)
  expect(changes('back')).toBe(8)
  expect(changes('right')).toBe(7)
  expect(changes('left')).toBe(7)
  expect(movementDirection(10, 2)).toBe('right')
  expect(movementDirection(-10, 2)).toBe('left')
  expect(movementDirection(2, -10)).toBe('back')
  expect(movementDirection(2, 10)).toBe('front')
  expect(movementDirection(0, 0, 'back')).toBe('back')
})

test('recoloring nine atlas variants is cached across animation frames', () => {
  const previous = globalThis.document
  let allocations = 0
  globalThis.document = { createElement() {
    allocations++
    return { getContext() { return { drawImage() {}, getImageData() { return { data:new Uint8ClampedArray(0) } }, putImageData() {} } } }
  } }
  try {
    const images = Array.from({ length:9 }, (_, i) => ({ src:`asset-${i}`, width:1280, height:1280 }))
    for (let frame = 0; frame < 2; frame++) for (const image of images) coloredImage(image, '#568fae', 'robot')
    expect(allocations).toBe(9)
  } finally {
    if (previous === undefined) delete globalThis.document
    else globalThis.document = previous
  }
})


test('only a dancing ghost headbangs, with a fixed collar and static reduced motion', () => {
  const calls = []
  const ctx = { translate:(...args) => calls.push(['translate', ...args]), rotate:a => calls.push(['rotate', a]), scale:(...args) => calls.push(['scale', ...args]) }
  for (const kind of ['hombre', 'mujer', 'orco', 'lagarto', 'robot']) transformDanceHead(ctx, kind, true, false, .125, 50, 80)
  transformDanceHead(ctx, 'fantasma', false, false, .125, 50, 80)
  transformDanceHead(ctx, 'fantasma', true, true, .125, 50, 80)
  transformDanceHead(ctx, 'fantasma', true, false, 0, 50, 80)
  expect(calls).toEqual([])
  transformDanceHead(ctx, 'fantasma', true, false, .125, 50, 80)
  expect(calls[0]).toEqual(['translate', 50, 96])
  expect(calls[1][1]).toBeCloseTo(.4)
  expect(calls[2][2]).toBeCloseTo(.89)
  expect(calls[3]).toEqual(['translate', -50, -96])
})
