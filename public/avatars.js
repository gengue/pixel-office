// Pixel bodies 12x16. '.' is transparent; the webcam head is drawn separately.
export const BODIES = {
  hombre: {
    label: 'Man',
    palette: { C: '#3b82f6', S: '#f1c27d', D: '#1e40af', P: '#1e3a8a', B: '#1f2937' },
    rows: [
      '..CCCCCCCC..',
      '.CCCCCCCCCC.',
      '.CSCCCCCCSC.',
      '.CSCCCCCCSC.',
      '.CSCCCCCCSC.',
      '..CCCCCCCC..',
      '..CDDDDDDC..',
      '..CDDDDDDC..',
      '..PPPPPPPP..',
      '..PPPPPPPP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..BBB..BBB..',
      '.BBBB..BBBB.',
      '............',
    ],
  },
  mujer: {
    label: 'Woman',
    palette: { C: '#ec4899', S: '#ffdbac', D: '#be185d', P: '#831843', B: '#3f3f46' },
    rows: [
      '..CCCCCCCC..',
      '.ECCCCCCCCE.',
      '.ESCCCCCCSE.',
      '.ESCCCCCCSE.',
      '.ECCCCCCCCE.',
      '..CDDDDDDC..',
      '.CCDDDDDDCC.',
      '.CCDDDDDDCC.',
      '.CCCDDDDCCC.',
      '..CCDDDDCC..',
      '..SSDDDDSS..',
      '..SSDDDDSS..',
      '..BBB..BBB..',
      '..BBB..BBB..',
      '.BBBB..BBBB.',
      '............',
    ],
    extra: { E: '#f9a8d4' },
  },
  orco: {
    label: 'Orc',
    palette: { C: '#4d7c0f', S: '#65a30d', D: '#78350f', P: '#44403c', B: '#292524', E: '#fefce8' },
    rows: [
      'E.CCCCCCCC.E',
      'ECCCCCCCCCCE',
      '.CSCCCCCCSC.',
      '.CSCECCECSC.',
      '.CSCCCCCCSC.',
      '..CCCCCCCC..',
      '..DDDDDDDD..',
      '..DDDDDDDD..',
      '..PPPPPPPP..',
      '..PPPPPPPP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..BBB..BBB..',
      '.BBBB..BBBB.',
      '............',
    ],
  },
  lagarto: {
    label: 'Lizard',
    palette: { C: '#10b981', S: '#34d399', D: '#059669', P: '#065f46', B: '#064e3b', E: '#fde047' },
    rows: [
      '..CCCCCCCC..',
      '.CCCCDCCCCC.',
      '.CSCCCCCDSC.',
      '.CSCCCCCCSC.',
      'EESCCCCCCSEE',
      '..CCCCCCCC..',
      '..CDDDCDDC..',
      '..CDDDCDDC..',
      '..PPPPPPPP.E',
      '..PPPPPPPPEE',
      '..PPP..PPEE.',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..BBB..BBB..',
      '.BBBB..BBBB.',
      '............',
    ],
  },
  robot: {
    label: 'Robot',
    palette: { C: '#9ca3af', S: '#d1d5db', D: '#374151', P: '#4b5563', B: '#111827', E: '#22d3ee' },
    rows: [
      '..DDDDDDDD..',
      '.DCCCCCCCCD.',
      '.DCSCEEECSD.',
      '.DCSCEEECSD.',
      '.DCSCCCCSCD.',
      '..DCEEEECD..',
      '..DDDDDDDD..',
      '..DCDDDDCD..',
      '..PPPPPPPP..',
      '..PDP..PDP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..PPP..PPP..',
      '..BBB..BBB..',
      '.BBBB..BBBB.',
      '............',
    ],
  },
  fantasma: {
    label: 'Ghost',
    palette: { C: '#c7d2fe', S: '#e0e7ff', D: '#818cf8', P: '#a5b4fc', B: '#6366f1', E: '#312e81' },
    rows: [
      '..CCCCCCCC..',
      '.CCCCCCCCCC.',
      '.CCCCCCCCCC.',
      '.CCEECCEECC.',
      '.CCEECCEECC.',
      '.CCCCCCCCCC.',
      '..CCCCCCCC..',
      '..CDDDDDDC..',
      '..CDDDDDDC..',
      '..CCCCCCCC..',
      '..CCC..CCC..',
      '..CC....CC..',
      '..C......C..',
      '............',
      '............',
      '............',
    ],
  },
}

export const BODY_KINDS = Object.keys(BODIES)

export const OUTFIT_COLORS = {
  original: { label: 'Original' },
  forest: { label: 'Forest', C: '#5c8a68', D: '#355940' },
  ocean: { label: 'Ocean', C: '#568fae', D: '#315873' },
  rose: { label: 'Rose', C: '#c87985', D: '#884956' },
  amber: { label: 'Amber', C: '#d6aa54', D: '#927038' },
  lilac: { label: 'Lilac', C: '#9a86bc', D: '#675080' },
}
export const ACCESSORIES = { none: 'None', scarf: 'Scarf', satchel: 'Satchel' }

export function normalizeAppearance(value) {
  return {
    color: typeof value?.color === 'string' && Object.hasOwn(OUTFIT_COLORS, value.color) ? value.color : 'original',
    accessory: typeof value?.accessory === 'string' && Object.hasOwn(ACCESSORIES, value.accessory) ? value.accessory : 'none',
  }
}

export function drawBody(ctx, kind, px, py, scale = 4, walk = 0, sitting = false, options = {}) {
  const def = BODIES[kind] ?? BODIES.hombre
  const appearance = normalizeAppearance(options.appearance)
  const pal = { ...def.palette, ...(def.extra ?? {}), ...OUTFIT_COLORS[appearance.color] }
  const motion = sitting ? 0 : (options.motion ?? 0)
  const dancing = options.dancing && !sitting
  const stride = dancing ? Math.sin((options.time ?? 0) * 6) : Math.sin(walk) * motion
  const bob = sitting ? 0 : Math.abs(Math.sin(walk * 2)) * motion * 1.5 + Math.sin((options.time ?? 0) * 2) * (1 - motion) * 0.6
  const pixel = (x, y, w = 1, h = 1) => ctx.fillRect(
    Math.round(px + (options.facing === -1 ? 12 - x - w : x) * scale),
    Math.round(py + y * scale - bob), w * scale, h * scale,
  )
  for (let r = 0; r < def.rows.length; r++) {
    // Fold the legs into a short seated pose, preserving each body's palette.
    if (sitting && r >= 10 && r <= 12) continue
    const rowY = sitting && r > 12 ? r - 3 : r
    const row = def.rows[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      const side = c < 6 ? -1 : 1
      const limb = r >= 10 ? Math.max(0, stride * side) * 1.2
        : r >= 2 && r <= 5 && (c < 3 || c > 8) ? (dancing ? 2 : 0) + stride * -side * (dancing ? 1.5 : 0.7) : 0
      ctx.fillStyle = pal[ch] ?? '#fff'
      pixel(c, rowY - limb)
    }
  }
  if (appearance.accessory === 'scarf') {
    ctx.fillStyle = '#e7b859'
    pixel(2, 0, 8, 2)
    pixel(7, 2, 2, 4)
    ctx.fillStyle = '#ae733c'
    pixel(7, 5, 2, 1)
  } else if (appearance.accessory === 'satchel') {
    ctx.fillStyle = '#594331'
    for (let i = 0; i < 8; i++) pixel(2 + i, i, 1, 2)
    pixel(8, 6, 4, 4)
    ctx.fillStyle = '#b18554'
    pixel(8, 6, 4, 1)
    ctx.fillStyle = '#e4c678'
    pixel(9, 7)
  }
}

export function bodySize(scale = 4) {
  return { w: 12 * scale, h: 16 * scale }
}

export function renderPreview(canvas, kind, appearance = {}, time = 0, moving = false) {
  const ctx = canvas.getContext('2d')
  const s = 6
  canvas.width = 12 * s
  canvas.height = 16 * s
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawBody(ctx, kind, 0, 4, s, time * 9, false, { appearance, time, motion: moving ? 1 : 0 })
}
