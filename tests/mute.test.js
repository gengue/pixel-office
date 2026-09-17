import { test, expect } from 'bun:test'

test('microphone mute state is shared and included for late arrivals', async () => {
  const server = Bun.spawn(['bun', 'server.ts'], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdout: 'pipe', stderr: 'pipe' })
  const clients = []
  const wait = async (predicate) => {
    for (let i = 0; i < 200; i++) { const value = predicate(); if (value) return value; await Bun.sleep(10) }
    throw Error('Mute state did not arrive')
  }
  try {
    const { value } = await server.stdout.getReader().read()
    const port = new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]
    const join = async (name) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`), messages = []
      clients.push(ws)
      ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
      await wait(() => ws.readyState === 1)
      const send = (message) => ws.send(JSON.stringify(message))
      send({ t: 'join', name, x: 120, y: 360 })
      const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
      return { send, messages, welcome }
    }
    const speaker = await join('Speaker'), listener = await join('Listener')
    speaker.send({ t: 'mute', muted: true })
    expect(await wait(() => listener.messages.find((m) => m.t === 'peer-mute'))).toMatchObject({ id: speaker.welcome.id, muted: true })
    const late = await join('Late')
    expect(late.welcome.roster.find((p) => p.id === speaker.welcome.id).muted).toBe(true)
    listener.messages.length = 0
    speaker.send({ t: 'mute', muted: false })
    expect((await wait(() => listener.messages.find((m) => m.t === 'peer-mute'))).muted).toBe(false)
  } finally {
    clients.forEach((ws) => ws.close())
    server.kill()
    await server.exited
  }
}, 10000)
