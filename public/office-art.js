// Atlas regions are measured in source pixels, excluding neighboring sprites.
const regions = {
  desk: [30, 60, 275, 235], sofaH: [355, 88, 264, 207],
  chair: [718, 80, 168, 222], plant: [995, 42, 230, 255],
  shelf: [30, 315, 276, 302], ctable: [350, 395, 268, 194],
  ctableBig: [630, 401, 349, 185], fridge: [1020, 315, 156, 302],
  counterH: [24, 669, 318, 239], lamp: [419, 635, 119, 274],
  art: [632, 640, 262, 256], window: [932, 664, 304, 232],
  water: [102, 926, 117, 290], sofaV: [354, 956, 217, 250],
  aquarium: [622, 944, 276, 267], board: [934, 954, 294, 210],
}
const varietyRegions = {
  snake: [89, 30, 201, 386], palm: [397, 40, 307, 370],
  rubber: [793, 45, 230, 369], fern: [1105, 119, 318, 291],
  tealSofa: [12, 450, 362, 270], bistro: [440, 463, 271, 255],
  mustardChair: [779, 437, 280, 285], diningChair: [1190, 445, 168, 276],
  planter: [12, 738, 363, 295], sideboard: [380, 738, 366, 302],
  laptopDesk: [751, 785, 374, 255], flowers: [1160, 757, 246, 284],
}
const outdoorRegions = {
  toilet: [145, 100, 195, 380], vanity: [570, 32, 315, 460],
  gardenBench: [1004, 150, 460, 334], parasol: [58, 518, 375, 450],
  olive: [538, 500, 370, 470], herbPlanter: [968, 580, 535, 365],
}
const storageRegions = {
  welcomeConsole: [30, 435, 483, 430],
  studioArchive: [540, 320, 457, 545],
  readingLibrary: [1024, 175, 508, 690],
}
const plantSizes = { snake: [36, 96], palm: [86, 112], rubber: [58, 94], fern: [62, 56], flowers: [44, 52], olive: [90, 116] }

export function createOfficeArt(world, floors, walls, furniture) {
  const image = new Image()
  const variety = new Image()
  const outdoors = new Image()
  const storage = new Image()
  const snacks = new Image()
  const ground = document.createElement('canvas')
  ground.width = world.w
  ground.height = world.h
  const g = ground.getContext('2d')
  g.imageSmoothingEnabled = false
  let ready = false
  const objects = []

  const rect = (color, x, y, w, h) => {
    g.fillStyle = color
    g.fillRect(x, y, w, h)
  }
  function rug(x, y, w, h, color) {
    rect('#716a5b24', x + 5, y + 5, w, h)
    rect(color, x, y, w, h)
    g.strokeStyle = '#f6efdb88'
    g.lineWidth = 2
    g.strokeRect(x + 7, y + 7, w - 14, h - 14)
    g.strokeRect(x + 12, y + 12, w - 24, h - 24)
    for (let dy = 20; dy < h - 16; dy += 12)
      for (let dx = 20; dx < w - 16; dx += 12)
        rect('#ffffff16', x + dx, y + dy, 3, 2)
  }
  function sprite(type, x, bottom, width, height) {
    objects.push({ type, x, y: bottom - height, w: width, h: height, bottom })
  }
  function paintGround() {
    rect('#e6d2b5', 0, 0, world.w, world.h)
    const wood = ['#e9d6ba', '#e5cfad', '#e1c9a6', '#ecdac0']
    for (let y = 0; y < world.h; y += 24) {
      for (let x = -(y % 48 ? 60 : 0); x < world.w; x += 120) {
        rect(wood[((x + 60) / 60 + y / 24) % 4], x, y, 118, 22)
        rect('#f6e6cd', x + 1, y + 1, 116, 1)
        rect('#b7976c22', x + 18, y + 14, 42, 1)
      }
    }
    for (const f of floors) {
      if (f.surface === 'outdoor') {
        rect(f.c, f.x, f.y, f.w, f.h)
        // Lawn, spaced flagstones and a sunlit timber deck distinguish the open-air space.
        for (let y = f.y + 10; y < f.y + f.h; y += 18)
          for (let x = f.x + 8; x < f.x + f.w; x += 22) {
            rect('#74986455', x, y, 3, 5)
            rect('#d0db9844', x + 8, y + 7, 4, 2)
          }
        rect('#96764e', 830, 1110, 680, 360)
        for (let y = 1114; y < 1470; y += 24) {
          rect('#d4b88b', 834, y, 672, 21)
          rect('#efdbb2', 834, y, 672, 2)
        }
        for (const x of [940, 1440]) for (const y of [1060, 1090]) rect('#eee8d6', x, y, 40, 22)
        rect('#74825e', f.x, 1530, f.w, 8)
        for (let x = f.x; x <= f.x + f.w; x += 60) rect('#556e4e', x, 1512, 6, 26)
      } else if (f.surface === 'tile' || f.label === 'COFFEE & COMPANY') {
        rect(f.c, f.x, f.y, f.w, f.h)
        for (let y = 0; y < f.h; y += 32)
          for (let x = 0; x < f.w; x += 32)
            rect((x / 32 + y / 32) % 2 ? '#eef0e5' : f.c, f.x + x, f.y + y, Math.min(30, f.w - x), Math.min(30, f.h - y))
      } else if (f.label === 'THE STUDIO') {
        rug(760, 145, 870, 260, f.c)
        rug(760, 485, 870, 260, f.c)
      } else rug(f.x, f.y, f.w, f.h, f.c)
      g.font = '600 13px system-ui'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      const width = g.measureText(f.label).width + 30
      rect('#faf5e8e8', f.lx - width / 2, f.ly - 12, width, 24)
      g.fillStyle = '#58675e'
      g.fillText(f.label, f.lx, f.ly)
    }
    for (const [t, x, y, w, h] of furniture) {
      if (t === 'rug') rug(x, y, w, h, y < 500 ? '#c0b5ce' : '#b6c6ba')
    }
    for (const [x, y, w, h] of walls) {
      rect('#687c7228', x + 7, y + 7, w, h)
      rect('#68796f', x, y, w, h)
      rect('#a8b7a4', x, y, w, Math.min(h, 9))
      rect('#e4e8d7', x, y, w, 3)
      rect('#4e6258', x, y + h - 3, w, 3)
    }
    // Windows sit within the wall face, above a continuous wainscot and baseboard.
    rect('#bccbb4', 24, 24, 1756, 100)
    rect('#dce3cd', 24, 24, 1756, 5)
    rect('#8fa78e', 24, 99, 1756, 21)
    for (let x = 40; x < 1780; x += 64) rect('#a8bca2', x, 103, 2, 17)
    rect('#e2e6d2', 24, 97, 1756, 3)
    rect('#627b64', 24, 120, 1756, 4)
    rect('#485f4824', 24, 124, 1756, 5)
  }
  paintGround()
  for (const [t, x, y, w, h, variant] of furniture) {
    if (t === 'rug') continue
    const art = variant || t
    if (t === 'plant') {
      const [width, height] = plantSizes[art] ?? [52, 64]
      sprite(art, x + (w ?? 20) / 2 - width / 2, y + (h ?? 20), width, height)
    }
    else if (t === 'desk') sprite(art, x, y + 70, 150, art === 'laptopDesk' ? 102 : 126)
    else if (t === 'chair') sprite(art, x - (variant ? 5 : 11), y + 36, variant ? 38 : 50, 66)
    else if (t === 'shelf') sprite(art, x, y + h, w, art === 'readingLibrary' ? 180 : art === 'studioArchive' ? 150 : 122)
    else if (t === 'sofaH') sprite(art, x, y + h, w, art === 'gardenBench' ? 130 : 96)
    else if (t === 'armchair') sprite(variant || 'sofaV', x, y + h, w, 76)
    else if (t === 'planter' || t === 'sideboard') sprite(art, x, y + h, w, Math.round(w * (art === 'herbPlanter' ? 0.68 : 0.82)))
    else if (t === 'toilet') sprite(t, x, y + h, w, 94)
    else if (t === 'vanity') sprite(t, x, y + h, w, 146)
    else if (art === 'parasol') sprite(art, x, y + h, w, 180)
    else if (t === 'water') sprite(t, x, y + h, w, 94)
    else if (t === 'counterH') sprite(art, x, y + h, w, Math.round(w * (art === 'snackTrolley' ? 0.94 : 239 / 318)))
    else if (t === 'sofaV') {
      sprite(t, x - 5, y + 80, w + 10, 76)
      sprite(t, x - 5, y + h, w + 10, 76)
    } else if (t === 'tv') sprite('aquarium', x, y + h, w, 116)
    else if (t === 'dtable') sprite('ctableBig', x, y + h, w, h + 20)
    else sprite(art, x, y + h, w, t === 'fridge' ? 104 : t === 'board' ? 70 : h + 24)
  }
  // Wall-mounted accents do not change the walkable floor.
  for (const x of [90, 395, 800, 1130]) sprite('window', x, 96, 82, 62)
  sprite('art', 270, 90, 55, 54)
  sprite('art', 1820, 127, 60, 60)
  // These props sit inside existing non-walkable furniture footprints.
  sprite('lamp', 470, 190, 28, 73)
  sprite('lamp', 550, 1476, 28, 73)
  objects.sort((a, b) => a.bottom - b.bottom)
  const overview = document.createElement('canvas')
  overview.width = 240
  overview.height = 160
  function drawSprite(ctx, object, scale = 1) {
    if (object.type === 'snackTrolley') {
      ctx.drawImage(snacks, 160, 190, 965, 885, object.x * scale, object.y * scale, object.w * scale, object.h * scale)
      return
    }
    const extra = varietyRegions[object.type]
    const outdoor = outdoorRegions[object.type]
    const cabinet = storageRegions[object.type]
    ctx.drawImage(cabinet ? storage : outdoor ? outdoors : extra ? variety : image, ...(cabinet || outdoor || extra || regions[object.type]), object.x * scale, object.y * scale, object.w * scale, object.h * scale)
  }
  let loaded = 0
  image.onload = variety.onload = outdoors.onload = storage.onload = snacks.onload = () => {
    if (++loaded < 5) return
    const m = overview.getContext('2d')
    m.drawImage(ground, 0, 0, overview.width, overview.height)
    for (const object of objects) drawSprite(m, object, 0.1)
    ready = true
  }
  image.src = '/assets/office-atlas.png'
  variety.src = '/assets/office-variety.png'
  outdoors.src = '/assets/office-outdoors.png'
  storage.src = '/assets/office-storage.png'
  snacks.src = '/assets/snack-trolley.png'

  return {
    get ready() { return ready },
    ground(ctx) { ctx.drawImage(ground, 0, 0) },
    objects,
    overview,
    draw: drawSprite,
  }
}
