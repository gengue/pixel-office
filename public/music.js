import { roomAt } from './rooms.js'

// The turntable is already painted on the reading room's sideboard.
export const RECORD_PLAYER = { x: 474, y: 1450 }
export const DEFAULT_VIDEO = 'ffnnMC-yMR0'

export function youtubeId(value) {
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol)) return null
    let id
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1)
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)$/)?.[1]
    }
    return /^[\w-]{11}$/.test(id ?? '') ? id : null
  } catch { return null }
}

export function musicVolume(position) {
  if (roomAt(position) !== roomAt(RECORD_PLAYER)) return 0
  const distance = Math.hypot(position.x - RECORD_PLAYER.x, position.y - RECORD_PLAYER.y)
  return Math.round(50 * Math.max(0, Math.min(1, (320 - distance) / 240)))
}

export function musicPosition(state, now) {
  return state.position + (state.playing ? Math.max(0, now - state.updatedAt) / 1000 : 0)
}

export function setupMusic({ getPosition, send, isConnected }) {
  const $ = (id) => document.getElementById(id)
  const panel = $('musicPanel')
  const open = $('musicOpen')
  const status = $('musicStatus')
  const play = $('musicPlay')
  const pause = $('musicPause')
  let player, loading, shared, clockOffset
  let ready = false, nearby = false, dismissed = false, blocked = false, failed = false
  let loadedId = '', pendingState = null, lastUpdate = -Infinity, lastSync = -Infinity, lastSeek = -Infinity

  const audible = () => isConnected() && musicVolume(getPosition()) > 0 && !document.hidden && !panel.hidden && panel.getClientRects().length > 0

  function pauseLocal() {
    if (ready && [1, 3].includes(player.getPlayerState())) {
      pendingState = 2
      player.pauseVideo()
    }
  }

  function command(action, videoId) {
    if (!audible()) return
    blocked = failed = false
    const position = getPosition()
    send({ t: 'move', x: Math.round(position.x), y: Math.round(position.y) })
    send({ t: 'music-command', action, videoId, revision: shared?.revision })
    if (action === 'play') update(true)
  }

  function synchronize() {
    if (!ready || !shared || !audible()) { pauseLocal(); return }
    const volume = musicVolume(getPosition())
    if (player.getVolume() !== volume) player.setVolume(volume)
    if (failed || blocked) return
    const target = musicPosition(shared, performance.now() + clockOffset)
    const state = player.getPlayerState()
    if (state === pendingState) pendingState = null
    if (loadedId !== shared.videoId) {
      loadedId = shared.videoId
      pendingState = shared.playing ? 1 : 5
      const video = { videoId: loadedId, startSeconds: target }
      if (shared.playing) { player.unMute(); player.loadVideoById(video) }
      else player.cueVideoById(video)
      return
    }
    if ([1, 2, 5].includes(state) && Math.abs(player.getCurrentTime() - target) > 0.75 && performance.now() - lastSeek > 1500) {
      lastSeek = performance.now()
      pendingState = shared.playing ? 1 : 2
      player.seekTo(target, true)
    }
    if (shared.playing && ![1, 3].includes(state)) {
      pendingState = 1
      player.unMute()
      player.playVideo()
    } else if (!shared.playing) pauseLocal()
  }

  function update(force = false) {
    const now = performance.now()
    if (!force && now - lastUpdate < 250) return
    lastUpdate = now
    const near = isConnected() && musicVolume(getPosition()) > 0
    if (near && !nearby) { dismissed = blocked = failed = false; lastSync = -Infinity }
    nearby = near
    panel.hidden = !near || dismissed
    open.hidden = !near || !dismissed
    pause.disabled = !shared?.playing
    play.disabled = !shared
    play.textContent = blocked && shared?.playing ? 'Listen' : 'Play'
    $('musicRange').textContent = `Volume ${musicVolume(getPosition())}% · shared`
    if (near && now - lastSync >= 5000) {
      lastSync = now
      send({ t: 'music-sync', requestAt: now })
    }
    if (!audible() || !shared) { pauseLocal(); return }
    if (!ready && !loading && !failed) {
      void load().then(() => update(true)).catch((error) => { failed = true; status.textContent = error.message })
    }
    synchronize()
  }

  function load() {
    status.textContent = 'Loading YouTube…'
    loading = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube did not respond.')), 15000)
      function create() {
        player = new window.YT.Player('youtubePlayer', {
          width: '100%', height: 200,
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, origin: location.origin },
          events: {
            onReady() {
              clearTimeout(timeout)
              ready = true
              player.getIframe().title = 'Shared reading room music'
              status.textContent = ''
              resolve()
            },
            onStateChange(event) {
              const commanded = pendingState !== null
              if (event.data === pendingState) pendingState = null
              if (!audible() || !shared) { pauseLocal(); return }
              if (event.data === 1) { blocked = false; status.textContent = 'Playing' }
              else if (event.data === 2) status.textContent = 'Paused'
              if (player.getVideoData().video_id !== shared.videoId) return
              if (event.data === 0 && shared.playing) {
                const duration = player.getDuration()
                if (!commanded || (duration > 0 && musicPosition(shared, performance.now() + clockOffset) >= duration - 0.75)) {
                  pendingState = null
                  command('ended')
                }
                return
              }
              if (commanded) return
              if (event.data === 1 && !shared.playing) command('play')
              else if (event.data === 2 && shared.playing) command('pause')
            },
            onAutoplayBlocked() { blocked = true; play.textContent = 'Listen'; status.textContent = 'Playback blocked by browser.' },
            onError() { failed = true; status.textContent = 'This video is unavailable or cannot be embedded.' },
          },
        })
      }
      if (window.YT?.Player) create()
      else {
        window.onYouTubeIframeAPIReady = create
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load YouTube.')) }
        document.head.append(script)
      }
    }).catch((error) => {
      player?.destroy()
      player = null
      ready = false
      loading = null
      window.onYouTubeIframeAPIReady = () => {}
      $('musicVideo').replaceChildren(Object.assign(document.createElement('div'), { id: 'youtubePlayer' }))
      throw error
    })
    return loading
  }

  play.onclick = () => command('play')
  pause.onclick = () => command('pause')
  $('musicClose').onclick = () => {
    dismissed = true
    update(true)
    open.focus()
  }
  open.onclick = () => {
    dismissed = blocked = failed = false
    update(true)
    play.focus()
  }
  $('musicForm').onsubmit = (event) => {
    event.preventDefault()
    const id = youtubeId($('musicUrl').value)
    if (!id) { status.textContent = 'Enter a valid YouTube video link.'; return }
    command('load', id)
  }
  $('musicDefault').onclick = () => { $('musicUrl').value = ''; command('load', DEFAULT_VIDEO) }
  document.addEventListener('visibilitychange', () => update(true))
  update(true)
  return {
    update,
    onMessage(message) {
      if (message.t === 'music-error') { status.textContent = message.message; return }
      if (shared && message.revision < shared.revision) return
      const now = performance.now()
      if (typeof message.requestAt === 'number') clockOffset = message.serverNow - (message.requestAt + now) / 2
      else if (clockOffset === undefined) clockOffset = message.serverNow - now
      if (shared?.revision !== message.revision) { failed = false; status.textContent = '' }
      shared = message
      update(true)
    },
    reset() {
      shared = undefined
      clockOffset = undefined
      loadedId = ''
      pauseLocal()
      update(true)
    },
  }
}
