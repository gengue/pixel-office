import { test, expect } from 'bun:test'
import { createOfficeArt } from '../public/office-art.js'

test('office atlas loads before use and every furniture crop stays within the image', () => {
  const previousDocument = globalThis.document
  const previousImage = globalThis.Image
  const draws = []
  const atlases = []
  const context = {
    fillRect() {}, strokeRect() {}, fillText() {},
    measureText: () => ({ width: 50 }),
    drawImage: (...args) => draws.push(args),
  }
  globalThis.document = { createElement: () => ({ getContext: () => context }) }
  globalThis.Image = class { constructor() { atlases.push(this) } }
  try {
    const types = ['desk', 'chair', 'plant', 'shelf', 'ctable', 'ctableBig', 'fridge', 'counterH', 'sofaH', 'sofaV', 'tv', 'board', 'dtable', 'rug', 'armchair', 'planter', 'sideboard', 'water', 'toilet', 'vanity']
    const furniture = types.map((type) => [type, 100, 300, 150, 70])
    for (const [type, variant] of [['plant', 'snake'], ['plant', 'palm'], ['plant', 'rubber'], ['plant', 'fern'], ['plant', 'flowers'], ['sofaH', 'tealSofa'], ['chair', 'diningChair'], ['armchair', 'mustardChair'], ['ctable', 'bistro'], ['desk', 'laptopDesk'], ['sofaH', 'gardenBench'], ['plant', 'olive'], ['planter', 'herbPlanter'], ['ctable', 'parasol'], ['shelf', 'studioArchive'], ['shelf', 'readingLibrary'], ['sideboard', 'welcomeConsole'], ['counterH', 'snackTrolley']])
      furniture.push([type, 100, 300, 150, 70, variant])
    const art = createOfficeArt({ w: 2400, h: 1600 }, [], [], furniture)
    expect(art.ready).toBe(false)
    expect(atlases[0].src).toBe('/assets/office-atlas.png')
    atlases[0].onload()
    expect(art.ready).toBe(false)
    expect(atlases[1].src).toBe('/assets/office-variety.png')
    atlases[1].onload()
    expect(art.ready).toBe(false)
    expect(atlases[2].src).toBe('/assets/office-outdoors.png')
    atlases[2].onload()
    expect(art.ready).toBe(false)
    expect(atlases[3].src).toBe('/assets/office-storage.png')
    atlases[3].onload()
    expect(art.ready).toBe(false)
    expect(atlases[4].src).toBe('/assets/snack-trolley.png')
    atlases[4].onload()
    expect(art.ready).toBe(true)
    for (const object of art.objects) art.draw(context, object)
    const spriteDraws = draws.filter(([source]) => atlases.includes(source))
    expect(spriteDraws.length).toBeGreaterThan(types.length)
    for (const [source, x, y, w, h, dx, dy, dw, dh] of spriteDraws) {
      expect([x, y, w, h, dx, dy, dw, dh].every(Number.isFinite)).toBe(true)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(x + w).toBeLessThanOrEqual(source === atlases[0] || source === atlases[4] ? 1254 : source === atlases[1] ? 1448 : 1536)
      expect(y + h).toBeLessThanOrEqual(source === atlases[0] || source === atlases[4] ? 1254 : source === atlases[1] ? 1086 : 1024)
      expect(dw).toBeGreaterThan(0)
      expect(dh).toBeGreaterThan(0)
    }
    expect(art.objects.map((o) => o.bottom)).toEqual(art.objects.map((o) => o.bottom).sort((a, b) => a - b))
    for (const window of art.objects.filter((o) => o.type === 'window')) {
      expect(window.y).toBeGreaterThanOrEqual(29)
      expect(window.bottom).toBeLessThan(97)
    }
  } finally {
    globalThis.document = previousDocument
    globalThis.Image = previousImage
  }
})
