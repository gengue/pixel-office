import { test, expect } from 'bun:test'
import { setupScreenShare } from '../public/screen-share.js'

test('screen viewer starts empty, survives a brief boundary crossing, and closes on revoked audience', async () => {
  const nodes = new Map()
  const element = () => ({
    classList: { toggle() {}, remove() {}, contains: () => false },
    setAttribute() {}, replaceChildren() {}, play: async () => {}, readyState: 2,
  })
  const connections = []
  const globals = {
    document: {
      getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, element())
        return nodes.get(id)
      },
      querySelector: element,
    },
    navigator: { mediaDevices: {} },
    Option: class {},
    RTCPeerConnection: class {
      closed = false
      constructor() { connections.push(this) }
      close() { this.closed = true }
      async setRemoteDescription() {}
      async createAnswer() { return { type: 'answer', sdp: 'test' } }
      async setLocalDescription() {}
    },
  }
  const original = Object.fromEntries(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  let screen
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
    const me = { id: 'viewer', x: 1801, y: 200 }
    const owner = { id: 'owner', x: 1900, y: 200 }
    const sent = []
    screen = setupScreenShare({
      send: (message) => sent.push(message), getConfig: () => ({}),
      getMe: () => me, getPeers: () => new Map([[owner.id, owner]]), isConnected: () => true,
    })
    expect(nodes.get('screenPanel').hidden).toBe(true)
    expect(nodes.get('screenVideo').srcObject).toBe(null)

    await screen.onMessage({ t: 'share-state', shares: [{ id: 'share', owner: owner.id, room: 2 }], viewers: [] })
    await screen.onMessage({ t: 'screen-signal', id: 'share', from: owner.id, data: { kind: 'offer', sdp: {} } })
    const stream = {}
    connections[0].ontrack({ streams: [stream] })
    expect(nodes.get('screenVideo').srcObject).toBe(stream)
    expect(sent[0].data.kind).toBe('answer')

    me.x = 1799.8
    screen.update()
    expect(nodes.get('screenPanel').hidden).toBe(true)
    expect(nodes.get('screenVideo').srcObject).toBe(null)
    expect(connections[0].closed).toBe(false)

    me.x = 1800.2
    screen.update()
    expect(nodes.get('screenPanel').hidden).toBe(false)
    expect(nodes.get('screenVideo').srcObject).toBe(stream)
    expect(connections).toHaveLength(1)

    await screen.onMessage({ t: 'share-state', shares: [], viewers: [] })
    expect(connections[0].closed).toBe(true)
    expect(nodes.get('screenPanel').hidden).toBe(true)
    expect(nodes.get('screenVideo').srcObject).toBe(null)
  } finally {
    try { screen?.reset() } finally {
      for (const [key, descriptor] of Object.entries(original)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else delete globalThis[key]
      }
    }
  }
})
