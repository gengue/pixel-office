import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium', args:['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
try {
  const page = await browser.newPage({ permissions:['camera', 'microphone'], viewport:{width:390,height:844} })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const media = navigator.mediaDevices, original = media.getUserMedia.bind(media)
    window.connections = []
    const OriginalPC = window.RTCPeerConnection
    window.RTCPeerConnection = class extends OriginalPC {
      constructor(...args) { super(...args); window.connections.push(this) }
    }
    window.captured = []
    media.enumerateDevices = async () => ['video', 'audio'].flatMap(kind => [1,2,3].map(n => ({ kind:kind+'input', deviceId:kind+n, label:n===3?'Unavailable device':kind+' '+n })))
    media.getUserMedia = async constraints => {
      if (Object.values(constraints).some(value => value?.deviceId?.exact?.endsWith('3'))) throw new DOMException('Busy', 'NotReadableError')
      const clean = Object.fromEntries(Object.entries(constraints).map(([kind,value]) => [kind,value ? {...value,deviceId:undefined}:false]))
      const stream = await original(clean)
      for (const track of stream.getTracks()) {
        const setting = track.getSettings.bind(track), choice = constraints[track.kind]?.deviceId
        const id = choice?.exact || track.kind+'1'
        track.getSettings = () => ({...setting(),deviceId:id})
        window.captured.push(track)
      }
      return stream
    }
  })
  await page.goto(process.env.OFFICE_URL || 'https://workbox.bengal-balance.ts.net:8444/')
  await page.locator('#lobbyDevices').click()
  await page.locator('#cameraInput').waitFor()
  await page.waitForFunction(() => !document.querySelector('#cameraInput').disabled)
  await page.selectOption('#cameraInput','video2')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('po-inputs')).video === 'video2')
  await page.selectOption('#microphoneInput','audio2')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('po-inputs')).audio === 'audio2')
  assert.equal(await page.evaluate(() => document.querySelector('#devicePreview').srcObject.getVideoTracks()[0].getSettings().deviceId),'video2')
  await page.selectOption('#cameraInput','video3')
  await page.waitForFunction(() => document.querySelector('#devicesStatus').textContent.includes('Could not start'))
  assert.equal(await page.locator('#cameraInput').inputValue(),'video2')
  assert.equal(await page.evaluate(() => document.querySelector('#devicePreview').srcObject.getVideoTracks()[0].readyState),'live')
  await page.screenshot({path:'/tmp/pixel-device-settings.png'})
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => window.captured.every(track => track.readyState === 'ended'))
  await page.reload()
  await page.locator('#lobbyDevices').click()
  await page.waitForFunction(() => !document.querySelector('#cameraInput').disabled)
  assert.equal(await page.locator('#cameraInput').inputValue(),'video2')
  assert.equal(await page.locator('#microphoneInput').inputValue(),'audio2')
  assert.equal(await page.evaluate(() => document.querySelector('#devicePreview').srcObject.getVideoTracks()[0].getSettings().deviceId),'video2')
  await page.locator('#devicesClose').click()
  await page.locator('#name').fill('Device test')
  await page.locator('#joinBtn').click()
  await page.waitForFunction(() => document.querySelector('#selfVideo').srcObject?.getVideoTracks()[0]?.readyState === 'live')
  const peer = await browser.newPage({permissions:['camera','microphone']})
  await peer.goto(process.env.OFFICE_URL || 'https://workbox.bengal-balance.ts.net:8444/')
  await peer.locator('#name').fill('Device peer')
  await peer.locator('#joinBtn').click()
  await page.waitForFunction(() => window.connections.some(pc => pc.connectionState === 'connected'))
  await page.evaluate(() => window.activeConnection = window.connections.find(pc => pc.connectionState === 'connected'))
  await page.locator('#muteBtn').click()
  await page.locator('#cameraBtn').click()
  await page.locator('#devicesBtn').click()
  await page.waitForFunction(() => !document.querySelector('#cameraInput').disabled)
  await page.selectOption('#cameraInput','video1')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('po-inputs')).video === 'video1')
  await page.waitForFunction(() => window.activeConnection.getSenders().some(sender => sender.track?.kind === 'video' && sender.track.getSettings().deviceId === 'video1'))
  assert.equal(await page.evaluate(() => window.activeConnection.connectionState),'connected')
  assert(await page.evaluate(() => document.querySelector('#selfVideo').srcObject.getTracks().every(track => !track.enabled)))
  await page.locator('#devicesClose').click()
  await peer.close()
  assert.equal(await page.evaluate(() => document.querySelector('#selfVideo').srcObject.getVideoTracks()[0].readyState),'live')
  assert.deepEqual(errors,[])
  console.log('PASS: preview, both selectors, failed-device rollback, persistence, capture cleanup, in-office switch, mobile layout')
} finally { await browser.close() }
