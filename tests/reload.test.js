import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('only a current admin can request a reload, and resumed players retain their state', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixel-reload-'))
  const server = Bun.spawn(['bun', resolve('server.ts')], { cwd: dir, env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '0', WHITEBOARD_DB: join(dir, 'board.sqlite') }, stdout: 'pipe', stderr: 'pipe' })
  const clients = []
  const wait = async (predicate) => {
    for (let i = 0; i < 200; i++) { const value = predicate(); if (value) return value; await Bun.sleep(10) }
    throw Error('Reload response timed out')
  }
  try {
    const { value } = await server.stdout.getReader().read()
    const origin = `http://localhost:${new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]}`
    const request = (cookie = '', requestOrigin = origin, method = 'POST') => fetch(`${origin}/admin/reload`, { method, headers: { Cookie: cookie, Origin: requestOrigin } })
    expect((await request()).status).toBe(403)
    const password = readFileSync(join(dir, 'data/admin/password.txt'), 'utf8').trim()
    const login = await fetch(`${origin}/admin/session`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    const cookie = login.headers.get('set-cookie').split(';')[0]
    const client = async (state) => {
      const ws = new WebSocket(origin.replace('http:', 'ws:') + '/ws')
      const messages = []
      clients.push(ws)
      ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
      await wait(() => ws.readyState === 1)
      ws.send(JSON.stringify({ t: 'join', ...state }))
      const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
      return { ws, messages, welcome }
    }
    const state = { name: 'Returning artist', body: 'orco', x: 1120, y: 430, muted: true, hand: true, appearance: { color: 'ocean', accessory: 'scarf' } }
    const a = await client(state), b = await client({ name: 'Guest', x: 400, y: 400 })
    expect((await request(cookie, 'https://evil.example')).status).toBe(403)
    expect((await request(cookie, origin, 'GET')).status).toBe(405)
    a.ws.send(JSON.stringify({ t: 'office-reload', admin: true }))
    const response = await request(cookie)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ notified: 2 })
    await wait(() => a.messages.some((m) => m.t === 'office-reload') && b.messages.some((m) => m.t === 'office-reload'))
    expect(a.messages.filter((m) => m.t === 'office-reload')).toHaveLength(1)
    expect((await request(cookie)).status).toBe(429)
    a.ws.close()
    const resumed = await client(state)
    expect(resumed.welcome.roster.find((p) => p.id === resumed.welcome.id)).toMatchObject({ name: state.name, body: state.body, appearance: state.appearance, x: state.x, y: state.y, muted: true, hand: true })
    const seated = await client({ name: 'Seated', x: 891, y: 320, sitting: true, muted: false })
    expect(seated.welcome.roster.find((p) => p.id === seated.welcome.id).sitting).toBe(true)
    await fetch(`${origin}/admin/session`, { method: 'DELETE', headers: { Origin: origin, Cookie: cookie } })
    expect((await request(cookie)).status).toBe(403)
    for (const path of ['/', '/app.js', '/styles.css']) expect((await fetch(origin + path)).headers.get('cache-control')).toBe('no-store')
  } finally {
    clients.forEach((ws) => ws.close())
    server.kill(); await server.exited
    rmSync(dir, { recursive: true, force: true })
  }
}, 15000)
