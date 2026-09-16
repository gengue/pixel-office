import { ROOMS, roomAt } from './rooms.js'
import { canViewScreen } from './voice.js'
import { addRemoteIce, setRemoteDescription } from './rtc.js'

export function setupScreenShare({ send, getConfig, getMe, getPeers, isConnected }) {
  const $ = (id) => document.getElementById(id)
  const main = document.querySelector('#stage main')
  const connections = new Map()
  const streams = new Map()
  const supported = !!navigator.mediaDevices?.getDisplayMedia
  let shares = [], viewers = [], local = null, selected = '', capturing = false, generation = 0, ackTimer

  const announce = (text) => { $('shareStatus').textContent = text }
  const ownerOf = (share) => share.owner === getMe().id ? getMe() : getPeers().get(share.owner)
  const visible = (share) => {
    const owner = ownerOf(share)
    const position = share.owner === getMe().id ? owner : owner && { x: owner.tx ?? owner.x, y: owner.ty ?? owner.y }
    return canViewScreen(share, position, getMe())
  }
  const allowed = (entry) => {
    const share = shares.find((share) => share.id === entry.id)
    return share && (share.owner === getMe().id
      ? local?.id === share.id && viewers.includes(entry.peer) && roomAt(getMe()) === share.room
      : share.owner === entry.peer)
  }

  function drop(key) {
    const entry = connections.get(key)
    if (!entry) return
    connections.delete(key)
    entry.pc.onconnectionstatechange = null
    entry.pc.ontrack = null
    entry.pc.close()
    if (entry.peer === shares.find((share) => share.id === entry.id)?.owner) streams.delete(entry.id)
  }

  function render() {
    const available = shares.filter(visible)
    if (local && !local.accepted) available.unshift(local)
    if (!available.some((share) => share.id === selected)) selected = available[0]?.id ?? ''
    const share = available.find((share) => share.id === selected)
    const stream = share && local && share.id === local.id ? local.stream : streams.get(selected)
    if ($('screenVideo').srcObject !== (stream ?? null)) {
      $('screenVideo').srcObject = stream ?? null
      if (stream) $('screenVideo').play().catch(() => announce('Press Play to view the shared screen.'))
    }
    $('screenPanel').hidden = !share
    main.classList.toggle('sharing', !!share)
    if (!share) main.classList.remove('screen-expanded')
    $('expandScreen').textContent = main.classList.contains('screen-expanded') ? 'Show office' : 'Expand'
    $('expandScreen').setAttribute('aria-pressed', String(main.classList.contains('screen-expanded')))
    $('stopScreen').hidden = !local
    $('shareBtn').textContent = local ? 'stop sharing' : capturing ? 'choosing screen…' : 'share screen'
    const busy = shares.some((s) => s.owner !== getMe().id && s.room !== -1 && s.room === roomAt(getMe()))
    $('shareBtn').disabled = !supported || capturing || (!local && (busy || !isConnected()))
    $('shareBtn').title = !supported ? 'This browser cannot share a screen. You can still watch others.' : busy ? 'Someone is presenting in this room.' : 'Choose a tab, window or screen'
    $('screenChoice').hidden = available.length < 2
    $('screenChoice').replaceChildren(...available.map((s) => new Option(ownerOf(s)?.name ?? 'Presentation', s.id, false, s.id === selected)))
    if (!share) return
    const own = share.owner === getMe().id
    $('screenTitle').textContent = own ? 'Your screen' : `${ownerOf(share)?.name ?? 'Someone'} is presenting`
    const scope = share.room === -1 ? 'Nearby people outside rooms' : ROOMS[share.room].label
    $('screenAudience').textContent = own ? `${scope} · ${viewers.length} viewer${viewers.length === 1 ? '' : 's'}` : scope
    $('screenHint').textContent = own ? 'Sharing stops when you change rooms. Your camera and microphone stay on.' : 'Your camera and microphone stay on while you watch.'
    $('screenWaiting').hidden = !!stream && $('screenVideo').readyState >= 2
  }

  function stop(message = 'Screen sharing stopped.') {
    generation++
    clearTimeout(ackTimer)
    if (local) {
      const id = local.id
      for (const track of local.stream.getTracks()) { track.onended = null; track.stop() }
      local = null
      shares = shares.filter((share) => share.id !== id)
      for (const [key, entry] of connections) if (entry.id === id) drop(key)
      send({ t: 'share-stop', id })
    }
    announce(message)
    render()
  }

  async function start() {
    if (capturing || local || !supported || !isConnected()) return
    const room = roomAt(getMe())
    const request = ++generation
    capturing = true
    announce('Choose what to share in your browser.')
    render()
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 15 } },
        audio: false,
      })
      if (request !== generation || !isConnected() || roomAt(getMe()) !== room) {
        stream.getTracks().forEach((track) => track.stop())
        announce('Your location or connection changed. Please share again.')
        return
      }
      const track = stream.getVideoTracks()[0]
      if (!track || track.readyState !== 'live') {
        stream.getTracks().forEach((track) => track.stop())
        throw new Error('No screen track')
      }
      track.contentHint = 'detail'
      local = { id: crypto.randomUUID(), owner: getMe().id, room, stream, accepted: false }
      selected = local.id
      track.onended = () => stop()
      send({ t: 'share-start', id: local.id, room })
      ackTimer = setTimeout(() => { if (local && !local.accepted) stop('Could not start sharing. Please try again.') }, 8000)
      announce('Starting screen sharing…')
    } catch (error) {
      announce(error.name === 'NotAllowedError' || error.name === 'AbortError'
        ? 'Screen sharing cancelled or permission denied. Your call continues.'
        : 'Could not capture your screen. Check browser and system screen-recording permissions.')
    } finally {
      capturing = false
      render()
    }
  }

  function createConnection(share, peer) {
    const key = `${share.id}:${peer}`
    if (connections.has(key)) return connections.get(key)
    const pc = new RTCPeerConnection(getConfig())
    const entry = { key, id: share.id, peer, pc }
    connections.set(key, entry)
    if (share.owner === getMe().id && local?.id === share.id) {
      pc.addTrack(local.stream.getVideoTracks()[0], local.stream)
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && allowed(entry)) send({ t: 'screen-signal', id: share.id, to: peer, data: { kind: 'ice', c: candidate } })
    }
    pc.ontrack = (event) => {
      if (!allowed(entry)) return
      streams.set(share.id, event.streams[0] ?? new MediaStream([event.track]))
      render()
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        drop(key)
        announce('Screen connection interrupted. Stop and share again to retry.')
        render()
      }
    }
    return entry
  }

  async function offer(share, peer) {
    const entry = createConnection(share, peer)
    try {
      const sdp = await entry.pc.createOffer()
      await entry.pc.setLocalDescription(sdp)
      if (allowed(entry)) send({ t: 'screen-signal', id: share.id, to: peer, data: { kind: 'offer', sdp } })
    } catch {
      drop(entry.key)
      announce('Could not connect a screen viewer. Stop and share again to retry.')
    }
  }

  async function onMessage(message) {
    if (message.t === 'share-error') {
      if (local?.id === message.id) stop(message.message)
    } else if (message.t === 'share-state') {
      shares = message.shares
      viewers = message.viewers
      if (local) {
        if (shares.some((share) => share.id === local.id)) {
          local.accepted = true
          clearTimeout(ackTimer)
          announce('You are sharing your screen.')
        } else if (local.accepted) stop('Sharing ended because your location or connection changed.')
      }
      for (const [key, entry] of connections) if (!allowed(entry)) drop(key)
      for (const id of streams.keys()) if (!shares.some((share) => share.id === id)) streams.delete(id)
      if (local?.accepted) for (const peer of viewers) {
        if (!connections.has(`${local.id}:${peer}`)) void offer(local, peer)
      }
      render()
    } else if (message.t === 'screen-signal') {
      const share = shares.find((share) => share.id === message.id)
      if (!share) return
      const peer = message.from
      if (share.owner === getMe().id ? !viewers.includes(peer) || local?.id !== share.id : share.owner !== peer) return
      const entry = createConnection(share, peer)
      try {
        if (message.data.kind === 'offer' && share.owner === peer) {
          await setRemoteDescription(entry.pc, message.data.sdp)
          const answer = await entry.pc.createAnswer()
          await entry.pc.setLocalDescription(answer)
          if (allowed(entry)) send({ t: 'screen-signal', id: share.id, to: peer, data: { kind: 'answer', sdp: answer } })
        } else if (message.data.kind === 'answer' && share.owner === getMe().id) {
          await setRemoteDescription(entry.pc, message.data.sdp)
        } else if (message.data.kind === 'ice') {
          await addRemoteIce(entry.pc, message.data.c)
        }
      } catch {
        drop(entry.key)
        announce('Could not connect the shared screen. Stop and share again to retry.')
        render()
      }
    }
  }

  function update() {
    if (local && roomAt(getMe()) !== local.room) stop('Screen sharing stopped when you changed rooms.')
    // The server closes audience connections; local movement hides the view immediately.
    // Keeping the connection until that update avoids losing it on a brief boundary crossing.
    if ((selected && !visible(shares.find((s) => s.id === selected) ?? local ?? { room: -2 })) ||
      (!selected && shares.some(visible))) render()
  }

  function reset() {
    stop('Screen sharing stopped: you left or lost the connection.')
    shares = []; viewers = []; streams.clear()
    for (const key of connections.keys()) drop(key)
    render()
  }

  $('shareBtn').onclick = () => local ? stop() : void start()
  $('stopScreen').onclick = () => stop()
  $('screenChoice').onchange = () => { selected = $('screenChoice').value; render() }
  $('screenVideo').onloadeddata = () => { $('screenWaiting').hidden = true }
  $('expandScreen').onclick = () => { main.classList.toggle('screen-expanded'); render() }
  render()
  return { onMessage, update, reset }
}
