export const ROOMS = [
  { x: 40, y: 40, w: 580, h: 380, c: '#d9d4c1', label: 'WELCOME LOUNGE', lx: 330, ly: 340 },
  { x: 680, y: 60, w: 1040, h: 820, c: '#a8bbb2', label: 'THE STUDIO', lx: 1200, ly: 440 },
  { x: 1800, y: 80, w: 540, h: 460, c: '#b9b3c9', label: 'MEETING ROOM', alias: 'meeting', arrival: { x: 1850, y: 330 }, lx: 2070, ly: 162 },
  { x: 60, y: 1000, w: 600, h: 540, c: '#b9c4a6', label: 'THE READING ROOM', lx: 360, ly: 1052 },
  { x: 1700, y: 1020, w: 650, h: 520, c: '#d5ddca', label: 'COFFEE & COMPANY', lx: 2090, ly: 1078 },
  { x: 60, y: 700, w: 540, h: 220, c: '#d7e4df', label: 'RESTROOMS', lx: 330, ly: 894, surface: 'tile' },
  { x: 760, y: 1000, w: 840, h: 540, c: '#a8c58c', label: 'THE TERRACE', lx: 1180, ly: 1040, surface: 'outdoor' },
  { x: 1900, y: 650, w: 360, h: 250, c: '#c4c3d7', label: 'HUDDLE ROOM', alias: 'huddle', arrival: { x: 1940, y: 810 }, lx: 2080, ly: 678, capacity: 4 },
]

export function roomAt(p, rooms = ROOMS) {
  return rooms.findIndex((room) => p.x >= room.x && p.x < room.x + room.w && p.y >= room.y && p.y < room.y + room.h)
}

export function fullRoomAt(position, occupants) {
  const index = roomAt(position)
  const room = ROOMS[index]
  if (!room?.capacity) return null
  return occupants.filter((p) => p.id !== position.id && roomAt(p) === index).length >= room.capacity ? room : null
}
