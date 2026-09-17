import { test, expect } from 'bun:test'

test('one shared music timeline survives late arrivals, pauses and resumes; controls require proximity', async () => {
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
    throw Error('Shared music state did not arrive')
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
      const initial = await wait(() => messages.find((m) => m.t === 'music-state'))
      const command = async (action, extra = {}) => {
        messages.length = 0
        send({ t: 'music-command', action, ...extra })
        return wait(() => messages.find((m) => m.t === 'music-state' || m.t === 'music-error'))
      }
      return { send, command, messages, initial }
    }
    const host = await join('Host')
    expect(host.initial).toMatchObject({ videoId: 'ffnnMC-yMR0', playing: false, position: 0 })
    const playing = await host.command('load', { videoId: 'Nv2GgV34qIg' })
    expect(playing).toMatchObject({ videoId: 'Nv2GgV34qIg', playing: true, position: 0 })
    await Bun.sleep(150)
    const guest = await join('Late guest')
    expect(guest.initial.updatedAt).toBe(playing.updatedAt)
    expect(guest.initial.revision).toBe(playing.revision)
    expect(guest.initial.serverNow - playing.updatedAt).toBeGreaterThanOrEqual(140)
    const paused = await guest.command('pause')
    expect(paused.playing).toBe(false)
    expect(paused.position).toBeGreaterThan(0.14)
    await wait(() => host.messages.find((m) => m.revision === paused.revision))
    await Bun.sleep(80)
    const resumed = await host.command('play')
    expect(resumed.position).toBe(paused.position)
    expect(resumed.updatedAt).toBeGreaterThan(paused.updatedAt)
    const stillPlaying = await guest.command('play')
    expect(stillPlaying.updatedAt).toBe(resumed.updatedAt)
    expect(stillPlaying.revision).toBe(resumed.revision)
    const far = await join('Outside', 120, 360)
    expect((await far.command('pause')).t).toBe('music-error')
    expect((await host.command('load', { videoId: '<script>' })).t).toBe('music-error')
    expect((await host.command('seek', { position: Infinity })).t).toBe('music-error')
    host.messages.length = 0
    host.send({ t: 'music-sync', requestAt: 1234.5 })
    const snapshot = await wait(() => host.messages.find((m) => m.t === 'music-state'))
    expect(snapshot).toMatchObject({ requestAt: 1234.5, revision: resumed.revision, playing: true })
    const changed = await guest.command('load', { videoId: 'ffnnMC-yMR0' })
    expect(changed).toMatchObject({ videoId: 'ffnnMC-yMR0', position: 0, playing: true })
    expect((await host.command('ended', { revision: resumed.revision })).t).toBe('music-error')
    const ended = await guest.command('ended', { revision: changed.revision })
    expect(ended).toMatchObject({ position: 0, playing: false })
  } finally {
    clients.forEach((ws) => ws.close())
    server.kill()
    await server.exited
  }
}, 15000)
