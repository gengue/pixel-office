import { test, expect } from 'bun:test'

test('screen sharing is limited to its audience, one presenter per room, and stops on exit', async () => {
  const server = Bun.spawn(['bun', 'server.ts'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' }, stdout: 'pipe', stderr: 'pipe',
  })
  const clients = []
  const wait = async (predicate) => {
    const deadline = Date.now() + 4000
    while (Date.now() < deadline) {
      const result = predicate()
      if (result) return result
      await Bun.sleep(10)
    }
    throw Error('Expected screen-sharing state was not received')
  }
  try {
    const { value } = await server.stdout.getReader().read()
    const port = new TextDecoder().decode(value).match(/localhost:(\d+)/)?.[1]
    expect(port).toBeTruthy()
    const join = async (name, x, y) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`)
      const messages = []
      ws.onmessage = (event) => messages.push(JSON.parse(event.data))
      clients.push(ws)
      await wait(() => ws.readyState === 1)
      const send = (message) => ws.send(JSON.stringify(message))
      send({ t: 'join', name, x, y })
      const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
      return { ws, send, messages, id: welcome.id, state: () => messages.findLast((m) => m.t === 'share-state') }
    }
    const owner = await join('Presenter', 1850, 180)
    const viewer = await join('Viewer', 2300, 440)
    const outside = await join('Outside', 1760, 180)
    owner.send({ t: 'reaction', emoji: '<script>' })
    owner.send({ t: 'reaction', emoji: '👏', id: outside.id })
    await wait(() => viewer.messages.some((m) => m.t === 'reaction'))
    const reaction = viewer.messages.find((m) => m.t === 'reaction')
    expect(reaction).toMatchObject({ id: owner.id, emoji: '👏', name: 'Presenter' })
    expect(owner.messages.filter((m) => m.t === 'reaction')).toHaveLength(1)
    owner.send({ t: 'reaction', emoji: '❤️' })
    await Bun.sleep(60)
    expect(viewer.messages.filter((m) => m.t === 'reaction')).toHaveLength(1)
    // Outside is close enough to hear the presenter, so it receives the reaction too.
    expect(outside.messages.filter((m) => m.t === 'reaction')).toHaveLength(1)
    outside.send({ t: 'move', x: 100, y: 1300 })
    await Bun.sleep(650)
    owner.send({ t: 'reaction', emoji: '🎉' })
    await wait(() => viewer.messages.filter((m) => m.t === 'reaction').length === 2)
    expect(outside.messages.filter((m) => m.t === 'reaction')).toHaveLength(1)
    outside.send({ t: 'move', x: 1760, y: 180 })
    const id = crypto.randomUUID()
    owner.send({ t: 'share-start', id, room: 2 })
    await wait(() => viewer.state()?.shares.some((s) => s.id === id))
    expect(outside.state()?.shares ?? []).toEqual([])
    expect(owner.state().viewers).toEqual([viewer.id])
    viewer.send({ t: 'share-start', id: crypto.randomUUID(), room: 2 })
    await wait(() => viewer.messages.some((m) => m.t === 'share-error'))
    owner.send({ t: 'screen-signal', id, to: viewer.id, data: { kind: 'offer', sdp: 'allowed' } })
    await wait(() => viewer.messages.some((m) => m.t === 'screen-signal'))
    outside.send({ t: 'screen-signal', id, to: owner.id, data: { kind: 'answer', sdp: 'blocked' } })
    await Bun.sleep(40)
    expect(owner.messages.some((m) => m.t === 'screen-signal')).toBe(false)
    viewer.send({ t: 'move', x: 1760, y: 440 })
    await wait(() => viewer.state()?.shares.length === 0)
    await wait(() => owner.state()?.viewers.length === 0)
    owner.send({ t: 'move', x: 1760, y: 180 })
    await wait(() => owner.state()?.shares.length === 0)
    owner.send({ t: 'share-start', id: crypto.randomUUID(), room: -1 })
    await wait(() => outside.state()?.shares.length === 1)
    owner.ws.close()
    await wait(() => outside.state()?.shares.length === 0)
  } finally {
    for (const ws of clients) ws.close()
    server.kill()
    await server.exited
  }
}, 20000)
