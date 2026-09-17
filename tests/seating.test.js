import { test, expect } from 'bun:test'
import { createSeats, findSeat } from '../public/seating.js'

test('chairs, armchairs, sofa cushions and toilets are reachable without entering a solid', () => {
  const seats = createSeats([
    ['chair', 100, 100], ['armchair', 300, 100, 70, 48],
    ['sofaH', 500, 100, 180, 66], ['desk', 800, 100], ['toilet', 1000, 100, 48, 50],
  ])
  expect(seats).toHaveLength(5)
  const blocked = (x, y, seat) => seat?.obstacle.x !== 500 && x > 486 && x < 694 && y > 86 && y < 180
  const rightSeat = findSeat(seats, { x: 626, y: 188 }, [], blocked)
  expect(rightSeat).toBe(seats[3])
  expect(blocked(rightSeat.entry.x, rightSeat.entry.y)).toBe(false)
  expect(findSeat(seats, { x: 626, y: 188 }, [{ ...rightSeat, sitting: true }], blocked)).toBe(seats[2])
  expect(findSeat(seats, { x: 626, y: 188 }, [], () => true)).toBeNull()
  expect(findSeat(seats, { x: 1000, y: 1000 }, [], blocked)).toBeNull()
  expect(findSeat(seats, { x: 114, y: 130 }, [], blocked)).toBe(seats[0])
  expect(findSeat(seats, { x: 335, y: 170 }, [], blocked)).toBe(seats[1])
  const toilet = seats[4]
  const toiletBlocked = (x, y, seat) => seat?.obstacle.x !== 1000 && x > 986 && x < 1062 && y > 86 && y < 164
  expect(toilet).toMatchObject({ x: 1024, y: 122, entry: { x: 1024, y: 170 } })
  expect(findSeat(seats, toilet.entry, [], toiletBlocked)).toBe(toilet)
  expect(findSeat(seats, toilet.entry, [{ ...toilet, sitting: true }], toiletBlocked)).toBeNull()
  expect(findSeat(seats, { x: 980, y: 160 }, [], toiletBlocked)).toBe(toilet)
})

test('seats stay available from either side and when touching them, without reaching through walls', async () => {
  const { furn, hitsSolid, BODY_R } = await import('../public/world.js')
  const chair = createSeats(furn.filter(([type, x, y]) => type === 'armchair' && x === 450 && y === 1310))
  const blocked = (x, y, seat) => hitsSolid(x, y, BODY_R, seat?.obstacle)
  for (const position of [{ x: 430, y: 1330 }, { x: 534, y: 1330 }, { x: 484, y: 1320 }, { x: 484, y: 1350 }, { x: 484, y: 1370 }]) {
    expect(findSeat(chair, position, [], blocked)).toBe(chair[0])
  }
  expect(findSeat(chair, { x: 430, y: 1330 }, [{ ...chair[0], sitting: true }], blocked)).toBeNull()
  expect(findSeat(chair, { x: 430, y: 1330 }, [], () => true)).toBeNull()
  const toilet = createSeats(furn.filter(([type, x]) => type === 'toilet' && x === 130))
  expect(findSeat(toilet, { x: 150, y: 680 }, [], blocked)).toBeNull()
})
