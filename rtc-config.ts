const stun = { urls: 'stun:stun.l.google.com:19302' }
let cached: { config: RTCConfiguration; until: number } | null = null

export async function getRTCConfig(): Promise<RTCConfiguration> {
  if (process.env.TURN_URLS && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    return { iceServers: [stun, {
      urls: process.env.TURN_URLS.split(',').map((url) => url.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    }] }
  }
  const key = process.env.CLOUDFLARE_TURN_KEY_ID
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!key || !token) return { iceServers: [stun] }
  if (cached && cached.until > Date.now()) return cached.config
  const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 86400 }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error(`TURN credentials failed: ${response.status}`)
  const config = await response.json() as RTCConfiguration
  if (!Array.isArray(config.iceServers) || !config.iceServers.some((server) => [server.urls].flat().some((url) => url.startsWith('turn')))) {
    throw new Error('TURN response has no relay')
  }
  cached = { config: { iceServers: config.iceServers }, until: Date.now() + 3600_000 }
  return cached.config
}
