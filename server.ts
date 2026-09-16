import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { WORLD } from './public/world.js'
import { resolveArrival } from './public/meeting-links.js'
import { getRTCConfig } from './rtc-config'
import { normalizeAppearance } from './public/avatars.js'
import { REACTIONS } from './public/reactions.js'
import { ROOMS, roomAt, fullRoomAt } from './public/rooms.js'
import { canViewScreen, voiceVolume, LINK } from './public/voice.js'
import { musicVolume } from './public/music.js'

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

type Player = { id: string; name: string; body: string; appearance?: ReturnType<typeof normalizeAppearance>; country: string; hand: boolean; sitting: boolean; dancing: boolean; x: number; y: number }
type SockData = { id: string; player: Player; tab?: string; shareState?: string; lastReaction?: number }
type ScreenShare = { id: string; owner: string; room: number }

const sockets = new Set<any>()
const byId = new Map<string, any>()
const tabs = new Map<string, any>() // tabId -> ws (one tab = one player)
const shares = new Map<string, ScreenShare>()
let seq = 0

function spawnPoint(): { x: number; y: number } {
  return { x: 70 + Math.random() * 100, y: 330 + Math.random() * 60 }
}

function movePlayer(ws: any, x: unknown, y: unknown) {
  const me = ws.data.player
  const next = {
    ...me,
    x: typeof x === 'number' && Number.isFinite(x) ? Math.max(24, Math.min(WORLD.w - 24, x)) : me.x,
    y: typeof y === 'number' && Number.isFinite(y) ? Math.max(40, Math.min(WORLD.h - 24, y)) : me.y,
  }
  const full = fullRoomAt(next, roster().filter((p) => p.name))
  if (full) {
    ws.send(JSON.stringify({ t: 'move-blocked', x: me.x, y: me.y, sitting: !!me.sitting, room: full.label }))
    return false
  }
  if (me.dancing && (next.x !== me.x || next.y !== me.y)) setDancing(ws, false)
  me.x = next.x
  me.y = next.y
  return true
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

function setDancing(ws: any, dancing: boolean) {
  ws.data.player.dancing = dancing
  broadcast({ t: 'peer-dance', id: ws.data.id, dancing })
}

function updateShares() {
  for (const [id, share] of shares) {
    const owner = byId.get(share.owner)?.data.player
    if (!owner || roomAt(owner) !== share.room) shares.delete(id)
  }
  // ponytail: scan the small room roster; index audiences if measured room sizes require it.
  for (const ws of sockets) {
    if (!ws.data.player.name) continue
    const visible = [...shares.values()].filter((share) => canViewScreen(share, byId.get(share.owner)?.data.player, ws.data.player))
    const own = visible.find((share) => share.owner === ws.data.id)
    const viewers = own ? [...byId.values()].filter((peer) => peer !== ws && peer.data.player.name && canViewScreen(own, ws.data.player, peer.data.player)).map((peer) => peer.data.id) : []
    const message = JSON.stringify({ t: 'share-state', shares: visible, viewers })
    if (message !== ws.data.shareState) {
      ws.data.shareState = message
      ws.send(message)
    }
  }
}

const server = Bun.serve<SockData>({
  port: PORT,
  hostname: process.env.HOST ?? '0.0.0.0',
  async fetch(req, srv) {
    const url = new URL(req.url)
    if (url.pathname === '/rtc-config') {
      try {
        return Response.json(await getRTCConfig(), { headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        console.error('RTC configuration unavailable:', error instanceof Error ? error.message : 'unknown')
        return new Response('Voice/video service unavailable', { status: 503 })
      }
    }
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
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return
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
        me.appearance = normalizeAppearance(msg.appearance)
        const cc = String(msg.country ?? '').toUpperCase().slice(0, 2)
        me.country = /^[A-Z]{2}$/.test(cc) ? cc : ''
        me.hand = false
        me.sitting = false
        me.dancing = false
        const arrival = resolveArrival(msg.destination, roster().filter((p) => p.name), me.id)
        if (arrival?.point) movePlayer(ws, arrival.point.x, arrival.point.y)
        else if (!arrival) movePlayer(ws, msg.x, msg.y)
        ws.send(JSON.stringify({ t: 'welcome', id: ws.data.id, roster: roster(), notice: arrival?.notice, teleported: !!arrival?.point }))
        broadcast({ t: 'peer-join', player: me, teleported: !!arrival?.point }, ws.data.id)
        updateShares()
        return
      }
      if (msg.t === 'move') {
        if (!me.name || !movePlayer(ws, msg.x, msg.y)) return
        broadcast({ t: 'peer-move', id: ws.data.id, x: me.x, y: me.y }, ws.data.id)
        updateShares()
        return
      }
      if (msg.t === 'hand') {
        me.hand = !!msg.hand
        broadcast({ t: 'peer-hand', id: ws.data.id, hand: me.hand })
        return
      }
      if (msg.t === 'sit') {
        if (!me.name || !movePlayer(ws, msg.x, msg.y)) return
        me.sitting = !!msg.sitting
        if (me.sitting && me.dancing) setDancing(ws, false)
        broadcast({ t: 'peer-sit', id: ws.data.id, sitting: me.sitting, x: me.x, y: me.y })
        updateShares()
        return
      }
      if (msg.t === 'dance') {
        if (!me.name) return
        setDancing(ws, msg.dancing === true && !me.sitting && musicVolume(me) > 0)
        return
      }
      if (msg.t === 'share-start') {
        const room = roomAt(me)
        const conflict = [...shares.values()].some((share) => share.owner === ws.data.id || (room !== -1 && share.room === room))
        if (!me.name || typeof msg.id !== 'string' || !/^[a-f0-9-]{36}$/.test(msg.id) || shares.has(msg.id) || msg.room !== room || conflict) {
          ws.send(JSON.stringify({ t: 'share-error', id: msg.id, message: conflict ? 'Someone is already presenting in this room.' : 'Your location changed. Please share again.' }))
          return
        }
        shares.set(msg.id, { id: msg.id, owner: ws.data.id, room })
        updateShares()
        return
      }
      if (msg.t === 'share-stop') {
        if (shares.get(msg.id)?.owner === ws.data.id) shares.delete(msg.id)
        updateShares()
        return
      }
      if (msg.t === 'screen-signal') {
        const share = shares.get(msg.id)
        const target = byId.get(msg.to)
        if (!share || !target || !me.name || !target.data.player.name || !['offer', 'answer', 'ice'].includes(msg.data?.kind)) return
        const senderIsOwner = share.owner === ws.data.id
        if (!senderIsOwner && share.owner !== target.data.id) return
        if (msg.data.kind === 'offer' && !senderIsOwner) return
        if (msg.data.kind === 'answer' && senderIsOwner) return
        const owner = byId.get(share.owner)?.data.player
        const viewer = senderIsOwner ? target.data.player : me
        if (canViewScreen(share, owner, viewer)) target.send(JSON.stringify({ t: 'screen-signal', id: share.id, from: ws.data.id, data: msg.data }))
        return
      }
      if (msg.t === 'reaction') {
        const now = Date.now()
        if (!me.name || typeof msg.emoji !== 'string' || !Object.hasOwn(REACTIONS, msg.emoji) || now - (ws.data.lastReaction ?? 0) < 650) return
        ws.data.lastReaction = now
        const reaction = JSON.stringify({ t: 'reaction', id: me.id, name: me.name, emoji: msg.emoji })
        for (const peer of sockets) {
          if (peer.data.player.name && voiceVolume(me, peer.data.player, ROOMS) > 0) peer.send(reaction)
        }
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
        if (me.name && target?.data.player.name && ['offer', 'answer', 'ice'].includes(msg.data?.kind) &&
          (voiceVolume(me, target.data.player, ROOMS) > 0 || Math.hypot(me.x - target.data.player.x, me.y - target.data.player.y) <= LINK + 90)) {
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
      updateShares()
    },
  },
})

console.log(`Pixel Office at http://localhost:${server.port}`)
