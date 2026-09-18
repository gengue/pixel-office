// Run with Playwright installed; PLAYWRIGHT_MODULE can point to an existing installation.
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const context = await browser.newContext({ viewport:{ width:1280, height:900 }, permissions:['camera'] })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const url = process.env.PREVIEW_URL || 'https://workbox.bengal-balance.ts.net:8444/proposals/avatars.html'
const pixels = () => page.locator('#detail').evaluate(canvas => canvas.toDataURL())
try {
  await page.goto(url)
  await page.getByText('Listo para probar.', { exact:true }).waitFor()
  await page.locator('#direction').selectOption('right')
  const walking = await pixels()
  await page.waitForTimeout(160)
  assert.notEqual(await pixels(), walking, 'Walking must animate')
  await page.locator('#walk').click()
  await page.waitForTimeout(650)
  const paused = await pixels()
  await page.waitForTimeout(160)
  assert.equal(await pixels(), paused, 'Pause must settle to a still pose')
  await page.locator('#direction').selectOption('front')
  await page.waitForTimeout(60)
  const front = await pixels()
  await page.screenshot({ path:'/tmp/avatar-preview-front.png', fullPage:true })
  await page.locator('#direction').selectOption('back')
  await page.waitForTimeout(60)
  assert.notEqual(await pixels(), front, 'Back must have its own pose')
  await page.locator('#sit').click()
  await page.waitForTimeout(60)
  assert.equal(await page.locator('#sit').getAttribute('aria-pressed'), 'true')
  assert.notEqual(await pixels(), front, 'Seated pose must differ')
  await page.screenshot({ path:'/tmp/avatar-preview-seated.png', fullPage:true })
  const seated = await pixels()
  await page.locator('#original').check()
  await page.waitForTimeout(60)
  assert.notEqual(await pixels(), seated, 'Comparison must draw the existing body')
  await page.locator('#original').uncheck()
  await page.locator('#camera').click()
  await page.getByRole('button', { name:'Apagar cámara', exact:true }).waitFor()
  await page.locator('#camera').click()
  assert.equal(await page.locator('#camera').textContent(), 'Probar con mi cámara')
  await page.setViewportSize({ width:390, height:844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile must not overflow')
  await page.screenshot({ path:'/tmp/avatar-preview-mobile.png', fullPage:true })
  await page.emulateMedia({ reducedMotion:'reduce' })
  await page.reload()
  await page.getByText('Listo para probar.', { exact:true }).waitFor()
  assert.equal(await page.locator('#walk').getAttribute('aria-pressed'), 'false', 'Reduced motion must start paused')
  const motion = await context.newPage()
  motion.on('pageerror', error => errors.push(error.message))
  await motion.addInitScript(() => {
    performance.now = () => 0
    window.requestAnimationFrame = callback => { window.advanceAvatarFrame = callback; return 1 }
  })
  await motion.goto(url)
  await motion.getByText('Listo para probar.', { exact:true }).waitFor()
  for (const direction of ['right', 'left']) for (const speed of [100, 150]) {
    await motion.locator('#direction').selectOption(direction)
    await motion.locator('#speed').fill(String(speed))
    const result = await motion.evaluate(speed => {
      const ctx = document.querySelector('#detail').getContext('2d')
      let time = window.avatarTestTime || 0
      for (let i = 0; i < 90; i++) window.advanceAvatarFrame(time += 1000 / 60)
      let previous = ctx.getImageData(175, 285, 255, 215).data
      const start = previous
      let cycleDifference = 0
      const changes = []
      for (let i = 0; i < 60; i++) {
        window.advanceAvatarFrame(time += 1000 / 60)
        const current = ctx.getImageData(175, 285, 255, 215).data
        let changed = 0
        for (let p = 0; p < current.length; p += 4) {
          if (Math.abs(current[p] - previous[p]) + Math.abs(current[p + 1] - previous[p + 1]) + Math.abs(current[p + 2] - previous[p + 2]) + Math.abs(current[p + 3] - previous[p + 3]) > 80) changed++
        }
        changes.push(changed / (255 * 215))
        if (i === Math.round(30 * 100 / speed) - 1) {
          for (let p = 0; p < current.length; p += 4) {
            if (Math.abs(current[p] - start[p]) + Math.abs(current[p + 1] - start[p + 1]) + Math.abs(current[p + 2] - start[p + 2]) + Math.abs(current[p + 3] - start[p + 3]) > 80) cycleDifference++
          }
          cycleDifference /= 255 * 215
        }
        previous = current
      }
      window.avatarTestTime = time
      return { peak:Math.max(...changes), movingFrames:changes.filter(value => value > 0).length, cycleDifference }
    }, speed)
    assert(result.cycleDifference < .005, `${direction}: lateral cadence must complete a cycle every 40 world pixels (${result.cycleDifference})`)
    // The previous lateral atlas jumped across 47.5% of this region in one frame.
    assert(result.peak < .08 * speed / 100, `${direction} at ${speed}%: abrupt limb jump (${result.peak})`)
    assert(result.movingFrames >= 55, `${direction}: motion must progress between poses`)
    console.log(`Lateral ${direction} ${speed}%: peak pixel change ${(result.peak * 100).toFixed(1)}%, ${result.movingFrames}/60 moving frames`)
  }
  await motion.screenshot({ path:'/tmp/avatar-side-smooth.png', fullPage:true })
  await motion.close()
  assert.deepEqual(errors, [], 'No browser errors')
  console.log('Avatar preview: animation, pause, directions, seated pose, comparison, camera, mobile and reduced motion passed.')
} finally { await browser.close() }
