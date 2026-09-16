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

test('disconnect cancels a play request while YouTube is still loading', async () => {
  const original = Object.fromEntries(['document', 'window', 'location'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  const nodes = new Map()
  let events, playRequests = 0
  const globals = {
    document: {
      hidden: false, addEventListener() {},
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, { getClientRects: () => [{}] })
        return nodes.get(id)
      },
    },
    location: { origin: 'https://office.example' },
    window: { YT: { Player: class {
      constructor(_id, options) { events = options.events }
      getIframe() { return {} }
      getVolume() { return 50 }
      unMute() {}
      pauseVideo() {}
      playVideo() { playRequests++ }
    } } },
  }
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
    const music = setupMusic(() => ({ x: 474, y: 1370 }))
    const pending = nodes.get('musicPlay').onclick()
    music.pause()
    events.onReady()
    await pending
    expect(playRequests).toBe(0)
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
