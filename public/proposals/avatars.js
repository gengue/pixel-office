import { WORLD, walls, furn } from '../world.js'
import { ROOMS } from '../rooms.js'
import { createOfficeArt } from '../office-art.js'
import { drawBody } from '../avatars.js'

const $ = id => document.getElementById(id)
const scene = $('scene').getContext('2d')
const detail = $('detail').getContext('2d')
const office = createOfficeArt(WORLD, ROOMS, walls, furn)
const atlas = new Image()
const sideAtlas = new Image()
const reference = new Image()
const video = document.createElement('video')
video.autoplay = video.muted = video.playsInline = true
const state = { walking: !matchMedia('(prefers-reduced-motion: reduce)').matches, sitting:false, direction:'auto', speed:1, distance:0, travel:0, velocity:0, stream:null }
const cells = []
const sideCells = []
let loaded = false

function updateControls() {
  $('walk').setAttribute('aria-pressed', String(state.walking))
  $('sit').setAttribute('aria-pressed', String(state.sitting))
  $('walk').textContent = state.walking ? 'Pausar' : 'Caminar'
  $('sit').textContent = state.sitting ? 'Levantarse' : 'Sentarse'
  $('direction').disabled = state.sitting
}
$('walk').onclick = () => { state.walking = !state.walking; state.sitting = false; updateControls() }
$('sit').onclick = () => { state.sitting = !state.sitting; state.walking = false; state.velocity = 0; updateControls() }
$('direction').onchange = event => { state.direction = event.target.value }
$('speed').oninput = event => { state.speed = Number(event.target.value) / 100; $('speed-value').textContent = `${state.speed}×` }
updateControls()

function stopCamera() {
  state.stream?.getTracks().forEach(track => track.stop())
  state.stream = null
  video.srcObject = null
  $('camera').textContent = 'Probar con mi cámara'
  $('status').textContent = 'Foto de muestra.'
}
$('camera').onclick = async () => {
  if (state.stream) { stopCamera(); return }
  $('camera').disabled = true
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:false })
    video.srcObject = state.stream
    await video.play()
    $('camera').textContent = 'Apagar cámara'
    $('status').textContent = 'Cámara local activada.'
  } catch {
    stopCamera()
    $('status').textContent = 'No se pudo abrir la cámara. Puedes seguir con la foto de muestra.'
  } finally { $('camera').disabled = false }
}
addEventListener('pagehide', stopCamera)

function measureCells(image, columns, rows, target) {
  // Measure each transparent cell once; keep source proportions and a shared scale.
  const sample = document.createElement('canvas')
  sample.width = image.width; sample.height = image.height
  const context = sample.getContext('2d', { willReadFrequently:true })
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, image.width, image.height)
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const sx = Math.floor(col * image.width / columns), sy = Math.floor(row * image.height / rows)
    const w = Math.floor((col + 1) * image.width / columns) - sx, h = Math.floor((row + 1) * image.height / rows) - sy
    let left = w, top = h, right = 0, bottom = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[((sy + y) * image.width + sx + x) * 4 + 3] < 32) continue
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
    target.push([sx + left, sy + top, right - left + 1, bottom - top + 1])
  }
  loaded = cells.length > 0 && sideCells.length > 0
  if (loaded) $('status').textContent = 'Listo para probar.'
}
atlas.onload = () => measureCells(atlas, 4, 4, cells)
sideAtlas.onload = () => measureCells(sideAtlas, 2, 3, sideCells)
atlas.onerror = sideAtlas.onerror = reference.onerror = () => { $('status').textContent = 'No se pudieron cargar las imágenes. Recarga la página.' }
atlas.src = './avatar-atlas.png'
sideAtlas.src = './avatar-side-parts.png'
reference.src = './avatar-reference.png'

function drawSide(ctx, facing) {
  const amount = Math.min(1, state.velocity / 40)
  // Match the front/back cycle distance so side steps keep pace with travel.
  const stride = Math.sin(state.distance * Math.PI * 2 / 40) * amount
  function part(index, x, y, height, angle = 0, mirror = false) {
    const crop = sideCells[index], width = crop[2] * height / crop[3]
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
    if (mirror) ctx.scale(-1, 1)
    ctx.drawImage(sideAtlas, ...crop, -width * .45, -3, width, height)
    ctx.restore()
  }
  ctx.save()
  if (facing === 'left') ctx.scale(-1, 1)
  // Continuous joint motion keeps the torso, backpack and limb silhouettes stable.
  part(2, 3, -59, 32, stride * .13)
  part(4, 1, -32, 35, stride * .24, true)
  part(3, 1, -32, 35, -stride * .24)
  part(0, -5, -64, 38)
  part(1, -2, -59, 32, -stride * .13)
  ctx.restore()
}

function avatar(ctx, x, footY, facing, frame) {
  const sitting = state.sitting
  const moving = !sitting && state.velocity > 1
  const original = $('original').checked
  ctx.save()
  ctx.translate(Math.round(x), Math.round(footY))
  ctx.fillStyle = '#3b463d24'
  ctx.beginPath(); ctx.ellipse(0, 1, 25, 7, 0, 0, Math.PI * 2); ctx.fill()
  if (sitting && office.ready) office.draw(ctx, { type:'chair', x:-25, y:-64, w:50, h:66 })
  let headY = sitting ? -65 : -90
  if (original) {
    drawBody(ctx, 'hombre', -24, sitting ? -44 : -60, 4, state.distance / 10, sitting, { motion:moving ? 1 : 0, facing:facing === 'left' ? -1 : 1, appearance:{ color:'forest', accessory:'satchel' } })
    headY = sitting ? -58 : -74
  } else if (!sitting && (facing === 'left' || facing === 'right')) {
    drawSide(ctx, facing)
    headY = -83
  } else {
    const row = facing === 'back' ? 2 : facing === 'front' ? 0 : 1
    const index = sitting ? 13 : moving ? row * 4 + frame : facing === 'back' ? 15 : facing === 'front' ? 12 : 14
    const crop = cells[index]
    const scale = 68 / cells[12][3]
    const width = crop[2] * scale, height = crop[3] * scale
    ctx.save()
    // The front/back contacts share a leading leg; mirror the second half-cycle.
    if (!sitting && (facing === 'left' || moving && row !== 1 && frame >= 2)) ctx.scale(-1, 1)
    ctx.drawImage(atlas, ...crop, -width / 2, -height, width, height)
    ctx.restore()
    headY = -height - 16
  }
  ctx.save()
  ctx.beginPath(); ctx.arc(0, headY, 22, 0, Math.PI * 2); ctx.clip()
  if (state.stream && video.readyState >= 2) {
    const side = Math.min(video.videoWidth, video.videoHeight)
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, -22, headY - 22, 44, 44)
  } else if (reference.complete && reference.naturalWidth) {
    ctx.drawImage(reference, 1080, 228, 140, 140, -22, headY - 22, 44, 44)
  }
  ctx.restore()
  ctx.strokeStyle = '#456b56'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(0, headY, 22, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

let last = performance.now()
function render(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now
  state.velocity += ((state.walking ? 80 * state.speed : 0) - state.velocity) * (1 - Math.exp(-10 * dt))
  if (!state.walking && state.velocity < 1) state.velocity = 0
  state.distance += dt * state.velocity
  if (state.direction === 'auto') state.travel += dt * state.velocity
  const travel = state.travel % 960
  const x = travel < 420 ? 620 + travel : travel < 480 ? 1040 : travel < 900 ? 1040 - (travel - 480) : 620
  const y = travel < 420 ? 420 : travel < 480 ? 420 + travel - 420 : travel < 900 ? 480 : 480 - (travel - 900)
  const facing = state.direction === 'auto' ? travel < 420 ? 'right' : travel < 480 ? 'front' : travel < 900 ? 'left' : 'back' : state.direction
  const frame = Math.floor(state.distance / 10) % 4
  scene.imageSmoothingEnabled = detail.imageSmoothingEnabled = false
  scene.clearRect(0, 0, 880, 520)
  if (office.ready) {
    scene.save(); scene.scale(.8, .8); scene.translate(-40, -30)
    office.ground(scene)
    let drawn = false
    for (const object of office.objects) {
      if (!drawn && object.bottom > y && loaded) { avatar(scene, x, y, facing, frame); drawn = true }
      office.draw(scene, object)
    }
    if (!drawn && loaded) avatar(scene, x, y, facing, frame)
    scene.restore()
  }
  detail.clearRect(0, 0, 600, 560)
  if (loaded) { detail.save(); detail.translate(300, 490); detail.scale(4.5, 4.5); avatar(detail, 0, 0, facing, frame); detail.restore() }
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
