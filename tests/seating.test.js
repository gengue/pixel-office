import { test, expect } from 'bun:test'
import { createSeats, findSeat } from '../public/seating.js'

test('chairs, armchairs and both sofa cushions are reachable without entering a solid', () => {
  const seats = createSeats([
    ['chair', 100, 100], ['armchair', 300, 100, 70, 48],
    ['sofaH', 500, 100, 180, 66], ['desk', 800, 100],
  ])
  expect(seats).toHaveLength(4)
  const blocked = (x, y) => x > 486 && x < 694 && y > 86 && y < 180
  const rightSeat = findSeat(seats, { x: 626, y: 188 }, [], blocked)
  expect(rightSeat).toBe(seats[3])
  expect(blocked(rightSeat.entry.x, rightSeat.entry.y)).toBe(false)
  expect(findSeat(seats, { x: 626, y: 188 }, [{ ...rightSeat, sitting: true }], blocked)).toBeNull()
  expect(findSeat(seats, { x: 626, y: 188 }, [], () => true)).toBeNull()
  expect(findSeat(seats, { x: 1000, y: 1000 }, [], blocked)).toBeNull()
  expect(findSeat(seats, { x: 114, y: 130 }, [], blocked)).toBe(seats[0])
  expect(findSeat(seats, { x: 335, y: 170 }, [], blocked)).toBe(seats[1])
})
