import { pathToPerson } from './navigation.js'
import { WORLD, BODY_R, walls, furn, hitsSolid } from './world.js'
import { parseDestination, meetingURL } from './meeting-links.js'
import { BODIES, BODY_KINDS, OUTFIT_COLORS, ACCESSORIES, normalizeAppearance, drawBody, renderPreview } from './avatars.js'
import { createOfficeArt } from './office-art.js'
import { createSeats, findSeat } from './seating.js'
import { addRemoteIce, setRemoteDescription } from './rtc.js'
import { LINK, voiceVolume } from './voice.js'
import { ROOMS as floors, fullRoomAt } from './rooms.js'
import { REACTIONS } from './reactions.js'
import { setupScreenShare } from './screen-share.js'
import { setupMusic } from './music.js'

const VIEW = { w: 960, h: 600 }
const cam = { x: 0, y: 0 }
const seats = createSeats(furn)
const SPEED = 210
const HEAD_ZOOM = 1.45 // face crop: higher = tighter on face, less background

const $ = (id) => document.getElementById(id)
const canvas = $('map')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
const officeArt = createOfficeArt(WORLD, floors, walls, furn)
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect
  if (!width || !height) return
  // Reveal more of the world as the viewport grows, without stretching sprites.
  const scale = Math.max(1, width / WORLD.w, height / WORLD.h)
  VIEW.w = canvas.width = Math.max(1, Math.round(width / scale))
  VIEW.h = canvas.height = Math.max(1, Math.round(height / scale))
  ctx.imageSmoothingEnabled = false
  cam.x = Math.max(0, Math.min(WORLD.w - VIEW.w, cam.x))
  cam.y = Math.max(0, Math.min(WORLD.h - VIEW.h, cam.y))
}).observe($('canvasWrap'))

// ---------- lobby ----------
const store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem('po-profile') ?? '{}')
    } catch {
      return {}
    }
  },
  set(p) {
    try {
      localStorage.setItem('po-profile', JSON.stringify(p))
    } catch {}
  },
}
let picked = 'hombre'
let appearance = normalizeAppearance(store.get()?.appearance)
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
{
  const saved = store.get()
  if (BODY_KINDS.includes(saved.body)) picked = saved.body
  if (typeof saved.name === 'string' && saved.name.trim()) {
    $('name').value = saved.name.slice(0, 24)
  }
}
const saveProfile = () => store.set({ name: $('name').value.trim(), body: picked, appearance })
$('name').addEventListener('input', saveProfile)
const bodiesEl = $('bodies')
for (const kind of BODY_KINDS) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'bodyOpt' + (kind === picked ? ' sel' : '')
  b.dataset.kind = kind
  b.setAttribute('aria-pressed', String(kind === picked))
  const c = document.createElement('canvas')
  renderPreview(c, kind, appearance)
  const s = document.createElement('span')
  s.textContent = BODIES[kind].label
  b.append(c, s)
  b.onclick = () => {
    picked = kind
    for (const el of bodiesEl.children) {
      el.classList.toggle('sel', el === b)
      el.setAttribute('aria-pressed', String(el === b))
      renderPreview(el.querySelector('canvas'), el.dataset.kind, appearance)
    }
    saveProfile()
  }
  bodiesEl.append(b)
}
const refreshAppearance = () => {
  for (const el of bodiesEl.children) renderPreview(el.querySelector('canvas'), el.dataset.kind, appearance)
  for (const el of $('outfitColors').children) el.setAttribute('aria-pressed', String(el.dataset.color === appearance.color))
  saveProfile()
}
for (const [color, outfit] of Object.entries(OUTFIT_COLORS)) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'swatch'
  button.dataset.color = color
  button.title = outfit.label
  button.setAttribute('aria-label', outfit.label)
  button.setAttribute('aria-pressed', String(color === appearance.color))
  button.style.background = outfit.C ?? 'linear-gradient(135deg, #568fae 50%, #c87985 50%)'
  button.onclick = () => { appearance.color = color; refreshAppearance() }
  $('outfitColors').append(button)
}
for (const [value, label] of Object.entries(ACCESSORIES)) $('accessory').add(new Option(label, value))
$('accessory').value = appearance.accessory
$('accessory').onchange = () => { appearance.accessory = $('accessory').value; refreshAppearance() }

let localStream = null

// ---------- state ----------
let ws = null
let myId = null
const tabId =
  sessionStorage.getItem('po-tab') ?? crypto.randomUUID?.() ?? String(Math.random())
sessionStorage.setItem('po-tab', tabId)
const me = { name: 'anon', body: picked, appearance, country: '', hand: false, sitting: false, x: 120, y: 360, tx: null, ty: null, walk: 0, moving: false, motion: 0, facing: 1 }
const music = setupMusic(() => me)
const peers = new Map() // id -> {id,name,body,x,y,walk,moving,videoEl}
window.__po = { me, cam, peers, WORLD, VIEW }
const pcs = new Map() // id -> RTCPeerConnection
const keys = new Set()
let muted = false
const bubbles = new Map() // bubbleId -> {el, pid, until}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// country from public IP (server only sees the proxy, so browser looks it up)
async function lookupCountry() {
  const valid = (v) => /^[A-Z]{2}$/.test(String(v ?? '').toUpperCase().trim())
  const clean = (v) => String(v).toUpperCase().trim()
  const get = async (url, pick) => {
    const ctl = new AbortController()
    const to = setTimeout(() => ctl.abort(), 5000)
    try {
      const r = await fetch(url, { signal: ctl.signal })
      const v = clean(await pick(r))
      return valid(v) ? v : ''
    } catch {
      return ''
    } finally {
      clearTimeout(to)
    }
  }
  me.country =
    (await get('https://ipwho.is/?fields=country_code', (r) => r.json().then((j) => j?.country_code))) ||
    (await get('https://ipapi.co/country/', (r) => r.text()))
}
const countryReady = lookupCountry()

const flag = (cc) =>
  /^[A-Z]{2}$/.test(cc ?? '')
    ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
    : ''
let regionName = null
try {
  regionName = new Intl.DisplayNames([navigator.language], { type: 'region' })
} catch {}
const countryName = (cc) => {
  try {
    return regionName?.of(cc) ?? cc
  } catch {
    return cc
  }
}

// ---------- chat: escape + linkify ----------
function linkify(raw) {
  const esc = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return esc.replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (m) => {
    const href = m.startsWith('http') ? m : `https://${m}`
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>`
  })
}

function addHistory(name, text, at) {
  const d = document.createElement('div')
  d.className = 'msg'
  const t = new Date(at).toLocaleTimeString()
  d.innerHTML = `<b></b><time>${t}</time><p>${linkify(text)}</p>`
  d.querySelector('b').textContent = name
  const h = $('history')
  h.append(d)
  h.scrollTop = h.scrollHeight
}

function addBubble(pid, text) {
  const el = document.createElement('div')
  el.className = 'bubble'
  const inner = document.createElement('div')
  inner.className = 'clamp'
  inner.textContent = text
  el.append(inner)
  el.title = 'click to expand'
  el.onclick = () => el.classList.toggle('open')
  $('bubbles').append(el)
  const id = Math.random().toString(36).slice(2)
  bubbles.set(id, { el, pid, until: Date.now() + 8000 })
  setTimeout(() => {
    el.remove()
    bubbles.delete(id)
  }, 8000)
}

// ---------- websocket ----------
function setStatus(t, busy = false) {
  const el = $('joinStatus')
  el.textContent = t
  el.classList.toggle('busy', busy)
}

function failJoin(msg) {
  const btn = $('joinBtn')
  btn.disabled = false
  btn.textContent = 'enter office →'
  setStatus('')
  $('lobbyErr').textContent = msg
}

function enterStage() {
  if (!$('stage').hidden) return
  setStatus('')
  $('lobby').classList.add('leaving')
  setTimeout(() => {
    $('lobby').hidden = true
  }, 300)
  $('stage').hidden = false
  $('meLabel').textContent = me.name
  refreshRoster()
}

function connect() {
  // drop previous connection: one tab = one player (avoids ghost twin)
  try {
    ws?.close()
  } catch {}
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  ws.onopen = () => {
    setStatus('joining…', true)
    send({ t: 'join', tab: tabId, name: me.name, body: me.body, appearance: me.appearance, country: me.country, x: me.x, y: me.y, destination: location.search })
  }
  ws.onerror = () => failJoin('Could not reach the server. Check your connection and try again.')
  ws.onclose = () => {
    cancelVisit()
    screenShare.reset()
    music.pause()
    if (!$('stage').hidden && !myId) failJoin('Connection lost before entering. Try again.')
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.t === 'welcome') {
      myId = m.id
      me.id = myId
      setStatus('')
      for (const p of m.roster) {
        if (p.id !== myId) upsertPeer(p)
        else Object.assign(me, { x: p.x, y: p.y, tx: null, ty: null })
      }
      cam.x = Math.max(0, Math.min(WORLD.w - VIEW.w, me.x - VIEW.w / 2))
      cam.y = Math.max(0, Math.min(WORLD.h - VIEW.h, me.y - VIEW.h / 2))
      enterStage()
      if (m.notice) showRoomNotice(m.notice)
    } else if (m.t === 'peer-join') {
      if (m.player.id !== myId) upsertPeer(m.player)
      refreshRoster()
    } else if (m.t === 'peer-move') {
      if (m.id === myId) return
      const p = peers.get(m.id)
      if (p) {
        p.tx = m.x
        p.ty = m.y
      }
    } else if (m.t === 'move-blocked') {
      cancelVisit()
      Object.assign(me, { x: m.x, y: m.y, tx: null, ty: null, sitting: m.sitting })
      showRoomNotice(`${m.room} is full`)
    } else if (m.t === 'peer-leave') {
      peers.delete(m.id)
      closePC(m.id)
      for (const [bid, b] of bubbles) {
        if (b.pid === m.id) {
          b.el.remove()
          bubbles.delete(bid)
        }
      }
      refreshRoster()
    } else if (m.t === 'peer-hand') {
      if (m.id === myId) return
      const p = peers.get(m.id)
      if (p) {
        p.hand = !!m.hand
        refreshRoster()
      }
    } else if (m.t === 'peer-sit') {
      if (m.id === myId) return
      const p = peers.get(m.id)
      if (p) {
        p.sitting = !!m.sitting
        p.x = m.x
        p.y = m.y
        p.tx = m.x
        p.ty = m.y
        refreshRoster()
      }
    } else if (m.t === 'chat') {
      addHistory(m.name, m.text, m.at)
      addBubble(m.id, m.text)
    } else if (m.t === 'reaction') {
      showReaction(m)
    } else if (m.t === 'signal') {
      onSignal(m.from, m.data).catch((error) => {
        console.warn('Call negotiation failed:', error.name)
        closePC(m.from)
      })
    } else if (['share-state', 'share-error', 'screen-signal'].includes(m.t)) {
      void screenShare.onMessage(m)
    }
  }
}

function upsertPeer(p) {
  if (!peers.has(p.id)) peers.set(p.id, { ...p, appearance: normalizeAppearance(p.appearance), tx: p.x, ty: p.y, walk: 0, moving: false, motion: 0, facing: 1, videoEl: null })
  else Object.assign(peers.get(p.id), { name: p.name, body: p.body, appearance: normalizeAppearance(p.appearance), country: p.country ?? '', hand: !!p.hand, sitting: !!p.sitting })
}

const send = (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o))

function positionReactions() {
  const picker = $('reactionPicker')
  if (!picker.matches(':popover-open')) return
  const button = $('reactionBtn').getBoundingClientRect()
  picker.style.left = `${Math.max(12, Math.min(innerWidth - picker.offsetWidth - 12, button.left + button.width / 2 - picker.offsetWidth / 2))}px`
  picker.style.top = `${button.top - picker.offsetHeight - 14}px`
}
$('reactionPicker').addEventListener('toggle', positionReactions)
addEventListener('resize', positionReactions)
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--dock-height', `${$('callDock').offsetHeight}px`)
  positionReactions()
}).observe($('callDock'))

let lastReaction = 0
for (const [emoji, label] of Object.entries(REACTIONS)) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = emoji
  button.setAttribute('aria-label', label)
  button.title = label
  button.onclick = () => {
    if (Date.now() - lastReaction < 650) return
    lastReaction = Date.now()
    send({ t: 'reaction', emoji })
  }
  $('reactionChoices').append(button)
}
function showReaction({ id, name, emoji }) {
  if (!Object.hasOwn(REACTIONS, emoji)) return
  const key = `reaction-${id}`
  bubbles.get(key)?.el.remove()
  const el = document.createElement('div')
  el.className = 'avatarReaction'
  el.textContent = emoji
  el.setAttribute('aria-hidden', 'true')
  $('bubbles').append(el)
  bubbles.set(key, { el, pid: id })
  const chip = document.createElement('div')
  chip.className = 'reactionChip'
  chip.textContent = `${emoji} ${name}`
  const feed = $('reactionFeed')
  if (feed.children.length >= 4) feed.firstElementChild.remove()
  feed.append(chip)
  setTimeout(() => {
    el.remove()
    chip.remove()
    if (bubbles.get(key)?.el === el) bubbles.delete(key)
  }, 3000)
}

// ---------- reusable meeting and position links ----------
const destination = parseDestination(location.search)
if (destination) {
  $('arrivalNote').hidden = false
  $('arrivalNote').textContent = destination.notice ?? `Destination: ${destination.label}`
}
function updateMeetingLink() {
  const target = $('meetingDestination').value
  $('meetingURL').value = meetingURL(location.href, target === 'position' ? me : target)
  $('meetingCopyStatus').textContent = ''
}
for (const button of document.querySelectorAll('.meetingLinkBtn')) button.onclick = () => {
  keys.clear()
  me.tx = me.ty = null
  const rooms = floors.filter((room) => room.alias)
  $('meetingDestination').replaceChildren(...rooms.map((room) => new Option(room.label.toLowerCase(), room.alias)))
  if (myId) $('meetingDestination').add(new Option('My current position', 'position'))
  const current = rooms.find((room) => me.x >= room.x && me.x < room.x + room.w && me.y >= room.y && me.y < room.y + room.h)
  $('meetingDestination').value = current?.alias ?? 'meeting'
  updateMeetingLink()
  cancelVisit()
  $('meetingDialog').showModal()
}
$('closeMeeting').onclick = () => $('meetingDialog').close()
$('meetingDestination').onchange = updateMeetingLink
$('meetingURL').onfocus = (event) => event.target.select()
$('copyMeeting').onclick = async () => {
  const link = $('meetingURL').value
  try {
    await navigator.clipboard.writeText(link)
    $('meetingCopyStatus').textContent = 'Link copied. Paste it into your calendar invitation.'
  } catch {
    $('meetingURL').focus()
    $('meetingURL').select()
    $('meetingCopyStatus').textContent = 'Select and copy the link above.'
  }
}

// ---------- WebRTC mesh gated by proximity ----------
let rtcCfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const screenShare = setupScreenShare({
  send, getConfig: () => rtcCfg, getMe: () => me, getPeers: () => peers,
  isConnected: () => ws?.readyState === 1 && !!myId && !$('stage').hidden,
})

function ensurePC(pid) {
  if (pcs.has(pid) || !localStream || !myId || !peers.has(pid)) return pcs.get(pid)
  const pc = new RTCPeerConnection(rtcCfg)
  pcs.set(pid, pc)
  for (const tr of localStream.getTracks()) pc.addTrack(tr, localStream)
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ t: 'signal', to: pid, data: { kind: 'ice', c: e.candidate } })
  }
  pc.ontrack = (e) => attachRemote(pid, e.streams[0])
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') closePC(pid)
  }
  return pc
}

function closePC(pid) {
  const pc = pcs.get(pid)
  pcs.delete(pid)
  if (pc) {
    pc.onconnectionstatechange = null
    pc.close()
  }
  const p = peers.get(pid)
  if (p?.videoEl) {
    p.videoEl.srcObject = null
    p.videoEl.remove()
    p.videoEl = null
  }
}

async function maybeCall(pid) {
  if (myId === null || pid <= myId) return // Only the lower ID initiates.
  const pc = ensurePC(pid)
  if (!pc || pc.signalingState !== 'stable') return
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  send({ t: 'signal', to: pid, data: { kind: 'offer', sdp: offer } })
}

async function onSignal(from, d) {
  if (from === myId || !localStream || !peers.has(from)) return
  if (d.kind === 'offer') {
    const pc = ensurePC(from)
    if (!pc) return
    await setRemoteDescription(pc, d.sdp)
    const ans = await pc.createAnswer()
    await pc.setLocalDescription(ans)
    send({ t: 'signal', to: from, data: { kind: 'answer', sdp: ans } })
  } else if (d.kind === 'answer') {
    const pc = pcs.get(from)
    if (pc) await setRemoteDescription(pc, d.sdp)
  } else if (d.kind === 'ice' && d.c) {
    const pc = ensurePC(from)
    if (pc) await addRemoteIce(pc, d.c)
  }
}

function attachRemote(pid, stream) {
  const p = peers.get(pid)
  if (!p) return
  if (!p.videoEl) {
    const v = document.createElement('video')
    v.autoplay = true
    v.playsInline = true
    $('remoteMedia').append(v)
    p.videoEl = v
  }
  p.videoEl.srcObject = stream
  p.videoEl.volume = voiceVolume(me, p, floors)
  p.videoEl.play().catch(() => {})
}

setInterval(() => {
  if (!myId) return
  for (const [id, p] of peers) {
    const d = dist(me, p)
    if ((d < LINK || voiceVolume(me, p, floors) > 0) && localStream) {
      if (!pcs.has(id)) maybeCall(id).catch(() => closePC(id))
    } else if (d > LINK + 90) {
      closePC(id)
    }
  }
}, 1200)

// ---------- people navigation ----------
let visit = null
function cancelVisit() {
  if (!visit) return
  visit = null
  me.tx = me.ty = null
  refreshRoster()
}
function visitPerson(id) {
  if (visit?.id === id) { cancelVisit(); return }
  const peer = peers.get(id)
  if (!peer) return
  standUp()
  const target = { x: peer.tx ?? peer.x, y: peer.ty ?? peer.y }
  const path = pathToPerson(me, target, [...peers.values()])
  cancelVisit()
  me.tx = me.ty = null
  if (!path) { showRoomNotice(`Cannot reach ${peer.name}: no free route`); return }
  if (!path.length) { showRoomNotice(`You are beside ${peer.name}`); return }
  visit = { id, path, target, planned: performance.now() }
  showRoomNotice(`Walking to ${peer.name} · move or press Esc to cancel`)
  refreshRoster()
}

// ---------- sitting ----------
let roomNoticeTimer
function showRoomNotice(text) {
  $('roomStatus').textContent = text
  clearTimeout(roomNoticeTimer)
  roomNoticeTimer = setTimeout(() => { $('roomStatus').textContent = '' }, 5000)
}
function canMoveTo(x, y) {
  const full = fullRoomAt({ ...me, x, y }, [...peers.values()])
  if (full) { showRoomNotice(`${full.label} is full`); me.tx = me.ty = null }
  return !full && !hitsSolid(x, y, BODY_R)
}
let seatReturn = null
const nearbySeat = () => findSeat(seats, me, [...peers.values()], (x, y) => hitsSolid(x, y, BODY_R))
function sendSit() {
  send({ t: 'sit', sitting: me.sitting, x: Math.round(me.x), y: Math.round(me.y) })
}
function standUp() {
  if (!me.sitting) return
  if (seatReturn) Object.assign(me, seatReturn)
  seatReturn = null
  me.sitting = false
  sendSit()
}
function toggleSit() {
  cancelVisit()
  if (me.sitting) {
    standUp()
    return
  }
  const best = nearbySeat()
  if (!best) return
  const full = fullRoomAt({ ...me, x: best.x, y: best.y }, [...peers.values()])
  if (full) { showRoomNotice(`${full.label} is full`); return }
  seatReturn = { x: me.x, y: me.y }
  me.x = best.x
  me.y = best.y
  me.tx = me.ty = null
  me.sitting = true
  me.moving = false
  me.walk = 0
  send({ t: 'move', x: Math.round(me.x), y: Math.round(me.y) })
  sendSit()
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if ($('stage').hidden) return
  if (document.activeElement?.matches('input, textarea, select') || document.activeElement?.closest('#reactionPicker, dialog')) return
  if (document.activeElement?.matches('button') && [' ', 'Enter'].includes(e.key)) return
  if (e.key.toLowerCase() === 'e') {
    e.preventDefault()
    if (!e.repeat) toggleSit()
    return
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'escape'].includes(e.key.toLowerCase())) cancelVisit()
  keys.add(e.key.toLowerCase())
})
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

canvas.addEventListener('pointerdown', (e) => {
  cancelVisit()
  standUp()
  const r = canvas.getBoundingClientRect()
  me.tx = cam.x + ((e.clientX - r.left) / r.width) * VIEW.w
  me.ty = cam.y + ((e.clientY - r.top) / r.height) * VIEW.h
})

// ---------- join / leave ----------
$('joinBtn').onclick = async () => {
  const btn = $('joinBtn')
  if (btn.disabled) return
  if (ws && ws.readyState <= 1) return // join already in progress
  saveProfile()
  btn.disabled = true
  btn.textContent = 'joining…'
  $('lobbyErr').textContent = ''
  const name = $('name').value.trim() || `user${Math.floor(Math.random() * 999)}`
  me.name = name.slice(0, 24)
  me.body = picked
  me.x = 70 + Math.random() * 100
  me.y = 330 + Math.random() * 60
  // camera + mic required: no head or voice without them, no entry
  if (!localStream) {
    setStatus('asking for camera and microphone…', true)
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      $('selfVideo').srcObject = localStream
      // never hang on play(): some browsers stall it, video starts when it can
      await Promise.race([$('selfVideo').play().catch(() => {}), new Promise((r) => setTimeout(r, 4000))])
    } catch (e) {
      const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
      const missing = e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError'
      failJoin(
        denied
          ? 'Permission denied: allow camera and microphone in the browser (lock icon in the address bar) and try again.'
          : missing
            ? 'No camera or microphone found. Plug in a device and try again.'
            : 'Could not start camera/microphone. Check the browser and try again.'
      )
      return
    }
  }
  setStatus('connecting…', true)
  try {
    const response = await fetch('/rtc-config', { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error('rtc-config')
    rtcCfg = await response.json()
  } catch {
    failJoin('Could not configure voice/video. Please try again.')
    return
  }
  await Promise.race([countryReady, new Promise((r) => setTimeout(r, 1200))])
  connect()
  setTimeout(() => {
    if ($('stage').hidden && btn.disabled) {
      try {
        ws?.close()
      } catch {}
      failJoin('The server is taking too long to respond. Try again.')
    }
  }, 10000)
}

// tab close -> explicit close frame, server drops peer instantly
addEventListener('beforeunload', () => {
  screenShare.reset()
  try {
    ws?.close()
  } catch {}
})

$('leaveBtn').onclick = () => { music.pause(); screenShare.reset(); location.reload() }
$('sitBtn').onclick = toggleSit
$('handBtn').onclick = (e) => {
  me.hand = !me.hand
  send({ t: 'hand', hand: me.hand })
  e.currentTarget.textContent = me.hand ? 'Lower hand' : 'Raise hand'
  e.currentTarget.setAttribute('aria-pressed', String(me.hand))
  e.currentTarget.title = me.hand ? 'Lower hand' : 'Raise hand'
}
$('muteBtn').onclick = (e) => {
  muted = !muted
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
  e.currentTarget.textContent = muted ? 'Mic off' : 'Mic on'
  e.currentTarget.setAttribute('aria-pressed', String(muted))
  e.currentTarget.title = muted ? 'Unmute microphone' : 'Mute microphone'
}
$('chatForm').onsubmit = (e) => {
  e.preventDefault()
  const v = $('chatInput').value.trim()
  if (!v) return
  send({ t: 'chat', text: v })
  $('chatInput').value = ''
}

// ---------- render ----------
// ---------- office painting ----------
function drawWall(x, y, w, h) {
  ctx.fillStyle = '#10142e'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#5b619c'
  ctx.fillRect(x, y, w, Math.min(4, h))
  ctx.fillStyle = '#3d4276'
  ctx.fillRect(x, y + h - 3, w, 3)
}

function drawFurn(t, x, y, w, h, extra) {
  if (t === 'rug') {
    ctx.fillStyle = extra
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#ffffff22'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 4, y + 4, w - 8, h - 8)
    return
  }
  if (t === 'plant') {
    ctx.fillStyle = '#7c4a21'
    ctx.fillRect(x + 3, y + 10, 14, 10)
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(x + 10, y + 7, 8, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#16a34a'
    ctx.beginPath()
    ctx.arc(x + 5, y + 4, 5, 0, 7)
    ctx.arc(x + 15, y + 4, 5, 0, 7)
    ctx.fill()
    return
  }
  if (t === 'chair') {
    ctx.fillStyle = '#11132a'
    ctx.fillRect(x - 2, y - 2, 32, 32)
    ctx.fillStyle = '#7c5cff'
    ctx.beginPath()
    ctx.arc(x + 14, y + 16, 10, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#4a3fa3'
    ctx.fillRect(x + 4, y + 2, 20, 6)
    return
  }
  if (t === 'desk') {
    ctx.fillStyle = '#11132a'
    ctx.fillRect(x - 2, y - 2, 154, 74)
    ctx.fillStyle = '#8b5a2b'
    ctx.fillRect(x, y, 150, 70)
    ctx.fillStyle = '#a06a35'
    ctx.fillRect(x, y, 150, 8)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(x + 60, y + 8, 44, 30)
    ctx.fillStyle = '#7dd3fc'
    ctx.fillRect(x + 63, y + 11, 38, 24)
    ctx.fillStyle = '#1f2937'
    ctx.fillRect(x + 76, y + 38, 12, 8)
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(x + 20, y + 48, 40, 10)
    return
  }
  if (t === 'shelf') {
    ctx.fillStyle = '#5b3a1e'
    ctx.fillRect(x, y, w, h)
    const cols = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7']
    for (let bx = x + 4, i = 0; bx < x + w - 8; bx += 12, i++) {
      ctx.fillStyle = cols[i % cols.length]
      ctx.fillRect(bx, y + 4, 8, h - 8)
    }
    return
  }
  if (t === 'board') {
    ctx.fillStyle = '#e8eafc'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
    ctx.strokeStyle = '#3b82f6'
    ctx.beginPath()
    ctx.moveTo(x + 12, y + h - 10)
    ctx.lineTo(x + 60, y + 10)
    ctx.lineTo(x + 110, y + h - 12)
    ctx.stroke()
    ctx.strokeStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(x + 170, y + h / 2, 10, 0, 7)
    ctx.stroke()
    return
  }
  if (t === 'tv') {
    ctx.fillStyle = '#11132a'
    ctx.fillRect(x - 2, y - 2, w + 4, h + 24)
    ctx.fillStyle = '#0b0e24'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#312e81'
    ctx.fillRect(x + 6, y + 6, w - 12, h - 12)
    ctx.fillStyle = '#5b3a1e'
    ctx.fillRect(x, y + h, w, 20)
    return
  }
  if (t === 'fridge') {
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(x, y + h / 2 - 1, w, 2)
    ctx.fillRect(x + w - 10, y + 8, 4, 18)
    return
  }
  if (t === 'counterH' || t === 'counterV') {
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#94a3b8'
    ctx.fillRect(x, y + h - 6, w, 6)
    if (t === 'counterH') {
      ctx.fillStyle = '#38bdf8'
      ctx.fillRect(x + 210, y + 8, 50, 28) // sink
      ctx.fillStyle = '#1f2937'
      for (const sx of [40, 80]) for (const sy of [10, 28]) {
        ctx.beginPath()
        ctx.arc(x + sx, y + sy, 7, 0, 7)
        ctx.fill()
      }
    }
    return
  }
  const top = t === 'ctableBig' ? '#4a3566' : '#6d4c2f'
  ctx.fillStyle = '#11132a'
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
  ctx.fillStyle = top
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#ffffff14'
  ctx.fillRect(x, y, w, 6)
  if (t.startsWith('sofa')) {
    ctx.fillStyle = '#7c5cff'
    if (t === 'sofaH') {
      ctx.fillRect(x + 6, y + 8, w - 12, h - 16)
      ctx.fillStyle = '#5a3fd4'
      ctx.fillRect(x + 6, y + 8, 4, h - 16)
      ctx.fillRect(x + w - 10, y + 8, 4, h - 16)
      ctx.fillRect(x + w / 2 - 2, y + 8, 4, h - 16)
    } else {
      ctx.fillRect(x + 8, y + 6, w - 16, h - 12)
      ctx.fillStyle = '#5a3fd4'
      ctx.fillRect(x + 8, y + 6, w - 16, 4)
      ctx.fillRect(x + 8, y + h - 10, w - 16, 4)
      ctx.fillRect(x + 8, y + h / 2 - 2, w - 16, 4)
    }
    return
  }
  ctx.strokeStyle = '#ffffff22'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16)
}

function drawOffice() {
  ctx.fillStyle = '#1a1f4b'
  ctx.fillRect(cam.x - 20, cam.y - 20, VIEW.w + 40, VIEW.h + 40)
  for (const f of floors) {
    ctx.fillStyle = f.c
    ctx.fillRect(f.x, f.y, f.w, f.h)
  }
  // kitchen tiles
  ctx.fillStyle = '#ffffff0c'
  let ri = 0
  for (let ty = 1020; ty < 1540; ty += 40, ri++)
    for (let tx = 1700 + (ri % 2 ? 0 : 40); tx < 2350; tx += 80) ctx.fillRect(tx, ty, 40, 40)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of floors) {
    ctx.fillStyle = '#ffffff2e'
    ctx.font = 'bold 30px system-ui'
    ctx.fillText(f.label, f.lx, f.ly)
  }
  for (const [t, x, y, w, h, extra] of furn) {
    const fw = w ?? 40
    const fh = h ?? 40
    if (x + fw < cam.x - 60 || x > cam.x + VIEW.w + 60 || y + fh < cam.y - 60 || y > cam.y + VIEW.h + 60) continue
    drawFurn(t, x, y, w, h, extra)
  }
  for (const [x, y, w, h] of walls) {
    if (x + w < cam.x - 40 || x > cam.x + VIEW.w + 40 || y + h < cam.y - 40 || y > cam.y + VIEW.h + 40) continue
    drawWall(x, y, w, h)
  }
  ctx.fillStyle = '#9aa1d088'
  ctx.font = '12px system-ui'
  ctx.fillText('walk close to talk · click or WASD to move · E to sit', 330, 395)
}

const mini = $('mini')
const mctx = mini.getContext('2d')
function drawMini(all) {
  const s = mini.width / WORLD.w
  mctx.clearRect(0, 0, mini.width, mini.height)
  mctx.fillStyle = '#e5d1b3'
  mctx.fillRect(0, 0, mini.width, mini.height)
  for (const f of floors) {
    mctx.fillStyle = f.c
    mctx.fillRect(f.x * s, f.y * s, f.w * s, f.h * s)
  }
  if (officeArt.ready) mctx.drawImage(officeArt.overview, 0, 0, mini.width, mini.height)
  for (const a of all) {
    mctx.fillStyle = a.isMe ? '#fff' : '#34d399'
    mctx.beginPath()
    mctx.arc(a.x * s, a.y * s, a.isMe ? 3 : 2, 0, 7)
    mctx.fill()
  }
  // A dark outer edge and warm inner edge remain readable on every floor color.
  mctx.fillStyle = '#142d3c33'
  mctx.beginPath()
  mctx.rect(0, 0, mini.width, mini.height)
  mctx.rect(cam.x * s, cam.y * s, VIEW.w * s, VIEW.h * s)
  mctx.fill('evenodd')
  mctx.strokeStyle = '#173b46'
  mctx.lineWidth = 6
  mctx.strokeRect(cam.x * s, cam.y * s, VIEW.w * s, VIEW.h * s)
  mctx.strokeStyle = '#ffe08a'
  mctx.lineWidth = 3
  mctx.strokeRect(cam.x * s, cam.y * s, VIEW.w * s, VIEW.h * s)
}

function drawHead(x, y, r, videoEl, initials) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 7)
  ctx.clip()
  if (videoEl?.readyState >= 2) {
    const vw = videoEl.videoWidth || 320
    const vh = videoEl.videoHeight || 240
    // zoom-in on face: enlarge frame and focus upper-middle where faces sit
    const s = (Math.max((r * 2) / vw, (r * 2) / vh) * HEAD_ZOOM)
    const fx = vw * 0.5
    const fy = vh * 0.38
    ctx.drawImage(videoEl, x - fx * s, y - fy * s, vw * s, vh * s)
  } else {
    ctx.fillStyle = '#3a4170'
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${r}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, x, y + 1)
  }
  ctx.restore()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 7)
  ctx.stroke()
}

const initialsOf = (n) => n.slice(0, 2).toUpperCase()

function drawAvatar(p, videoEl, isMe, inCall, now) {
  const s = 4
  const bw = 12 * s
  const headR = 22
  const cx = p.x
  const bodyY = p.y - (p.sitting ? 32 : 8)
  // shadow
  ctx.fillStyle = '#00000055'
  ctx.beginPath()
  ctx.ellipse(cx, bodyY + (p.sitting ? 48 : 64), 26, 7, 0, 0, 7)
  ctx.fill()
  if (inCall) {
    ctx.strokeStyle = 'rgba(52,211,153,0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, bodyY + 10, 52, 0, 7)
    ctx.stroke()
  }
  drawBody(ctx, p.body, cx - bw / 2, bodyY, s, p.walk, p.sitting, {
    appearance: p.appearance, facing: p.facing, motion: reducedMotion.matches ? 0 : p.motion,
    time: reducedMotion.matches ? 0 : now / 1000,
  })
  drawHead(cx, bodyY - headR + 6, headR, videoEl, initialsOf(p.name || '?'))
  // nametag
  ctx.font = 'bold 12px system-ui'
  const label = `${p.name}${isMe ? ' (you)' : ''}`
  const tw = ctx.measureText(label).width + 14
  ctx.fillStyle = isMe ? '#427461' : '#2c4138ee'
  ctx.strokeStyle = '#111'
  const ny = bodyY - headR * 2 - 16
  ctx.beginPath()
  ctx.roundRect(cx - tw / 2, ny, tw, 20, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, cx, ny + 11)
  if (p.hand) {
    ctx.font = '22px system-ui'
    ctx.fillText('✋', cx + tw / 2 + 12, ny + 8)
  }
}

let last = performance.now()
let lastSent = 0

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (!$('lobby').hidden) {
    const selected = bodiesEl.querySelector('.sel canvas')
    renderPreview(selected, picked, appearance, reducedMotion.matches ? 0 : now / 1000, !reducedMotion.matches)
  }
  if (! $('stage').hidden) {
    const oldX = me.x
    const oldY = me.y
    // movement (axis-separated vs solids = slides along walls)
    const step = (dx, dy) => {
      if (dx && canMoveTo(me.x + dx, me.y)) me.x += dx
      if (dy && canMoveTo(me.x, me.y + dy)) me.y += dy
    }
    let vx = 0
    let vy = 0
    if (keys.has('w') || keys.has('arrowup')) vy -= 1
    if (keys.has('s') || keys.has('arrowdown')) vy += 1
    if (keys.has('a') || keys.has('arrowleft')) vx -= 1
    if (keys.has('d') || keys.has('arrowright')) vx += 1
    if (visit) {
      const peer = peers.get(visit.id)
      if (!peer) cancelVisit()
      else {
        const target = { x: peer.tx ?? peer.x, y: peer.ty ?? peer.y }
        if (now - visit.planned > 500 && Math.hypot(target.x - visit.target.x, target.y - visit.target.y) > 24) {
          const id = visit.id
          cancelVisit()
          visitPerson(id)
        }
        if (visit) {
          while (visit.path.length && Math.hypot(visit.path[0].x - me.x, visit.path[0].y - me.y) < 1) visit.path.shift()
          if (!visit.path.length) { showRoomNotice(`You are beside ${peer.name}`); cancelVisit() }
          else { me.tx = visit.path[0].x; me.ty = visit.path[0].y }
        }
      }
    }
    me.moving = false
    if (vx || vy) {
      standUp()
      const n = Math.hypot(vx, vy)
      step((vx / n) * SPEED * dt, (vy / n) * SPEED * dt)
      me.tx = me.ty = null
      me.moving = true
    } else if (me.tx !== null) {
      const dx = me.tx - me.x
      const dy = me.ty - me.y
      const d = Math.hypot(dx, dy)
      if (d < (visit ? 1 : 4)) {
        me.tx = me.ty = null
      } else {
        step((dx / d) * Math.min(d, SPEED * (visit ? 2 : 1) * dt), (dy / d) * Math.min(d, SPEED * (visit ? 2 : 1) * dt))
        if (visit && me.x === oldX && me.y === oldY) { cancelVisit(); showRoomNotice("Route blocked; select the person again") }
        me.moving = true
      }
    }
    me.x = Math.max(30, Math.min(WORLD.w - 30, me.x))
    me.y = Math.max(40, Math.min(WORLD.h - 30, me.y))
    screenShare.update()
    music.update()
    me.moving = !me.sitting && Math.hypot(me.x - oldX, me.y - oldY) > 0.01
    if (Math.abs(me.x - oldX) > 0.01) me.facing = Math.sign(me.x - oldX)
    // camera follows avatar
    const tx = Math.max(0, Math.min(WORLD.w - VIEW.w, me.x - VIEW.w / 2))
    const ty = Math.max(0, Math.min(WORLD.h - VIEW.h, me.y - VIEW.h / 2))
    cam.x += (tx - cam.x) * Math.min(1, dt * 6)
    cam.y += (ty - cam.y) * Math.min(1, dt * 6)
    if (now - lastSent > 66 && ws?.readyState === 1) {
      send({ t: 'move', x: Math.round(me.x), y: Math.round(me.y) })
      lastSent = now
    }
    // remote interpolation
    for (const p of peers.values()) {
      if (p.tx !== undefined) {
        const dx = p.tx - p.x
        const dy = p.ty - p.y
        const d = Math.hypot(dx, dy)
        if (d > 1) {
          p.x += dx * Math.min(1, dt * 10)
          p.y += dy * Math.min(1, dt * 10)
          p.moving = d > 3
          if (Math.abs(dx) > 1) p.facing = Math.sign(dx)
        } else p.moving = false
      }
    }
    for (const p of [me, ...peers.values()]) {
      p.motion += ((p.moving && !p.sitting ? 1 : 0) - p.motion) * Math.min(1, dt * 12)
      p.walk += dt * 10 * p.motion
    }
    // render (world coords under camera transform)
    ctx.save()
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y))
    if (officeArt.ready) officeArt.ground(ctx)
    else drawOffice()
    const all = [{ ...me, isMe: true, video: $('selfVideo') }]
    for (const p of peers.values()) all.push({ ...p, isMe: false, video: p.videoEl })
    all.sort((a, b) => a.y - b.y)
    const inCall = new Set()
    for (const p of peers.values()) {
      const volume = voiceVolume(me, p, floors)
      if (p.videoEl) p.videoEl.volume = volume
      if (volume > 0 && pcs.get(p.id)?.connectionState === 'connected' && p.videoEl?.readyState >= 2) inCall.add(p.id)
    }
    // Paint furniture and people in depth order so walking behind a desk feels natural.
    const scene = officeArt.ready
      ? [...officeArt.objects.map((object) => ({ object, depth: object.bottom })), ...all.map((avatar) => ({ avatar, depth: avatar.y + 56 }))].sort((a, b) => a.depth - b.depth)
      : all.map((avatar) => ({ avatar }))
    for (const { object, avatar } of scene) {
      if (object) officeArt.draw(ctx, object)
      else drawAvatar(avatar, avatar.video, avatar.isMe, avatar.isMe ? inCall.size > 0 : inCall.has(avatar.id), now)
    }
    ctx.restore()
    drawMini(all)
    $('sitBtn').hidden = !me.sitting && !nearbySeat()
    $('sitBtn').textContent = me.sitting ? 'E · Stand up' : 'E · Sit down'
    // bubbles follow avatar
    const r = canvas.getBoundingClientRect()
    const sx = r.width / VIEW.w
    const sy = r.height / VIEW.h
    for (const { el, pid } of bubbles.values()) {
      const p = pid === myId ? me : peers.get(pid)
      if (!p) continue
      el.style.left = `${(p.x - cam.x) * sx}px`
      el.style.top = `${(p.y - 78 - cam.y) * sy}px`
    }
    // call HUD
    const pill = $('callLabel')
    if (inCall.size > 0) {
      pill.textContent = `in call · ${inCall.size}`
      pill.classList.add('on')
    } else {
      pill.textContent = [...peers.values()].some((p) => voiceVolume(me, p, floors) > 0) ? 'connecting audio/video…' : 'not in call'
      pill.classList.remove('on')
    }
  }
  requestAnimationFrame(tick)
}

function refreshRoster() {
  $('count').textContent = `${peers.size + 1} in the office`
  $('peerCount').textContent = `(${peers.size + 1})`
  const ul = $('peers')
  const focused = ul.contains(document.activeElement) ? document.activeElement.dataset.peer : null
  ul.innerHTML = ''
  const rows = [{ name: `${me.name} (you)`, country: me.country, hand: me.hand, sitting: me.sitting, self: true }, ...peers.values()]
  const seen = new Map() // country -> names[]
  for (const p of rows) {
    if (!/^[A-Z]{2}$/.test(p.country ?? '')) continue
    if (!seen.has(p.country)) seen.set(p.country, [])
    seen.get(p.country).push(p.name)
  }
  const bar = $('flagBar')
  bar.innerHTML = ''
  for (const [cc, names] of seen) {
    const s = document.createElement('span')
    s.textContent = names.length > 1 ? `${flag(cc)}×${names.length}` : flag(cc)
    s.title = `${countryName(cc)}: ${names.join(', ')}`
    bar.append(s)
  }
  for (const p of rows) {
    const li = document.createElement('li')
    const near = p.self ? false : voiceVolume(me, p, floors) > 0
    li.innerHTML = `<span><i class="dot${near ? ' talk' : ''}"></i></span><span class="kind"></span>`
    li.firstChild.append(document.createTextNode(`${p.sitting ? '🪑 ' : ''}${p.hand ? '✋ ' : ''}${flag(p.country)} ${p.name}`.trim()))
    li.querySelector('.kind').textContent = p.self ? BODIES[me.body].label : BODIES[p.body]?.label ?? p.body
    if (!p.self) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.peer = p.id
      button.setAttribute('aria-label', `Walk to ${p.name}`)
      button.setAttribute('aria-pressed', String(visit?.id === p.id))
      button.title = visit?.id === p.id ? 'Cancel walk' : `Walk to ${p.name}`
      button.append(...li.childNodes)
      button.onclick = () => visitPerson(p.id)
      li.append(button)
    }
    ul.append(li)
  }
  if (focused) [...ul.querySelectorAll('button')].find((b) => b.dataset.peer === focused)?.focus({ preventScroll: true })
}
setInterval(() => {
  if (!$('stage').hidden) refreshRoster()
}, 2000)

requestAnimationFrame(tick)
