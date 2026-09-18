import { test, expect } from 'bun:test'
import { walkFrame, movementDirection, coloredImage } from '../public/avatar-art.js'

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
