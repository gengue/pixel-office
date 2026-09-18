import { test, expect } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nearBoard, validBoardOperation } from '../public/whiteboard.js'

const wait = async (predicate) => {
  for (let i = 0; i < 200; i++) {
    const value = predicate()
    if (value) return value
    await Bun.sleep(10)
  }
  throw Error('Whiteboard response timed out')
}

test('shared drawings, erasing and text persist through restart; distant and invalid edits are rejected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixel-whiteboard-'))
  const clients = []
  let server
  const start = async () => {
    server = Bun.spawn(['bun', 'server.ts'], { env: { ...process.env, HOST: '127.0.0.1', PORT: '0', WHITEBOARD_DB: join(dir, 'board.sqlite') }, stdout: 'pipe', stderr: 'pipe' })
    const { value } = await server.stdout.getReader().read()
    return new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]
  }
  const connect = async (port, x = 2090, y = 160) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`)
    clients.push(ws)
    const messages = []
    ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
    await wait(() => ws.readyState === 1)
    const send = (m) => ws.send(JSON.stringify(m))
    send({ t: 'join', name: 'Artist', x, y })
    await wait(() => messages.find((m) => m.t === 'welcome'))
    const request = async (m) => {
      messages.length = 0
      send(m)
      return wait(() => messages.find((m) => m.t.startsWith('board-')))
    }
    return { messages, send, request }
  }
  try {
    const port = await start()
    const a = await connect(port), b = await connect(port)
    expect((await a.request({ t: 'board-open' })).operations).toEqual([])
    await b.request({ t: 'board-open' })
    const pen = { id: crypto.randomUUID(), tool: 'pen', color: '#4338ca', size: 6, points: [[10, 20], [40, 80]] }
    const eraser = { ...pen, id: crypto.randomUUID(), tool: 'eraser', size: 32 }
    const text = { id: crypto.randomUUID(), tool: 'text', color: '#ee4400', size: 28, at: [100, 100], text: 'Hello team <script>' }
    const saved = [pen, eraser, text]
    await Promise.all([a.request({ t: 'board-operation', op: pen }), b.request({ t: 'board-operation', op: eraser })])
    await wait(() => a.messages.filter((m) => m.t === 'board-operation').length === 2 && b.messages.filter((m) => m.t === 'board-operation').length === 2)
    await a.request({ t: 'board-operation', op: text })
    await wait(() => b.messages.some((m) => m.op?.id === text.id))
    for (const op of [{ ...pen, points: [[-1, 0]] }, { ...pen, points: Array(513).fill([0, 0]) }, { ...text, text: 'x'.repeat(201) }, { ...pen, size: 100 }, { ...pen, color: 'red' }]) {
      expect(validBoardOperation(op)).toBe(false)
      expect((await a.request({ t: 'board-operation', op })).t).toBe('board-error')
    }
    const far = await connect(port, 120, 360)
    expect((await far.request({ t: 'board-open' })).t).toBe('board-error')
    a.send({ t: 'move', x: 120, y: 360 })
    expect((await a.request({ t: 'board-operation', op: { ...pen, id: crypto.randomUUID() } })).t).toBe('board-error')
    expect(nearBoard({ x: 2090, y: 40 })).toBe(false)
    clients.forEach((ws) => ws.close())
    server.kill()
    await server.exited
    const reopened = await connect(await start())
    const snapshot = await reopened.request({ t: 'board-open' })
    expect(snapshot.operations).toHaveLength(3)
    expect(snapshot.operations).toEqual(expect.arrayContaining(saved))
  } finally {
    clients.forEach((ws) => ws.close())
    server?.kill()
    if (server) await server.exited
    rmSync(dir, { recursive: true, force: true })
  }
}, 15000)
