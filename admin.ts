import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from 'node:process' // Keep runtime NODE_ENV; Bun inlines process.env.NODE_ENV when bundling.

const SESSION_SECONDS = 90 * 24 * 60 * 60
const digest = (value: string) => createHash('sha256').update(value).digest()

export function openAdmin(directory: string) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const passwordFile = join(directory, 'password.txt')
  try {
    writeFileSync(passwordFile, randomBytes(24).toString('base64url') + '\n', { flag: 'wx', mode: 0o600 })
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error
  }
  chmodSync(passwordFile, 0o600)
  const password = readFileSync(passwordFile, 'utf8').trim()
  if (password.length < 32) throw new Error('Admin password file must contain at least 32 characters.')
  const passwordHash = digest(password)
  const credential = passwordHash.toString('hex')
  const db = new Database(join(directory, 'sessions.sqlite'), { create: true })
  db.run('PRAGMA busy_timeout = 5000')
  db.run('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL, credential TEXT NOT NULL)')
  db.run('DELETE FROM sessions WHERE expires <= ? OR credential != ?', [Date.now(), credential])
  const find = db.query('SELECT 1 FROM sessions WHERE token = ? AND expires > ? AND credential = ?')
  let attempts = 0, resetAt = 0
  const secure = (req: Request) => env.NODE_ENV === 'production' || new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'
  const cookieName = (req: Request) => secure(req) ? '__Host-po-admin' : 'po-admin'
  function token(req: Request) {
    const prefix = cookieName(req) + '='
    return (req.headers.get('cookie') ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) ?? ''
  }
  function isAdmin(value: string) {
    return /^[\w-]{43}$/.test(value) && !!find.get(digest(value).toString('hex'), Date.now(), credential)
  }
  function sameOrigin(req: Request) {
    const url = new URL(req.url)
    return req.headers.get('origin') === `${secure(req) ? 'https:' : url.protocol}//${url.host}`
  }
  function cookie(req: Request, value: string, maxAge: number) {
    return `${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`
  }
  return {
    token, isAdmin, sameOrigin,
    async handle(req: Request, revoke: (token: string) => void) {
      const reply = (body: object, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra } })
      if (req.method === 'GET') return reply({ admin: isAdmin(token(req)) })
      if (!['POST', 'DELETE'].includes(req.method)) return reply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, DELETE' })
      if (!sameOrigin(req)) return reply({ error: 'Open this page from the office address.' }, 403)
      if (req.method === 'DELETE') {
        const current = token(req)
        db.run('DELETE FROM sessions WHERE token = ?', [digest(current).toString('hex')])
        revoke(current)
        return reply({ admin: false }, 200, { 'Set-Cookie': cookie(req, '', 0) })
      }
      if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'Expected JSON.' }, 415)
      // ponytail: a shared login budget suits one owner; use per-client limits if admin traffic grows.
      if (Date.now() >= resetAt) { attempts = 0; resetAt = Date.now() + 60000 }
      if (attempts >= 20) return reply({ error: 'Too many attempts. Try again in a minute.' }, 429, { 'Retry-After': '60' })
      attempts++
      let input
      try { input = await req.json() } catch { return reply({ error: 'Invalid request.' }, 400) }
      if (typeof input?.password !== 'string' || input.password.length > 256 || !timingSafeEqual(digest(input.password), passwordHash)) {
        return reply({ error: 'Incorrect password.' }, 401)
      }
      const session = randomBytes(32).toString('base64url')
      db.transaction(() => {
        db.run('DELETE FROM sessions WHERE expires <= ? OR token = ?', [Date.now(), digest(token(req)).toString('hex')])
        db.run('INSERT INTO sessions (token, expires, credential) VALUES (?, ?, ?)', [digest(session).toString('hex'), Date.now() + SESSION_SECONDS * 1000, credential])
      })()
      revoke(token(req))
      return reply({ admin: true }, 200, { 'Set-Cookie': cookie(req, session, SESSION_SECONDS) })
    },
  }
}
