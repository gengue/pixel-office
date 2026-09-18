// Shared artwork for the lobby, office and prototype; safe to import on the server.
const artwork = Object.fromEntries(['human', 'orco', 'lagarto', 'robot', 'fantasma'].map(kind => [kind, { cells:[], sideCells:[], danceCells:[] }]))
const tinted = new Map()
let danceLoading
const artKind = kind => kind === 'hombre' || kind === 'mujer' ? 'human' : kind

export const walkFrame = (walk, direction) => Math.floor(walk * (direction === 'left' || direction === 'right' ? .7 : .8)) % 4
export function movementDirection(dx, dy, previous = 'front') {
  if (Math.hypot(dx, dy) < .01) return previous
  return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'back' : 'front'
}

function measureCells(image, columns, rows, target, columnEdges, raisedArms = false) {
  // Measure each transparent cell once; keep source proportions and a shared scale.
  const sample = document.createElement('canvas')
  sample.width = image.width; sample.height = image.height
  const context = sample.getContext('2d', { willReadFrequently:true })
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, image.width, image.height)
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const sx = Math.floor((columnEdges?.[col] ?? col / columns) * image.width), sy = Math.floor(row * image.height / rows)
    const w = Math.floor((columnEdges?.[col + 1] ?? (col + 1) / columns) * image.width) - sx, h = Math.floor((row + 1) * image.height / rows) - sy
    let left = w, top = h, right = 0, bottom = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (data[((sy + y) * image.width + sx + x) * 4 + 3] < 32) continue
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
    const crop = [sx + left, sy + top, right - left + 1, bottom - top + 1]
    // Anchor each side pose at its collar, not the changing stride width.
    let neckLeft = right, neckRight = left
    for (let y = top; y < top + crop[3] * .04; y++) for (let x = left; x <= right; x++) {
      if (data[((sy + y) * image.width + sx + x) * 4 + 3] < 32) continue
      neckLeft = Math.min(neckLeft, x); neckRight = Math.max(neckRight, x)
    }
    crop.neckX = (neckLeft + neckRight) / 2 - left
    if (raisedArms) {
      // Hands can sit above the collar; locate its central opaque run instead.
      const middleLeft = Math.round(left + crop[2] * .4), middleRight = Math.round(left + crop[2] * .6)
      let neckY = top, neckX = middleLeft
      findCollar: for (; neckY <= bottom; neckY++) for (neckX = middleLeft; neckX <= middleRight; neckX++) {
        if (data[((sy + neckY) * image.width + sx + neckX) * 4 + 3] >= 32) break findCollar
      }
      let start = neckX, end = neckX
      const opaque = x => data[((sy + neckY) * image.width + sx + x) * 4 + 3] >= 32
      while (start > left && opaque(start - 1)) start--
      while (end < right && opaque(end + 1)) end++
      crop.neckX = (start + end) / 2 - left
      crop.neckY = neckY - top
    }
    target.push(crop)
  }
}

function loadDanceArt() {
  return danceLoading ??= new Promise(resolve => {
    const image = new Image()
    image.onload = () => {
      try {
        // Row gutters are measured from the shared five-character dance sheet.
        const edges = [0, 282, 546, 808, 1095, 1402]
        Object.values(artwork).forEach((art, row) => {
          const canvas = document.createElement('canvas')
          canvas.width = image.width; canvas.height = edges[row + 1] - edges[row]
          canvas.src = `${image.src}#${row}`
          canvas.getContext('2d').drawImage(image, 0, edges[row], image.width, canvas.height, 0, 0, image.width, canvas.height)
          measureCells(canvas, 4, 1, art.danceCells, [0, .273, .5, .744, 1], true)
          art.danceAtlas = canvas
        })
        resolve(true)
      } catch { resolve(false) }
    }
    image.onerror = () => resolve(false)
    image.src = '/assets/avatar-dance.png'
  })
}

export function loadAvatarArt(kind) {
  if (typeof Image === 'undefined') return Promise.resolve(false)
  if (!kind) return Promise.all(Object.keys(artwork).map(loadAvatarArt)).then(results => results.every(Boolean))
  const name = artKind(kind), art = artwork[name]
  if (!art) return Promise.resolve(false)
  const sources = [[`${name}-atlas.png`, 4, art.cells]]
  if (name !== 'fantasma') sources.push([`${name}-side-walk.png`, 2, art.sideCells, [0, .27, .52, .755, 1]])
  return art.loading ??= Promise.all([loadDanceArt(), ...sources.map(([file, rows, target, edges], index) => new Promise((resolve, reject) => {
    const image = new Image()
    if (index) art.sideAtlas = image; else art.atlas = image
    image.onload = () => {
      try { measureCells(image, 4, rows, target, edges); resolve() } catch (error) { reject(error) }
    }
    image.onerror = reject
    image.src = `/assets/${file}`
  }))]).then(results => results[0] !== false, () => false)
}

export function coloredImage(image, color, kind) {
  if (!color) return image
  const key = image.src + color
  if (tinted.has(key)) return tinted.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const rgb = color.match(/\w\w/g).map(channel => parseInt(channel, 16))
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b, alpha] = pixels.data.subarray(i, i + 4)
    // Recolor the robe or green material while preserving texture and luminance.
    const material = kind === 'fantasma' ? b > r * 1.05 && r > g * 1.03 : g > r * 1.03 && r > b * 1.1
    if (!alpha || !material || kind === 'orco' && b < r * .62) continue
    const light = g / 138
    for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.min(255, rgb[c] * light)
  }
  ctx.putImageData(pixels, 0, 0)
  // The fixed assets and five outfit colors bound this cache to 70 entries.
  tinted.set(key, canvas)
  return canvas
}

export function drawAvatarBody(ctx, px, py, scale, walk, sitting, options = {}) {
  const kind = options.kind ?? 'hombre'
  loadAvatarArt(kind)
  const art = artwork[artKind(kind)]
  if (!art || art.cells.length !== 16 || artKind(kind) !== 'fantasma' && art.sideCells.length !== 8) return null
  const { cells, sideCells, danceCells, atlas, sideAtlas, danceAtlas } = art
  const dancing = options.dancing && !sitting
  if (dancing && danceCells.length !== 4) return null
  const direction = dancing ? 'front' : options.direction ?? 'front'
  const moving = !sitting && !dancing && options.motion > .1
  const frame = walkFrame(walk, direction)
  const row = direction === 'back' ? 2 : direction === 'front' ? 0 : 1
  const lateral = moving && row === 1 && sideCells.length > 0
  const crop = dancing ? danceCells[Math.floor((options.time ?? 0) * 4) % 4] : lateral ? sideCells[frame * 2] : cells[sitting ? 13 : moving ? row * 4 + frame : row === 2 ? 15 : row === 0 ? 12 : 14]
  const ratio = scale * (dancing ? 16 / (danceCells[0][3] - danceCells[0].neckY) : sitting ? 12 / cells[13][3] : 16 / (lateral ? sideCells[0][3] : cells[12][3]))
  const width = crop[2] * ratio, height = crop[3] * ratio
  const neckY = dancing ? crop.neckY * ratio : 0
  const offset = scale * (sitting ? 12 : 16) - height + neckY
  ctx.save()
  ctx.translate(px + 6 * scale, py + offset)
  if (!sitting && (direction === 'left' || moving && row !== 1 && frame >= 2)) ctx.scale(-1, 1)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(coloredImage(dancing ? danceAtlas : lateral ? sideAtlas : atlas, options.color, kind), ...crop, -crop.neckX * ratio, -neckY, width, height)
  ctx.restore()
  return offset
}
