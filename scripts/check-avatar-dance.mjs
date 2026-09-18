// Exercise the real browser renderer, including decoded sprite images.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox'] })
try {
  const page = await browser.newPage()
  for (const file of ['avatars.js', 'avatar-art.js']) {
    await page.route(`**/${file}`, async route => route.fulfill({ contentType:'text/javascript', body:await readFile(new URL(`../public/${file}`, import.meta.url), 'utf8') }))
  }
  await page.goto(process.env.OFFICE_URL || 'https://workbox.bengal-balance.ts.net:8444/')
  const result = await page.evaluate(async () => {
    const { drawBody, BODY_KINDS } = await import('/avatars.js')
    const { loadAvatarArt } = await import('/avatar-art.js')
    await loadAvatarArt()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 160
    const ctx = canvas.getContext('2d')
    const render = (kind, time, dancing, sitting = false) => {
      ctx.clearRect(0, 0, 160, 160)
      drawBody(ctx, kind, 56, 48, 4, time * 10, sitting, { time, dancing, motion:dancing ? 0 : 1, direction:'front' })
      return canvas.toDataURL()
    }
    return BODY_KINDS.map(kind => {
      const times = [.125, .375, .625, .875]
      const walk = new Set(times.map(t => render(kind, t, false)))
      const dance = times.map(t => render(kind, t, true))
      const pixels = ctx.getImageData(0, 0, 160, 160).data, colors = new Set()
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 32) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
      return { kind, detailed:colors.size > 100, distinct: dance.every(pose => !walk.has(pose)), animated:new Set(dance).size > 1, seated:render(kind, .375, true, true) === render(kind, .375, false, true) }
    })
  })
  for (const r of result) {
    assert(r.detailed, `${r.kind}: dance must use the detailed sprite, not the legacy fallback`)
    assert(r.distinct, `${r.kind}: dance must have its own poses, not replay the walking cycle`)
    assert(r.animated, `${r.kind}: dance must animate`)
    assert(r.seated, `${r.kind}: sitting must suppress dance`)
  }
  console.log('PASS: all six characters use distinct animated dance poses; sitting suppresses dance.')
} finally { await browser.close() }
