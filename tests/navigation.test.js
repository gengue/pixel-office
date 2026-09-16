import { test, expect } from 'bun:test'
import { pathToPerson, clearSegment } from '../public/navigation.js'
import { hitsSolid, furn } from '../public/world.js'
import { createSeats } from '../public/seating.js'

test('walks around office obstacles to people and seated people, respecting capacity', () => {
  const start = { id: 'me', x: 650, y: 450 }
  for (const target of [{ x: 1850, y: 330 }, { x: 1940, y: 810 }, { x: 1200, y: 1050 }, ...createSeats(furn)]) {
    const path = pathToPerson(start, target)
    expect(path).not.toBeNull()
    let previous = start
    for (const p of path) {
      expect(clearSegment(previous, p)).toBe(true)
      expect(hitsSolid(p.x, p.y)).toBe(false)
      previous = p
    }
    expect(Math.hypot(previous.x - target.x, previous.y - target.y)).toBeLessThanOrEqual(80)
  }
  expect(pathToPerson(start, { x: 1940, y: 810 }, Array.from({ length: 4 }, (_, id) => ({ id, x: 1940, y: 810 })))).toBeNull()
  expect(pathToPerson({ x: 1800, y: 330 }, { x: 1850, y: 330 })).toEqual([])
})
