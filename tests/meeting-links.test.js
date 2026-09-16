import { test, expect } from 'bun:test'
import { parseDestination, resolveArrival, meetingURL } from '../public/meeting-links.js'
import { ROOMS, roomAt } from '../public/rooms.js'
import { hitsSolid } from '../public/world.js'

test('meeting links resolve stable room aliases or finite coordinates and find a safe arrival', () => {
  expect(parseDestination('?utm_source=calendar')).toBeNull()
  for (const room of ROOMS.filter((r) => r.alias)) {
    const search = `?room=${room.alias}`
    const arrival = resolveArrival(search)
    expect(arrival.point).toEqual(room.arrival)
    expect(roomAt(arrival.point)).toBe(ROOMS.indexOf(room))
    expect(hitsSolid(arrival.point.x, arrival.point.y)).toBe(false)
    expect(meetingURL('https://example.com/?room=wrong#old', room.alias)).toBe(`https://example.com/?room=${room.alias}`)
  }
  expect(parseDestination('?room=meeting&x=0&y=0').point).toEqual(ROOMS[2].arrival)
  expect(resolveArrival('?x=1200&y=900').point).toEqual({ x: 1200, y: 900 })
  expect(meetingURL('https://example.com:8443/', { x: 1200.2, y: 899.8 })).toBe('https://example.com:8443/?x=1200&y=900')
  for (const query of ['?room=unknown', '?room=', '?x=10', '?x=&y=10', '?x=NaN&y=50', '?x=Infinity&y=20', '?x=-1&y=40', '?x=2401&y=40']) {
    expect(resolveArrival(query).notice).toBeTruthy()
    expect(resolveArrival(query).point).toBeUndefined()
  }
  for (const query of ['?x=2070&y=300', '?x=0&y=0', '?x=2400&y=1600', '?x=154&y=762']) {
    const arrival = resolveArrival(query)
    expect(arrival.point).toBeTruthy()
    expect(hitsSolid(arrival.point.x, arrival.point.y)).toBe(false)
  }
  const occupants = [{ id: 'first', ...ROOMS[2].arrival }]
  const second = resolveArrival('?room=meeting', occupants, 'second').point
  expect(Math.hypot(second.x - occupants[0].x, second.y - occupants[0].y)).toBeGreaterThanOrEqual(28)
  expect(roomAt(second)).toBe(2)
  const huddle = ROOMS.find((r) => r.alias === 'huddle')
  const full = Array.from({ length: 4 }, (_, i) => ({ id: `member-${i}`, ...huddle.arrival }))
  expect(resolveArrival('?room=huddle', full, 'visitor').notice).toContain('full')
  expect(resolveArrival('?x=1940&y=810', full, 'visitor').point).toBeUndefined()
})
