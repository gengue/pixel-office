import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { validBoardOperation } from './public/whiteboard.js'

export function openWhiteboard(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path, { create: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run('CREATE TABLE IF NOT EXISTS board_operations (sequence INTEGER PRIMARY KEY, id TEXT UNIQUE NOT NULL, operation TEXT NOT NULL)')
  const snapshot = db.query('SELECT operation FROM board_operations ORDER BY sequence')
  const insert = db.query('INSERT OR IGNORE INTO board_operations (id, operation) VALUES (?, ?)')
  const count = db.query('SELECT COUNT(*) AS n FROM board_operations')
  return {
    snapshot: () => snapshot.all().map((row: any) => JSON.parse(row.operation)),
    append: db.transaction((op: any) => {
      if (!validBoardOperation(op)) throw new Error('Invalid drawing or text.')
      // ponytail: bound replay to 10,000 operations; add snapshot compaction if the board reaches this ceiling.
      if ((count.get() as { n: number }).n >= 10000) throw new Error('This board is full. Ask the office host to archive it.')
      const clean = op.tool === 'text'
        ? { id: op.id, tool: op.tool, color: op.color, size: op.size, at: op.at, text: op.text }
        : { id: op.id, tool: op.tool, color: op.color, size: op.size, points: op.points }
      return insert.run(op.id, JSON.stringify(clean)).changes ? clean : null
    }),
    close: () => db.close(),
  }
}
