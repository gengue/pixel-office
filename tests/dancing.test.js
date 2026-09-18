import { test, expect } from 'bun:test'
import { drawBody } from '../public/avatars.js'

test('legacy fallback dance raises and alternates limbs without changing the seated pose', () => {
  const render = (dancing, time, sitting = false) => {
    const pixels = []
    drawBody({ fillRect: (...rect) => pixels.push(rect) }, 'hombre', 0, 0, 4, 0, sitting, { dancing, time })
    return pixels
  }
  expect(render(true, 0)).not.toEqual(render(false, 0))
  expect(render(true, 0.25)).not.toEqual(render(true, 0))
  expect(render(true, 0, true)).toEqual(render(false, 0, true))
})

test('dance is shared, limited to music range, and ends on movement or sitting', async () => {
  const server = Bun.spawn(['bun', 'server.ts'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdout: 'pipe', stderr: 'pipe',
  })
  const clients = []
  const wait = async (predicate) => {
    for (let i = 0; i < 200; i++) {
      const value = predicate()
      if (value) return value
      await Bun.sleep(10)
    }
    throw Error('Dance state did not arrive')
  }
  try {
    const { value } = await server.stdout.getReader().read()
    const port = new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]
    const join = async (name, x = 474, y = 1370) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`)
      clients.push(ws)
      const messages = []
      ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
      await wait(() => ws.readyState === 1)
      const send = (message) => ws.send(JSON.stringify(message))
      send({ t: 'join', name, x, y })
      const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
      return { send, messages, id: welcome.id, welcome }
    }
    const dancer = await join('Dancer', 120, 360)
    const dance = async (value) => {
      dancer.messages.length = 0
      dancer.send({ t: 'dance', dancing: value })
      return (await wait(() => dancer.messages.find((m) => m.t === 'peer-dance'))).dancing
    }
    expect(await dance(true)).toBe(false)
    dancer.send({ t: 'move', x: 474, y: 1370 })
    expect(await dance(true)).toBe(true)
    const watcher = await join('Watcher')
    expect(watcher.welcome.roster.find((p) => p.id === dancer.id).dancing).toBe(true)
    dancer.send({ t: 'move', x: 474, y: 1370 })
    await wait(() => watcher.messages.find((m) => m.t === 'peer-move' && m.id === dancer.id))
    const late = await join('Late arrival')
    expect(late.welcome.roster.find((p) => p.id === dancer.id).dancing).toBe(true)
    dancer.send({ t: 'move', x: 480, y: 1370 })
    await wait(() => watcher.messages.find((m) => m.t === 'peer-dance' && m.id === dancer.id && !m.dancing))
    expect(await dance(true)).toBe(true)
    dancer.messages.length = 0
    dancer.send({ t: 'sit', sitting: true, x: 480, y: 1370 })
    expect((await wait(() => dancer.messages.find((m) => m.t === 'peer-dance'))).dancing).toBe(false)
    expect(await dance(true)).toBe(false)
    dancer.send({ t: 'sit', sitting: false, x: 480, y: 1370 })
    expect(await dance('true')).toBe(false)
    expect(await dance(true)).toBe(true)
    expect(await dance(false)).toBe(false)
    dancer.send({ t: 'move', x: 670, y: 1450 })
    expect(await dance(true)).toBe(false)
  } finally {
    clients.forEach((ws) => ws.close())
    server.kill()
    await server.exited
  }
}, 15000)
