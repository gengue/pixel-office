import { test, expect } from 'bun:test'
import { youtubeId, musicVolume, setupMusic } from '../public/music.js'

test('accepts YouTube video links without accepting lookalike hosts or arbitrary URLs', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=ffnnMC-yMR0&list=abc',
    'https://youtu.be/ffnnMC-yMR0?si=abc',
    'https://m.youtube.com/shorts/ffnnMC-yMR0',
    'https://www.youtube.com/live/ffnnMC-yMR0',
    'https://www.youtube.com/embed/ffnnMC-yMR0',
  ]) expect(youtubeId(url)).toBe('ffnnMC-yMR0')
  for (const url of ['', 'ffnnMC-yMR0', 'javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=ffnnMC-yMR0', 'https://youtube.com/playlist?list=abc', 'https://youtu.be/short', 'ftp://youtube.com/watch?v=ffnnMC-yMR0']) {
    expect(youtubeId(url)).toBe(null)
  }
})

test('record player has medium volume nearby, fades with distance and cannot reach other rooms', () => {
  expect(musicVolume({ x: 474, y: 1450 })).toBe(50)
  expect(musicVolume({ x: 474, y: 1370 })).toBe(50)
  expect(musicVolume({ x: 474, y: 1250 })).toBe(25)
  expect(musicVolume({ x: 474, y: 1130 })).toBe(0)
  expect(musicVolume({ x: 474, y: 1050 })).toBe(0)
  expect(musicVolume({ x: 670, y: 1450 })).toBe(0)
})

test('music is hidden away from the turntable, joins the shared position and closes only for this listener', async () => {
  const original = Object.fromEntries(['document', 'window', 'location'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const nodes = new Map()
  let events, playerState = -1, time = 0, connected = true, live = false
  let position = { x: 120, y: 360 }
  const loads = [], sent = []
  const globals = {
    document: {
      hidden: false, addEventListener() {},
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, { getClientRects() { return this.hidden ? [] : [{}] }, focus() {} })
        return nodes.get(id)
      },
    },
    location: { origin: 'https://office.example' },
    window: { YT: { Player: class {
      constructor(_id, options) { events = options.events }
      getIframe() { return {} }
      getVolume() { return 50 }
      setVolume() {}
      unMute() {}
      getPlayerState() { return playerState }
      getCurrentTime() { return time }
      getDuration() { return 100 }
      getVideoData() { return { video_id: loads.at(-1)?.videoId, isLive: live } }
      pauseVideo() { playerState = 2; events.onStateChange({ data: 2 }) }
      playVideo() { playerState = 1; events.onStateChange({ data: 1 }) }
      loadVideoById(video) { loads.push(video); time = video.startSeconds; playerState = 1 }
      cueVideoById(video) { loads.push(video); time = video.startSeconds; playerState = 5 }
      seekTo(value) { time = value }
    } } },
  }
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
    const music = setupMusic({ getPosition: () => position, send: (message) => sent.push(message), isConnected: () => connected })
    expect(nodes.get('musicPanel').hidden).toBe(true)
    expect(nodes.get('musicOpen').hidden).toBe(true)
    music.onMessage({ t: 'music-state', videoId: 'ffnnMC-yMR0', playing: true, position: 30, updatedAt: 1000, serverNow: 11000, revision: 1 })
    expect(events).toBeUndefined()
    position = { x: 474, y: 1370 }
    music.update(true)
    expect(nodes.get('musicPanel').hidden).toBe(false)
    nodes.get('musicClose').onclick()
    events.onReady()
    await Promise.resolve()
    expect(loads).toHaveLength(0)
    expect(nodes.get('musicPanel').hidden).toBe(true)
    expect(nodes.get('musicOpen').hidden).toBe(false)
    nodes.get('musicOpen').onclick()
    expect(loads.at(-1).startSeconds).toBeGreaterThanOrEqual(40)
    expect(loads.at(-1).startSeconds).toBeLessThan(41)
    expect(sent.some((m) => m.t === 'music-command')).toBe(false)
    nodes.get('musicClose').onclick()
    expect(playerState).toBe(2)
    expect(sent.some((m) => m.action === 'pause')).toBe(false)
    music.update(true)
    expect(nodes.get('musicPanel').hidden).toBe(true)
    position = { x: 120, y: 360 }
    music.update(true)
    expect(nodes.get('musicOpen').hidden).toBe(true)
    position = { x: 474, y: 1370 }
    music.update(true)
    expect(nodes.get('musicPanel').hidden).toBe(false)
    expect(playerState).toBe(1)
    nodes.get('musicPause').onclick()
    expect(sent.at(-1).action).toBe('pause')
    music.onMessage({ t: 'music-state', videoId: 'ffnnMC-yMR0', playing: false, position: 55, updatedAt: 16000, serverNow: 16000, revision: 2 })
    expect(playerState).toBe(2)
    expect(time).toBe(55)
    music.onMessage({ t: 'music-state', videoId: 'ffnnMC-yMR0', playing: true, position: 0, updatedAt: 1000, serverNow: 11000, revision: 1 })
    expect(playerState).toBe(2)
    music.onMessage({ t: 'music-state', videoId: 'Nv2GgV34qIg', playing: true, position: 110, updatedAt: 16000, serverNow: 16000, revision: 3 })
    // YouTube restarts at zero when a returning listener loads beyond the end.
    time = 0
    music.update(true)
    expect(sent.at(-1)).toMatchObject({ action: 'ended', revision: 3 })
    expect(time).toBe(0)
    expect(playerState).toBe(2)
    music.onMessage({ t: 'music-state', videoId: 'Nv2GgV34qIg', playing: false, position: 110, updatedAt: 16000, serverNow: 16000, revision: 4 })
    expect(sent.at(-1)).toMatchObject({ action: 'ended', revision: 4 })
    live = true
    sent.length = 0
    music.onMessage({ t: 'music-state', videoId: 'Nv2GgV34qIg', playing: true, position: 110, updatedAt: 16000, serverNow: 16000, revision: 5 })
    expect(sent.some((m) => m.action === 'ended')).toBe(false)
    connected = false
    music.reset()
    expect(nodes.get('musicPanel').hidden).toBe(true)
    expect(nodes.get('musicOpen').hidden).toBe(true)
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
