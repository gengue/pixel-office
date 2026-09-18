import { test, expect } from 'bun:test'
import { mkdtempSync, readFileSync, statSync, rmSync, unlinkSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Removing server-side authentication must fail this test even if the UI still displays an admin badge.
test('admin identity requires a private password, persists independently of names, and is revoked on logout', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pixel-admin-'))
  let server, origin
  const sockets = []
  const start = async (entry = resolve('server.ts'), mode = 'development') => {
    server = Bun.spawn(['bun', entry], { cwd: dir, env: { ...process.env, NODE_ENV: mode, HOST: '127.0.0.1', PORT: '0', WHITEBOARD_DB: join(dir, 'board.sqlite') }, stdout: 'pipe', stderr: 'pipe' })
    const { value } = await server.stdout.getReader().read()
    origin = `http://localhost:${new TextDecoder().decode(value).match(/localhost:(\d+)/)[1]}`
  }
  const wait = async (predicate) => {
    for (let i = 0; i < 200; i++) { const result = predicate(); if (result) return result; await Bun.sleep(10) }
    throw Error('Admin response timed out')
  }
  const request = (method = 'GET', cookie = '', password, requestOrigin = origin) => fetch(`${origin}/admin/session`, {
    method, headers: { Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json' },
    ...(password === undefined ? {} : { body: JSON.stringify({ password }) }),
  })
  const joinOffice = async (cookie, name) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + '/ws', { headers: { Cookie: cookie } })
    sockets.push(ws)
    const messages = []
    ws.onmessage = ({ data }) => messages.push(JSON.parse(data))
    await wait(() => ws.readyState === 1)
    ws.send(JSON.stringify({ t: 'join', name, admin: true, isAdmin: true }))
    const welcome = await wait(() => messages.find((m) => m.t === 'welcome'))
    return { ws, messages, welcome }
  }
  try {
    await start()
    expect((await fetch(`${origin}/admin`)).status).toBe(200)
    const password = readFileSync(join(dir, 'data/admin/password.txt'), 'utf8').trim()
    expect(password.length).toBeGreaterThanOrEqual(32)
    expect(statSync(join(dir, 'data/admin/password.txt')).mode & 0o777).toBe(0o600)
    expect((await fetch(`${origin}/data/admin/password.txt`)).status).toBe(404)
    expect(await (await request()).json()).toEqual({ admin: false })
    expect((await request('POST', '', 'incorrect')).status).toBe(401)
    expect((await request('POST', '', password, 'https://evil.example')).status).toBe(403)
    const login = await request('POST', '', password)
    expect(login.status).toBe(200)
    const setCookie = login.headers.get('set-cookie')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Max-Age=7776000')
    const cookie = setCookie.split(';')[0]
    expect(cookie).not.toContain(password)
    expect(await (await request('GET', cookie)).json()).toEqual({ admin: true })
    expect((await joinOffice(cookie, 'First name')).welcome.admin).toBe(true)
    expect((await joinOffice('', 'First name')).welcome.admin).toBe(false)
    expect((await joinOffice('po-admin=fake', 'Admin')).welcome.admin).toBe(false)
    sockets.forEach((ws) => ws.close())
    server.kill(); await server.exited
    await start()
    expect(readFileSync(join(dir, 'data/admin/password.txt'), 'utf8').trim()).toBe(password)
    const renamed = await joinOffice(cookie, 'Completely different name')
    expect(renamed.welcome.admin).toBe(true)
    expect((await request('DELETE', cookie, undefined, 'https://evil.example')).status).toBe(403)
    expect((await request('DELETE', cookie)).status).toBe(200)
    await wait(() => renamed.messages.some((m) => m.t === 'admin-state' && m.admin === false))
    expect(await (await request('GET', cookie)).json()).toEqual({ admin: false })
    expect((await joinOffice(cookie, 'Old cookie')).welcome.admin).toBe(false)
    const expiring = (await request('POST', '', password)).headers.get('set-cookie').split(';')[0]
    const database = new Database(join(dir, 'data/admin/sessions.sqlite'))
    database.run('UPDATE sessions SET expires = 0')
    database.close()
    expect(await (await request('GET', expiring)).json()).toEqual({ admin: false })
    const beforeRotation = (await request('POST', '', password)).headers.get('set-cookie').split(';')[0]
    sockets.forEach((ws) => ws.close())
    server.kill(); await server.exited
    unlinkSync(join(dir, 'data/admin/password.txt'))
    await start()
    expect(await (await request('GET', beforeRotation)).json()).toEqual({ admin: false })
    expect((await request('POST', '', password)).status).toBe(401)
    const rotated = readFileSync(join(dir, 'data/admin/password.txt'), 'utf8').trim()
    const httpsHeaders = { Origin: origin.replace('http:', 'https:'), 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' }
    const secureLogin = await fetch(`${origin}/admin/session`, { method: 'POST', headers: httpsHeaders, body: JSON.stringify({ password: rotated }) })
    expect(secureLogin.status).toBe(200)
    expect(secureLogin.headers.get('set-cookie')).toContain('__Host-po-admin=')
    expect(secureLogin.headers.get('set-cookie')).toContain('; Secure')
    const secureCookie = secureLogin.headers.get('set-cookie').split(';')[0]
    expect(await (await fetch(`${origin}/admin/session`, { headers: { ...httpsHeaders, Cookie: secureCookie } })).json()).toEqual({ admin: true })
    expect(await (await fetch(`${origin}/admin/session`, { headers: { ...httpsHeaders, Cookie: secureCookie.replace('__Host-po-admin', 'po-admin') } })).json()).toEqual({ admin: false })
    expect((await fetch(`${origin}/admin/session`, { method: 'POST', headers: { ...httpsHeaders, Origin: origin }, body: JSON.stringify({ password: rotated }) })).status).toBe(403)
    expect((await fetch(`${origin}/ws`, { headers: { Origin: 'https://evil.example' } })).status).toBe(403)
    expect((await request('POST', '', 'x'.repeat(5000))).status).toBe(413)
    let last
    for (let i = 0; i < 25; i++) last = await request('POST', '', 'wrong')
    expect(last.status).toBe(429)
    sockets.forEach((ws) => ws.close())
    server.kill(); await server.exited
    const build = await Bun.build({ entrypoints: [resolve('server.ts')], target: 'bun', minify: true, outdir: join(dir, 'build') })
    expect(build.success).toBe(true)
    await start(join(dir, 'build/server.js'), 'production')
    const productionLogin = await request('POST', '', rotated, origin.replace('http:', 'https:'))
    expect(productionLogin.status).toBe(200)
    expect(productionLogin.headers.get('set-cookie')).toContain('__Host-po-admin=')
    expect(productionLogin.headers.get('set-cookie')).toContain('; Secure')
  } finally {
    sockets.forEach((ws) => ws.close())
    server?.kill(); if (server) await server.exited
    rmSync(dir, { recursive: true, force: true })
  }
}, 15000)
