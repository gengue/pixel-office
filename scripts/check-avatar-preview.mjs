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
  for (const speed of [100, 150]) {
    let approvedTiming
    for (const direction of ['front', 'back', 'right', 'left']) {
      await motion.reload()
      await motion.getByText('Listo para probar.', { exact:true }).waitFor()
      await motion.locator('#direction').selectOption(direction)
      await motion.locator('#speed').fill(String(speed))
      const result = await motion.evaluate(() => {
        const canvas = document.querySelector('#detail')
        let time = 0
        for (let i = 0; i < 90; i++) window.advanceAvatarFrame(time += 1000 / 60)
        let previous = canvas.toDataURL()
        const changes = [], poses = new Set([previous])
        for (let i = 0; i < 60; i++) {
          window.advanceAvatarFrame(time += 1000 / 60)
          const current = canvas.toDataURL()
          if (current !== previous) changes.push(i)
          poses.add(current)
          previous = current
        }
        return { changes, poses:poses.size }
      })
      approvedTiming ??= result.changes
      assert.deepEqual(result.changes, approvedTiming, `${direction}: frame changes must match approved front pacing`)
      assert.equal(result.poses, 4, `${direction}: four whole-body poses must repeat without deformation`)
      console.log(`${direction} ${speed}%: ${result.poses} poses, ${result.changes.length} changes/second; timing matches front`)
    }
  }
  await motion.screenshot({ path:'/tmp/avatar-side-smooth.png', fullPage:true })
  await motion.close()
  assert.deepEqual(errors, [], 'No browser errors')
  console.log('Avatar preview: animation, pause, directions, seated pose, comparison, camera, mobile and reduced motion passed.')
} finally { await browser.close() }
