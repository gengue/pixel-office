// Pixel bodies 12x16. '.' = transparente. Cabeza = webcam (no incluida aqui).
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

export function drawBody(ctx, kind, px, py, scale = 4, walk = 0, sitting = false) {
  const def = BODIES[kind] ?? BODIES.hombre
  const pal = { ...def.palette, ...(def.extra ?? {}) }
  const bob = sitting ? 0 : Math.abs(Math.sin(walk)) * 2
  for (let r = 0; r < def.rows.length; r++) {
    // Fold the legs into a short seated pose, preserving each body's palette.
    if (sitting && r >= 10 && r <= 12) continue
    const rowY = sitting && r > 12 ? r - 3 : r
    const row = def.rows[r]
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      ctx.fillStyle = pal[ch] ?? '#fff'
      ctx.fillRect(Math.round(px + c * scale), Math.round(py + rowY * scale - bob), scale, scale)
    }
  }
}

export function bodySize(scale = 4) {
  return { w: 12 * scale, h: 16 * scale }
}

export function renderPreview(canvas, kind) {
  const ctx = canvas.getContext('2d')
  const s = 6
  canvas.width = 12 * s
  canvas.height = 16 * s
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawBody(ctx, kind, 0, 0, s, 0)
}
