const candidates = new WeakMap()

export async function addRemoteIce(pc, candidate) {
  if (pc.remoteDescription) return pc.addIceCandidate(candidate)
  const queue = candidates.get(pc) ?? []
  queue.push(candidate)
  candidates.set(pc, queue)
}

export async function setRemoteDescription(pc, description) {
  await pc.setRemoteDescription(description)
  const queue = candidates.get(pc) ?? []
  candidates.delete(pc)
  for (const candidate of queue) await pc.addIceCandidate(candidate)
}
