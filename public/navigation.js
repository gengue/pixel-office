import { WORLD, hitsSolid, walls } from './world.js'
import { roomAt, fullRoomAt } from './rooms.js'

const GRID = 16
const COLS = WORLD.w / GRID
const ROWS = WORLD.h / GRID
const point = (i) => ({ x: (i % COLS) * GRID, y: Math.floor(i / COLS) * GRID })
export function clearSegment(a, b, blocked = hitsSolid) {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4)
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0
    if (blocked(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false
  }
  return true
}

// A fixed 16px grid is sufficient for this office's doorways.
export function pathToPerson(start, target, occupants = []) {
  const blocked = (x, y) => (start.body !== 'fantasma' && hitsSolid(x, y)) || !!fullRoomAt({ id: start.id, x, y }, occupants)
  const adjacent = (p) => {
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    return d >= 48 && d <= 80 && roomAt(p) === roomAt(target) && (start.body === 'fantasma' || clearSegment(p, target,
      (x, y) => walls.some(([wx, wy, w, h]) => x >= wx && x <= wx + w && y >= wy && y <= wy + h)))
  }
  if (blocked(start.x, start.y)) return null
  if (adjacent(start)) return []
  const parents = new Int32Array(COLS * ROWS).fill(-1)
  const queue = []
  const sx = Math.round(start.x / GRID), sy = Math.round(start.y / GRID)
  for (let y = sy - 1; y <= sy + 1; y++) for (let x = sx - 1; x <= sx + 1; x++) {
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue
    const i = y * COLS + x
    if (clearSegment(start, point(i), blocked)) { parents[i] = -2; queue.push(i) }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head], p = point(i)
    if (adjacent(p)) {
      const path = []
      for (let j = i; j >= 0; j = parents[j]) path.push(point(j))
      return path.reverse()
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = i % COLS + dx, y = Math.floor(i / COLS) + dy
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue
      const next = y * COLS + x
      if (parents[next] !== -1 || !clearSegment(p, point(next), blocked)) continue
      parents[next] = i
      queue.push(next)
    }
  }
  return null
}
