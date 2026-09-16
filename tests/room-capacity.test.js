import { test, expect } from 'bun:test'
import { ROOMS, roomAt, fullRoomAt } from '../public/rooms.js'

test('four-person room enforces capacity on join, movement and sitting, and releases places', async () => {
  const room = ROOMS.find((room) => room.capacity === 4)
  const inside = { x: room.x + 60, y: room.y + 150 }
  const members = Array.from({ length: 4 }, (_, i) => ({ ...inside, id: `member-${i}` }))
  expect(fullRoomAt({ ...inside, id: 'visitor' }, members)).toBe(room)
  expect(fullRoomAt(members[0], members)).toBeNull()
  expect(fullRoomAt({ x: 120, y: 360 }, members)).toBeNull()
  const server = Bun.spawn(['bun', 'server.ts'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdout: 'pipe', stderr: 'pipe',
  })
  const clients = []
  const wait = async (predicate) => {
    for (let i = 0; i < 400; i++) {
      const value = predicate()
      if (value) return value
      await Bun.sleep(10)
    }
    throw Error('Room state did not arrive')
  }
  try {
    const { value } = await server.stdout.getReader().read()
    const port = new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]
    const join = async (name, extra = {}) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`)
      clients.push(ws)
      const messages = []
      ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
      await wait(() => ws.readyState === 1)
      const send = (message) => ws.send(JSON.stringify(message))
      send({ t: 'join', name, ...inside, ...extra })
      const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
      return { ws, send, messages, id: welcome.id, welcome }
    }
    const occupants = []
    for (let i = 0; i < 4; i++) occupants.push(await join(`Member ${i}`, { tab: `member-tab-${i}` }))
    const linked = await join('Meeting link', { destination: '?room=meeting' })
    expect(linked.welcome.roster.find((p) => p.id === linked.id)).toMatchObject(ROOMS.find((r) => r.alias === 'meeting').arrival)
    const coordinates = await join('Coordinates', { destination: '?x=1200&y=900' })
    expect(coordinates.welcome.roster.find((p) => p.id === coordinates.id)).toMatchObject({ x: 1200, y: 900 })
    for (const destination of ['?room=huddle', '?x=1940&y=810', '?room=unknown']) {
      const guest = await join('Link guest', { destination })
      expect(guest.welcome.notice).toBeTruthy()
      expect(roomAt(guest.welcome.roster.find((p) => p.id === guest.id))).toBe(0)
    }
    occupants[1] = await join('Reloaded member', { tab: 'member-tab-1', destination: '?room=huddle' })
    expect(occupants[1].welcome.notice).toBeUndefined()
    expect(roomAt(occupants[1].welcome.roster.find((p) => p.id === occupants[1].id))).toBe(ROOMS.indexOf(room))
    const visitor = await join('Visitor')
    expect(roomAt(visitor.welcome.roster.find((p) => p.id === visitor.id))).not.toBe(ROOMS.indexOf(room))
    expect(visitor.messages.filter((m) => m.t === 'move-blocked')).toHaveLength(1)
    for (const t of ['move', 'sit']) {
      visitor.send({ t, ...inside, sitting: true })
      const count = t === 'move' ? 2 : 3
      await wait(() => visitor.messages.filter((m) => m.t === 'move-blocked').length === count)
      expect(visitor.messages.findLast((m) => m.t === 'move-blocked').sitting).toBe(false)
    }
    occupants[0].send({ t: 'move', x: 1760, y: 810 })
    await wait(() => visitor.messages.some((m) => m.t === 'peer-move' && m.id === occupants[0].id))
    visitor.send({ t: 'move', ...inside })
    await wait(() => occupants[1].messages.some((m) => m.t === 'peer-move' && m.id === visitor.id && m.x === inside.x))
    visitor.ws.close()
    await wait(() => occupants[0].messages.some((m) => m.t === 'peer-leave' && m.id === visitor.id))
    occupants[0].send({ t: 'sit', ...inside, sitting: true })
    await wait(() => occupants[1].messages.some((m) => m.t === 'peer-sit' && m.id === occupants[0].id && m.sitting))
  } finally {
    clients.forEach((ws) => ws.close())
    server.kill()
    await server.exited
  }
}, 15000)
