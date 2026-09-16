import { BODIES, BODY_KINDS, drawBody, renderPreview } from './avatars.js'

const W = 960
const H = 600
const TALK = 220
const LINK = 330
const SPEED = 210

const $ = (id) => document.getElementById(id)
const canvas = $('map')
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false

// ---------- lobby ----------
let picked = 'hombre'
const bodiesEl = $('bodies')
for (const kind of BODY_KINDS) {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'bodyOpt' + (kind === picked ? ' sel' : '')
  const c = document.createElement('canvas')
  renderPreview(c, kind)
  const s = document.createElement('span')
  s.textContent = BODIES[kind].label
  b.append(c, s)
  b.onclick = () => {
    picked = kind
    bodiesEl.querySelectorAll('.bodyOpt').forEach((el) => el.classList.remove('sel'))
    b.classList.add('sel')
  }
  bodiesEl.append(b)
}

let localStream = null

// ---------- state ----------
let ws = null
let myId = null
const tabId =
  sessionStorage.getItem('po-tab') ?? crypto.randomUUID?.() ?? String(Math.random())
sessionStorage.setItem('po-tab', tabId)
const me = { name: 'anon', body: picked, x: 480, y: 320, tx: null, ty: null, walk: 0, moving: false }
const peers = new Map() // id -> {id,name,body,x,y,walk,moving,videoEl}
const pcs = new Map() // id -> RTCPeerConnection
const keys = new Set()
let muted = false
const bubbles = new Map() // bubbleId -> {el, pid, until}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

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
  el.title = 'click para expandir'
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
  btn.textContent = 'entrar a oficina →'
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
  $('meLabel').textContent = `${me.name} · ${BODIES[me.body].label}`
  refreshRoster()
}

function connect() {
  // mata conexión previa: una pestaña = un player (evita gemelo fantasma)
  try {
    ws?.close()
  } catch {}
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  ws.onopen = () => {
    setStatus('entrando…', true)
    send({ t: 'join', tab: tabId, name: me.name, body: me.body, x: me.x, y: me.y })
  }
  ws.onerror = () => failJoin('No se pudo conectar al servidor. Revisa tu conexión e inténtalo de nuevo.')
  ws.onclose = () => {
    if (!$('stage').hidden && !myId) failJoin('Conexión perdida antes de entrar. Inténtalo de nuevo.')
  }
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.t === 'welcome') {
      myId = m.id
      setStatus('')
      for (const p of m.roster) if (p.id !== myId) upsertPeer(p)
      enterStage()
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
    } else if (m.t === 'chat') {
      addHistory(m.name, m.text, m.at)
      addBubble(m.id, m.text)
    } else if (m.t === 'signal') {
      onSignal(m.from, m.data)
    }
  }
}

function upsertPeer(p) {
  if (!peers.has(p.id)) peers.set(p.id, { ...p, tx: p.x, ty: p.y, walk: 0, moving: false, videoEl: null })
  else Object.assign(peers.get(p.id), { name: p.name, body: p.body })
}

const send = (o) => ws?.readyState === 1 && ws.send(JSON.stringify(o))

// ---------- WebRTC mesh gated by proximity ----------
const rtcCfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

function ensurePC(pid) {
  if (pcs.has(pid) || !localStream || !myId) return pcs.get(pid)
  const pc = new RTCPeerConnection(rtcCfg)
  pcs.set(pid, pc)
  for (const tr of localStream.getTracks()) pc.addTrack(tr, localStream)
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ t: 'signal', to: pid, data: { kind: 'ice', c: e.candidate } })
  }
  pc.ontrack = (e) => attachRemote(pid, e.streams[0])
  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePC(pid)
  }
  return pc
}

function closePC(pid) {
  pcs.get(pid)?.close()
  pcs.delete(pid)
  const p = peers.get(pid)
  if (p?.videoEl) {
    p.videoEl.srcObject = null
    p.videoEl.remove()
    p.videoEl = null
  }
}

async function maybeCall(pid) {
  if (myId === null || pid <= myId) return // solo el id mayor inicia
  const pc = ensurePC(pid)
  if (!pc || pc.signalingState !== 'stable') return
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  send({ t: 'signal', to: pid, data: { kind: 'offer', sdp: offer } })
}

async function onSignal(from, d) {
  if (from === myId || !localStream) return
  if (d.kind === 'offer') {
    const pc = ensurePC(from)
    if (!pc) return
    await pc.setRemoteDescription(d.sdp)
    const ans = await pc.createAnswer()
    await pc.setLocalDescription(ans)
    send({ t: 'signal', to: from, data: { kind: 'answer', sdp: ans } })
  } else if (d.kind === 'answer') {
    await pcs.get(from)?.setRemoteDescription(d.sdp).catch(() => {})
  } else if (d.kind === 'ice' && d.c) {
    await pcs.get(from)?.addIceCandidate(d.c).catch(() => {})
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
  p.videoEl.play().catch(() => {})
}

setInterval(() => {
  if (!myId) return
  for (const [id, p] of peers) {
    const d = dist(me, p)
    if (d < LINK && localStream) {
      if (!pcs.has(id)) maybeCall(id)
      if (p.videoEl) p.videoEl.volume = muted ? 0 : Math.max(0, 1 - d / TALK)
    } else if (d > LINK + 90) {
      closePC(id)
    }
  }
}, 1200)

// ---------- input ----------
addEventListener('keydown', (e) => {
  if ($('stage').hidden) return
  if (document.activeElement === $('chatInput')) return
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
  keys.add(e.key.toLowerCase())
})
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))

canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect()
  me.tx = ((e.clientX - r.left) / r.width) * W
  me.ty = ((e.clientY - r.top) / r.height) * H
})

// ---------- join / leave ----------
$('joinBtn').onclick = async () => {
  const btn = $('joinBtn')
  if (btn.disabled) return
  if (ws && ws.readyState <= 1) return // join ya en curso
  btn.disabled = true
  btn.textContent = 'entrando…'
  $('lobbyErr').textContent = ''
  const name = $('name').value.trim() || `user${Math.floor(Math.random() * 999)}`
  me.name = name.slice(0, 24)
  me.body = picked
  me.x = 120 + Math.random() * 720
  me.y = 140 + Math.random() * 380
  // cámara + micro obligatorios: sin ellos no hay cabeza ni voz, no se entra
  if (!localStream) {
    setStatus('pidiendo cámara y micrófono…', true)
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      $('selfVideo').srcObject = localStream
      await $('selfVideo').play().catch(() => {})
    } catch (e) {
      const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError'
      const missing = e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError'
      failJoin(
        denied
          ? 'Permiso denegado: permite cámara y micrófono en el navegador (ícono 🔒 en la barra) e inténtalo de nuevo.'
          : missing
            ? 'No se encontró cámara o micrófono. Conecta un dispositivo e inténtalo de nuevo.'
            : 'No se pudo activar cámara/micrófono. Revisa el navegador e inténtalo de nuevo.'
      )
      return
    }
  }
  setStatus('conectando…', true)
  connect()
  setTimeout(() => {
    if ($('stage').hidden && btn.disabled) {
      try {
        ws?.close()
      } catch {}
      failJoin('El servidor tarda en responder. Inténtalo de nuevo.')
    }
  }, 10000)
}

// cierre pestaña -> close frame explícito, server limpia peer al instante
addEventListener('beforeunload', () => {
  try {
    ws?.close()
  } catch {}
})

$('leaveBtn').onclick = () => location.reload()
$('muteBtn').onclick = (e) => {
  muted = !muted
  localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted))
  e.target.textContent = muted ? 'unmutear' : 'mutear'
}
$('chatForm').onsubmit = (e) => {
  e.preventDefault()
  const v = $('chatInput').value.trim()
  if (!v) return
  send({ t: 'chat', text: v })
  $('chatInput').value = ''
}

// ---------- render ----------
function drawOffice() {
  ctx.fillStyle = '#232a5e'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#272e68'
  for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < W; x += 80) ctx.fillRect(x, y, 40, 40)
  // alfombra central
  ctx.fillStyle = '#7c5cff33'
  ctx.fillRect(280, 180, 400, 240)
  ctx.strokeStyle = '#7c5cff88'
  ctx.strokeRect(280, 180, 400, 240)
  // mesas
  ctx.fillStyle = '#3b2f2f'
  for (const [x, y] of [[120, 120], [700, 120], [120, 440], [700, 440]]) {
    ctx.fillRect(x, y, 140, 60)
    ctx.fillStyle = '#151a45'
    ctx.fillRect(x + 10, y + 10, 120, 40)
    ctx.fillStyle = '#3b2f2f'
  }
  ctx.fillStyle = '#34d39955'
  for (const [x, y] of [[30, 30], [900, 30], [30, 540], [900, 540]]) {
    ctx.beginPath()
    ctx.arc(x, y, 16, 0, 7)
    ctx.fill()
  }
  ctx.fillStyle = '#9aa1d088'
  ctx.font = '12px system-ui'
  ctx.fillText('acércate para hablar · click o WASD para moverte', 330, 30)
}

function drawHead(x, y, r, videoEl, initials) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 7)
  ctx.clip()
  if (videoEl?.readyState >= 2) {
    const vw = videoEl.videoWidth || 320
    const vh = videoEl.videoHeight || 240
    const s = Math.max((r * 2) / vw, (r * 2) / vh)
    ctx.drawImage(videoEl, x - (vw * s) / 2, y - (vh * s) / 2, vw * s, vh * s)
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

function drawAvatar(p, videoEl, isMe, inCall) {
  const s = 4
  const bw = 12 * s
  const headR = 22
  const cx = p.x
  const bodyY = p.y - 8
  // sombra
  ctx.fillStyle = '#00000055'
  ctx.beginPath()
  ctx.ellipse(cx, bodyY + 64, 26, 7, 0, 0, 7)
  ctx.fill()
  if (inCall) {
    ctx.strokeStyle = '#34d399'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx, bodyY + 10, 52, 0, 7)
    ctx.stroke()
  }
  drawBody(ctx, p.body, cx - bw / 2, bodyY, s, p.walk)
  drawHead(cx, bodyY - headR + 6, headR, videoEl, initialsOf(p.name || '?'))
  // nametag
  ctx.font = 'bold 12px system-ui'
  const label = `${p.name}${isMe ? ' (tú)' : ''}`
  const tw = ctx.measureText(label).width + 14
  ctx.fillStyle = isMe ? '#7c5cff' : '#0d1030dd'
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
}

let last = performance.now()
let lastSent = 0

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  if (! $('stage').hidden) {
    // movimiento
    let vx = 0
    let vy = 0
    if (keys.has('w') || keys.has('arrowup')) vy -= 1
    if (keys.has('s') || keys.has('arrowdown')) vy += 1
    if (keys.has('a') || keys.has('arrowleft')) vx -= 1
    if (keys.has('d') || keys.has('arrowright')) vx += 1
    me.moving = false
    if (vx || vy) {
      const n = Math.hypot(vx, vy)
      me.x += (vx / n) * SPEED * dt
      me.y += (vy / n) * SPEED * dt
      me.tx = me.ty = null
      me.moving = true
    } else if (me.tx !== null) {
      const dx = me.tx - me.x
      const dy = me.ty - me.y
      const d = Math.hypot(dx, dy)
      if (d < 4) {
        me.tx = me.ty = null
      } else {
        me.x += (dx / d) * SPEED * dt
        me.y += (dy / d) * SPEED * dt
        me.moving = true
      }
    }
    me.x = Math.max(24, Math.min(W - 24, me.x))
    me.y = Math.max(70, Math.min(H - 24, me.y))
    if (me.moving) me.walk += dt * 10
    if (now - lastSent > 66 && ws?.readyState === 1) {
      send({ t: 'move', x: Math.round(me.x), y: Math.round(me.y) })
      lastSent = now
    }
    // interpolación remotos
    for (const p of peers.values()) {
      if (p.tx !== undefined) {
        const dx = p.tx - p.x
        const dy = p.ty - p.y
        const d = Math.hypot(dx, dy)
        if (d > 1) {
          p.x += dx * Math.min(1, dt * 10)
          p.y += dy * Math.min(1, dt * 10)
          p.moving = d > 3
          if (p.moving) p.walk += dt * 10
        } else p.moving = false
      }
    }
    // render
    drawOffice()
    const all = [{ ...me, isMe: true, video: $('selfVideo') }]
    for (const p of peers.values()) all.push({ ...p, isMe: false, video: p.videoEl })
    all.sort((a, b) => a.y - b.y)
    const inCall = new Set()
    for (const p of peers.values()) if (dist(me, p) < TALK) inCall.add(p.id)
    for (const a of all) drawAvatar(a, a.video, a.isMe, a.isMe ? inCall.size > 0 : inCall.has(a.id))
    // burbujas siguen avatar
    const r = canvas.getBoundingClientRect()
    const sx = r.width / W
    const sy = r.height / H
    for (const { el, pid } of bubbles.values()) {
      const p = pid === myId ? me : peers.get(pid)
      if (!p) continue
      el.style.left = `${p.x * sx}px`
      el.style.top = `${(p.y - 78) * sy}px`
    }
    // HUD llamada
    const pill = $('callLabel')
    if (inCall.size > 0) {
      pill.textContent = `en llamada · ${inCall.size}`
      pill.classList.add('on')
    } else {
      pill.textContent = 'fuera de llamada'
      pill.classList.remove('on')
    }
  }
  requestAnimationFrame(tick)
}

function refreshRoster() {
  $('count').textContent = `${peers.size + 1} en oficina`
  $('peerCount').textContent = `(${peers.size + 1})`
  const ul = $('peers')
  ul.innerHTML = ''
  const rows = [{ name: `${me.name} (tú)`, self: true }, ...peers.values()]
  for (const p of rows) {
    const li = document.createElement('li')
    const near = p.self ? false : dist(me, p) < TALK
    li.innerHTML = `<span><i class="dot${near ? ' talk' : ''}"></i></span><span class="kind"></span>`
    li.firstChild.append(document.createTextNode(p.name))
    li.querySelector('.kind').textContent = p.self ? BODIES[me.body].label : BODIES[p.body]?.label ?? p.body
    ul.append(li)
  }
}
setInterval(() => {
  if (!$('stage').hidden) refreshRoster()
}, 2000)

requestAnimationFrame(tick)
