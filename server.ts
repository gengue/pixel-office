import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const PORT = Number(process.env.PORT ?? 3000)
const PUB = join(import.meta.dir, 'public')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}

function serveFile(path: string) {
  const ext = extname(path)
  return new Response(readFileSync(path), {
    headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' },
  })
}

type Player = { id: string; name: string; body: string; x: number; y: number }
type SockData = { id: string; player: Player; tab?: string }

const sockets = new Set<any>()
const byId = new Map<string, any>()
const tabs = new Map<string, any>() // tabId -> ws (una pestaña = un player)
let seq = 0

function spawnPoint(): { x: number; y: number } {
  return { x: 120 + Math.random() * 720, y: 140 + Math.random() * 380 }
}

function broadcast(msg: unknown, except?: string) {
  const raw = JSON.stringify(msg)
  for (const ws of sockets) {
    if (except && ws.data?.id === except) continue
    try {
      ws.send(raw)
    } catch {}
  }
}

function roster() {
  return [...byId.values()].map((ws) => ws.data.player)
}

const server = Bun.serve<SockData>({
  port: PORT,
  async fetch(req, srv) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const id = `u${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
      const upgraded = srv.upgrade(req, { data: { id, player: { id, name: '', body: 'hombre', ...spawnPoint() } } })
      if (upgraded) return undefined
      return new Response('upgrade failed', { status: 500 })
    }
    let p = url.pathname === '/' ? '/index.html' : url.pathname
    const file = join(PUB, decodeURIComponent(p).replace(/\.\./g, ''))
    if (existsSync(file) && statSync(file).isFile()) return serveFile(file)
    return new Response('not found', { status: 404 })
  },
  websocket: {
    open(ws) {
      sockets.add(ws)
      byId.set(ws.data.id, ws)
    },
    message(ws, raw) {
      let msg: any
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      const me = ws.data.player
      if (msg.t === 'join') {
        const tab = String(msg.tab ?? '')
        if (tab) {
          const old = tabs.get(tab)
          if (old && old !== ws) {
            tabs.delete(tab)
            try {
              old.close()
            } catch {}
          }
          tabs.set(tab, ws)
          ws.data.tab = tab
        }
        me.name = String(msg.name ?? 'anon').slice(0, 24) || 'anon'
        me.body = String(msg.body ?? 'hombre').slice(0, 24)
        if (typeof msg.x === 'number') me.x = msg.x
        if (typeof msg.y === 'number') me.y = msg.y
        ws.send(JSON.stringify({ t: 'welcome', id: ws.data.id, roster: roster() }))
        broadcast({ t: 'peer-join', player: me }, ws.data.id)
        return
      }
      if (msg.t === 'move') {
        me.x = Math.max(0, Math.min(960, Number(msg.x) || me.x))
        me.y = Math.max(0, Math.min(600, Number(msg.y) || me.y))
        broadcast({ t: 'peer-move', id: ws.data.id, x: me.x, y: me.y }, ws.data.id)
        return
      }
      if (msg.t === 'chat') {
        const text = String(msg.text ?? '').slice(0, 500)
        if (!text.trim()) return
        broadcast({ t: 'chat', id: ws.data.id, name: me.name, text, at: Date.now() })
        return
      }
      if (msg.t === 'signal') {
        const target = byId.get(String(msg.to))
        if (target) {
          target.send(JSON.stringify({ t: 'signal', from: ws.data.id, data: msg.data }))
        }
        return
      }
    },
    close(ws) {
      sockets.delete(ws)
      byId.delete(ws.data.id)
      if (ws.data.tab && tabs.get(ws.data.tab) === ws) tabs.delete(ws.data.tab)
      broadcast({ t: 'peer-leave', id: ws.data.id })
    },
  },
})

console.log(`pixel-office en http://localhost:${server.port}`)
