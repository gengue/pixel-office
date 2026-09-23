const defaults = { video:{ width:{ ideal:320 }, height:{ ideal:240 } }, audio:{ echoCancellation:true, noiseSuppression:true } }
export const mediaError = error => ['NotAllowedError', 'SecurityError'].includes(error?.name)
  ? 'Allow camera and microphone in your browser, then try again.'
  : ['NotFoundError', 'OverconstrainedError'].includes(error?.name)
    ? 'That device is unavailable. Connect it or choose another device.'
    : 'Could not start that device. Check whether another app is using it and try again.'

export function createMediaInputs({ mediaDevices, storage, enabled, onStream, replaceTrack, onEnded }) {
  let preferences = {}, stream = null, pending = null, generation = 0
  try { preferences = JSON.parse(storage.getItem('po-inputs') || '{}') || {} } catch {}
  preferences = Object.fromEntries(['audio', 'video'].map(kind => [kind, typeof preferences[kind] === 'string' ? preferences[kind] : '']))
  const constraint = (kind, id) => ({ ...defaults[kind], ...(id ? { deviceId:{ exact:id } } : {}) })
  const stopTracks = value => value?.getTracks().forEach(track => track.stop())

  function capture(constraints, requested) {
    const version = generation
    const operation = (async () => {
      const next = await mediaDevices.getUserMedia(constraints)
      const tracks = next.getTracks()
      if (version !== generation) { stopTracks(next); throw new DOMException('Capture cancelled.', 'AbortError') }
      if (Object.keys(requested).some(kind => !tracks.some(track => track.kind === kind && track.readyState === 'live'))) {
        stopTracks(next)
        throw new DOMException('Device unavailable.', 'NotFoundError')
      }
      for (const track of tracks) track.enabled = enabled(track.kind)
      const previous = stream?.getTracks().filter(old => tracks.some(track => track.kind === old.kind)) || []
      if (!stream) stream = next
      else {
        for (const old of previous) stream.removeTrack(old)
        for (const track of tracks) stream.addTrack(track)
      }
      onStream(stream)
      // Publish new tracks before awaiting senders, so new peers use the chosen input too.
      try {
        const results = await Promise.allSettled(tracks.map(track => replaceTrack(track)))
        const failed = results.find(result => result.status === 'rejected')
        if (failed) throw failed.reason
      }
      catch (error) {
        await Promise.allSettled(previous.map(track => replaceTrack(track)))
        for (const track of tracks) stream?.removeTrack(track)
        for (const old of previous) stream?.addTrack(old)
        tracks.forEach(track => track.stop())
        onStream(stream)
        throw error
      }
      previous.forEach(track => track.stop())
      if (version !== generation) throw new DOMException('Capture cancelled.', 'AbortError')
      for (const track of tracks) {
        const wanted = requested[track.kind]
        preferences[track.kind] = wanted || ''
        track.addEventListener('ended', () => {
          if (stream?.getTracks().includes(track)) onEnded(track.kind)
        })
      }
      try { storage.setItem('po-inputs', JSON.stringify(preferences)) } catch {}
      return stream
    })()
    pending = operation
    operation.finally(() => { if (pending === operation) pending = null }).catch(() => {})
    return operation
  }

  return {
    get preferences() { return { ...preferences } },
    async ensure() {
      if (pending) { try { await pending } catch {} }
      if (['audio', 'video'].every(kind => stream?.getTracks().some(track => track.kind === kind && track.readyState === 'live'))) return stream
      return capture(Object.fromEntries(['audio', 'video'].map(kind => [kind, constraint(kind, preferences[kind])])), preferences)
    },
    async select(kind, id) {
      if (!['audio', 'video'].includes(kind)) throw new TypeError('Unknown input kind.')
      if (pending) await pending
      if (!stream || !['audio', 'video'].every(type => stream.getTracks().some(track => track.kind === type && track.readyState === 'live'))) {
        const requested = { ...preferences, [kind]:id }
        return capture(Object.fromEntries(['audio', 'video'].map(type => [type, constraint(type, requested[type])])), requested)
      }
      return capture({ audio:false, video:false, [kind]:constraint(kind, id) }, { [kind]:id })
    },
    stop() {
      generation++
      stopTracks(stream)
      stream = null
      onStream(null)
    },
  }
}
