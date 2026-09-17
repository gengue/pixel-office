export const WORLD = { w: 2400, h: 1600 }
export const BODY_R = 14
const solids = []
function solid(x, y, w, h) {
  solids.push({ x, y, w, h })
}
export function hitsSolid(px, py, r = BODY_R, ignored) {
  for (const s of solids) {
    if (ignored && s.x === ignored.x && s.y === ignored.y && s.w === ignored.w && s.h === ignored.h) continue
    if (px + r > s.x && px - r < s.x + s.w && py + r > s.y && py - r < s.y + s.h) return true
  }
  return false
}

// ---------- office layout ----------
export const walls = [
  [0, 0, 2400, 24], [0, 1576, 2400, 24], [0, 0, 24, 1600], [2376, 0, 24, 1600],
  [24, 24, 1756, 100],
  [1780, 60, 580, 20], [1780, 60, 20, 220], [1780, 380, 20, 180],
  [2340, 60, 20, 500], [1780, 540, 220, 20], [2100, 540, 260, 20],
  // Restroom stalls, with a shared wash area and an east entrance.
  [40, 660, 580, 40], [40, 660, 20, 280], [600, 660, 20, 130], [600, 860, 20, 80], [40, 920, 580, 20],
  [230, 700, 12, 130], [410, 700, 12, 130],
  [60, 830, 60, 12], [200, 830, 42, 12], [242, 830, 58, 12], [380, 830, 42, 12],
  // Four-person huddle room; the west doorway stays clear.
  [1880, 630, 400, 20], [1880, 630, 20, 130], [1880, 860, 20, 60],
  [2260, 630, 20, 290], [1880, 900, 400, 20],
  [700, 940, 200, 20], [1000, 940, 400, 20], [1500, 940, 200, 20],
]
// furn: [type, x, y, w, h, extra]
export const furn = [
  ['rug', 120, 120, 360, 200, '#7c5cff33'],
  ['sofaH', 150, 140, 130, 52], ['sofaH', 350, 140, 130, 52, 'tealSofa'], ['ctable', 270, 260, 80, 44, 'bistro'],
  ['plant', 540, 145, 28, 24, 'palm'], ['plant', 70, 145, 24, 20, 'snake'],
  ['desk', 820, 220], ['desk', 1120, 220, 150, 70, 'laptopDesk'], ['desk', 1420, 220],
  ['desk', 820, 560, 150, 70, 'laptopDesk'], ['desk', 1120, 560], ['desk', 1420, 560, 150, 70, 'laptopDesk'],
  ['chair', 881, 312], ['chair', 1181, 312], ['chair', 1481, 312],
  ['chair', 881, 652], ['chair', 1181, 652], ['chair', 1481, 652],
  ['shelf', 1500, 140, 200, 26, 'studioArchive'],
  ['plant', 1730, 165, 26, 22, 'rubber'],
  ['planter', 1640, 360, 100, 26], ['planter', 1640, 700, 100, 26],
  ['rug', 1850, 150, 440, 300, '#ffffff10'],
  ['ctableBig', 1920, 245, 300, 120],
  ['chair', 1970, 197], ['chair', 2070, 197], ['chair', 2170, 197],
  ['chair', 1970, 389], ['chair', 2070, 389], ['chair', 2170, 389],
  ['chair', 1878, 283], ['chair', 2228, 283],
  ['board', 1980, 88, 220, 40],
  ['plant', 2280, 465, 28, 24, 'palm'], ['plant', 2300, 165, 24, 20, 'snake'],
  ['rug', 140, 1100, 380, 300, '#7c5cff22'],
  ['armchair', 150, 1150, 68, 48, 'mustardChair'], ['armchair', 450, 1150, 68, 48],
  ['armchair', 150, 1310, 68, 48], ['armchair', 450, 1310, 68, 48, 'mustardChair'],
  ['ctable', 260, 1230, 130, 64, 'bistro'],
  ['shelf', 120, 1476, 240, 26, 'readingLibrary'], ['sideboard', 420, 1450, 150, 36],
  ['plant', 590, 1120, 26, 22, 'rubber'], ['plant', 90, 1390, 24, 20, 'fern'],
  ['counterH', 1740, 1150, 220, 44], ['counterH', 1740, 1370, 108, 44, 'snackTrolley'],
  ['fridge', 2280, 1060, 56, 64],
  ['dtable', 1980, 1260, 180, 90],
  ['chair', 2020, 1212, 28, 28, 'diningChair'], ['chair', 2100, 1212, 28, 28, 'diningChair'],
  ['chair', 2020, 1378, 28, 28, 'diningChair'], ['chair', 2100, 1378, 28, 28, 'diningChair'],
  ['plant', 2280, 1480, 24, 20, 'flowers'], ['water', 2210, 1090, 38, 34],
  ['sofaH', 880, 1150, 180, 54, 'gardenBench'],
  ['ctable', 1160, 1230, 150, 70, 'parasol'],
  ['sofaH', 880, 1390, 180, 54, 'gardenBench'], ['sofaH', 1290, 1390, 180, 54, 'gardenBench'],
  ['plant', 790, 1140, 30, 28, 'olive'], ['plant', 1530, 1150, 30, 28, 'olive'],
  ['planter', 800, 1490, 160, 30, 'herbPlanter'], ['planter', 1370, 1490, 160, 30, 'herbPlanter'],
  ['plant', 1520, 1390, 24, 20, 'flowers'],
  ['toilet', 130, 740, 48, 50], ['toilet', 310, 740, 48, 50], ['vanity', 465, 735, 100, 50],
  ['ctableBig', 2000, 780, 170, 70],
  ['chair', 2000, 735], ['chair', 2110, 735], ['chair', 2000, 860], ['chair', 2110, 860],
  ['plant', 2215, 735, 24, 20, 'snake'],
  ['tv', 380, 590, 150, 40], ['sideboard', 80, 610, 180, 36, 'welcomeConsole'],
  ['plant', 560, 610, 24, 20, 'snake'],
]
for (const [x, y, w, h] of walls) solid(x, y, w, h)
for (const [t, x, y, w, h] of furn) {
  if (t === 'plant') solid(x, y, w ?? 20, h ?? 20)
  else if (['board', 'shelf', 'fridge', 'tv', 'armchair', 'planter', 'sideboard', 'water', 'toilet', 'vanity'].includes(t)) solid(x, y, w, h)
  else if (t.includes('table') || t === 'desk' || t.startsWith('sofa') || t.startsWith('counter')) {
    solid(x, y, t === 'desk' ? 150 : w, t === 'desk' ? 70 : h)
  }
}
