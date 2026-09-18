import { WORLD, walls, furn } from '../world.js'
import { ROOMS } from '../rooms.js'
import { createOfficeArt } from '../office-art.js'
import { drawBody } from '../avatars.js'
import { loadAvatarArt, transformDanceHead } from '../avatar-art.js'

const $ = id => document.getElementById(id)
const scene = $('scene').getContext('2d')
const detail = $('detail').getContext('2d')
const office = createOfficeArt(WORLD, ROOMS, walls, furn)
const reference = new Image()
const video = document.createElement('video')
video.autoplay = video.muted = video.playsInline = true
const state = { walking: !matchMedia('(prefers-reduced-motion: reduce)').matches, sitting:false, dancing:false, danceTime:0, direction:'auto', speed:1, distance:0, travel:0, velocity:0, stream:null }

function updateControls() {
  $('walk').setAttribute('aria-pressed', String(state.walking))
  $('dance').setAttribute('aria-pressed', String(state.dancing))
  $('dance').textContent = state.dancing ? 'Dejar de bailar' : 'Bailar'
  $('sit').setAttribute('aria-pressed', String(state.sitting))
  $('walk').textContent = state.walking ? 'Pausar' : 'Caminar'
  $('sit').textContent = state.sitting ? 'Levantarse' : 'Sentarse'
  $('direction').disabled = state.sitting || state.dancing
}
$('walk').onclick = () => { state.walking = !state.walking; state.sitting = state.dancing = false; updateControls() }
$('sit').onclick = () => { state.sitting = !state.sitting; state.walking = state.dancing = false; state.velocity = 0; updateControls() }
$('dance').onclick = () => { state.dancing = !state.dancing; state.walking = state.sitting = false; state.velocity = 0; state.danceTime = 0; updateControls() }
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

function loadCharacter() {
  const kind = $('character').value
  $('status').textContent = 'Cargando personaje…'
  loadAvatarArt(kind).then(ready => {
    if ($('character').value === kind) $('status').textContent = ready ? 'Listo para probar.' : 'No se pudo cargar este personaje. Se muestra el cuerpo anterior.'
  })
}
$('character').onchange = loadCharacter
loadCharacter()
reference.src = './avatar-reference.png'

function avatar(ctx, x, footY, facing) {
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
    drawBody(ctx, $('character').value, -24, sitting ? -44 : -60, 4, state.distance / 10, sitting, { dancing:state.dancing, time:state.danceTime, motion:moving ? 1 : 0, facing:facing === 'left' ? -1 : 1, classic:true, appearance:{ color:'forest', accessory:'satchel' } })
    headY = sitting ? -58 : -74
  } else {
    const bodyY = sitting ? -48 : -68
    const offset = drawBody(ctx, $('character').value, sitting ? -24 : -25.5, bodyY, sitting ? 4 : 4.25, state.distance / 8, sitting, { direction:facing, motion:moving ? 1 : 0, dancing:state.dancing, time:state.danceTime }) ?? 0
    headY = bodyY + offset - 16
  }
  ctx.save()
  if (!original) transformDanceHead(ctx, $('character').value, state.dancing, sitting, state.danceTime, 0, headY)
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
  ctx.restore()
}

let last = performance.now()
function render(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now
  state.velocity += ((state.walking ? 80 * state.speed : 0) - state.velocity) * (1 - Math.exp(-10 * dt))
  if (!state.walking && state.velocity < 1) state.velocity = 0
  if (state.dancing && !matchMedia('(prefers-reduced-motion: reduce)').matches) state.danceTime += dt * state.speed
  state.distance += dt * state.velocity
  if (state.direction === 'auto') state.travel += dt * state.velocity
  const travel = state.travel % 960
  const x = travel < 420 ? 620 + travel : travel < 480 ? 1040 : travel < 900 ? 1040 - (travel - 480) : 620
  const y = travel < 420 ? 420 : travel < 480 ? 420 + travel - 420 : travel < 900 ? 480 : 480 - (travel - 900)
  const facing = state.direction === 'auto' ? travel < 420 ? 'right' : travel < 480 ? 'front' : travel < 900 ? 'left' : 'back' : state.direction
  scene.imageSmoothingEnabled = detail.imageSmoothingEnabled = false
  scene.clearRect(0, 0, 880, 520)
  if (office.ready) {
    scene.save(); scene.scale(.8, .8); scene.translate(-40, -30)
    office.ground(scene)
    let drawn = false
    for (const object of office.objects) {
      if (!drawn && object.bottom > y) { avatar(scene, x, y, facing); drawn = true }
      office.draw(scene, object)
    }
    if (!drawn) avatar(scene, x, y, facing)
    scene.restore()
  }
  detail.clearRect(0, 0, 600, 560)
  { detail.save(); detail.translate(300, 490); detail.scale(4.5, 4.5); avatar(detail, 0, 0, facing); detail.restore() }
  requestAnimationFrame(render)
}
requestAnimationFrame(render)
