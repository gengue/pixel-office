import { roomAt } from './rooms.js'

// The turntable is already painted on the reading room's sideboard.
export const RECORD_PLAYER = { x: 474, y: 1450 }
const DEFAULT_VIDEO = 'ffnnMC-yMR0'

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

export function setupMusic(getPosition) {
  const $ = (id) => document.getElementById(id)
  const status = $('musicStatus')
  const play = $('musicPlay')
  const pause = $('musicPause')
  let player, loading, ready = false, videoId = DEFAULT_VIDEO
  let volume = 0, lastUpdate = 0
  let request = 0

  function stop() {
    request++
    if (ready) player.pauseVideo()
  }

  function update(force = false) {
    if (!force && performance.now() - lastUpdate < 150) return
    lastUpdate = performance.now()
    volume = musicVolume(getPosition())
    $('musicRange').textContent = volume ? `Volume ${volume}%` : 'Out of range'
    if (document.hidden || !$('musicPanel').getClientRects().length) { stop(); return }
    if (!ready) return
    if (player.getVolume() !== volume) player.setVolume(volume)
  }

  function load() {
    if (loading) return loading
    loading = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('YouTube did not respond. Check your connection and try again.')), 15000)
      function create() {
        player = new window.YT.Player('youtubePlayer', {
          width: '100%', height: 200, videoId,
          playerVars: { playsinline: 1, origin: location.origin },
          events: {
            onReady() {
              clearTimeout(timeout)
              ready = true
              player.getIframe().title = 'Reading room YouTube music player'
              update(true)
              resolve()
            },
            onStateChange(event) {
              pause.disabled = event.data !== 1 && event.data !== 3
              if (event.data === 1) {
                update(true)
                status.textContent = 'Playing'
              } else if (event.data === 2) status.textContent = 'Paused.'
              else if (event.data === 0) status.textContent = 'Finished'
            },
            onAutoplayBlocked() { status.textContent = 'Playback blocked by browser.' },
            onError() { status.textContent = 'YouTube could not play this video. It may be unavailable or block embedding. Try another link.' },
          },
        })
      }
      if (window.YT?.Player) create()
      else {
        window.onYouTubeIframeAPIReady = create
        const script = document.createElement('script')
        script.src = 'https://www.youtube.com/iframe_api'
        script.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('Could not load YouTube. Check your connection and try again.'))
        }
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

  async function start(id = videoId) {
    const currentRequest = ++request
    play.disabled = true
    status.textContent = 'Loading YouTube…'
    try {
      await load()
      update(true)
      if (currentRequest !== request) return
      player.unMute()
      if (id !== videoId) { videoId = id; player.loadVideoById(id) }
      else player.playVideo()
      status.textContent = ''
    } catch (error) { status.textContent = error.message }
    finally { play.disabled = false }
  }

  play.onclick = () => start()
  pause.onclick = stop
  $('musicClose').onclick = () => {
    stop()
    status.textContent = 'Paused.'
    $('musicPanel').hidden = true
    $('musicOpen').hidden = false
    $('musicOpen').focus()
  }
  $('musicOpen').onclick = () => {
    $('musicPanel').hidden = false
    $('musicOpen').hidden = true
    $('musicPlay').focus()
  }
  $('musicForm').onsubmit = (event) => {
    event.preventDefault()
    const id = youtubeId($('musicUrl').value)
    if (!id) { status.textContent = 'Enter a valid YouTube video link (youtube.com or youtu.be).'; return }
    void start(id)
  }
  $('musicDefault').onclick = () => { $('musicUrl').value = ''; void start(DEFAULT_VIDEO) }
  document.addEventListener('visibilitychange', () => update(true))
  return {
    update,
    pause: stop,
  }
}
