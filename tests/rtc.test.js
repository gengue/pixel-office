import { test, expect } from 'bun:test'
import { addRemoteIce, setRemoteDescription } from '../public/rtc.js'

test('ICE arriving before the remote offer is kept until the description is ready', async () => {
  const received = []
  const pc = {
    remoteDescription: null,
    async setRemoteDescription(value) { await Promise.resolve(); this.remoteDescription = value },
    async addIceCandidate(candidate) { if (!this.remoteDescription) throw Error('No description'); received.push(candidate) },
  }
  await addRemoteIce(pc, 'early')
  expect(received).toEqual([])
  await setRemoteDescription(pc, { type: 'offer' })
  await addRemoteIce(pc, 'late')
  expect(received).toEqual(['early', 'late'])
})
