import { test, expect } from 'bun:test'
import { createMediaInputs } from '../public/media-devices.js'

class Track extends EventTarget {
  constructor(kind, id) { super(); this.kind = kind; this.id = id; this.readyState = 'live'; this.enabled = true }
  getSettings() { return { deviceId:this.id } }
  stop() { this.readyState = 'ended' }
}
const streamOf = (...tracks) => ({ getTracks:() => [...tracks], removeTrack:t => { tracks.splice(tracks.indexOf(t), 1) }, addTrack:t => tracks.push(t) })
const storage = value => ({ getItem:() => value, setItem(_key, next) { value = next } })

test('input selection preserves mute, replaces only its kind, and releases the old track after senders switch', async () => {
  const mic = new Track('audio', 'mic-1'), camera = new Track('video', 'cam-1'), next = new Track('video', 'cam-2')
  const initial = streamOf(mic, camera), preferences = storage('{}'), requests = []
  let replacementDone, current, pauseReplacement = false
  const inputs = createMediaInputs({
    mediaDevices:{ async getUserMedia(constraints) { requests.push(constraints); return requests.length === 1 ? initial : streamOf(next) } },
    storage:preferences, enabled:() => false, onStream:s => current = s, onEnded() {},
    async replaceTrack(track) {
      if (pauseReplacement) {
        expect(track).toBe(next)
        expect(camera.readyState).toBe('live')
        expect(current.getTracks()).toContain(next)
        await new Promise(resolve => replacementDone = resolve)
      }
    },
  })
  await inputs.ensure()
  expect(mic.enabled).toBe(false)
  pauseReplacement = true
  const switching = inputs.select('video', 'cam-2')
  await Promise.resolve(); await Promise.resolve()
  replacementDone()
  await switching
  expect(requests[1].audio).toBe(false)
  expect(requests[1].video.deviceId).toEqual({ exact:'cam-2' })
  expect(current.getTracks()).toEqual([mic, next])
  expect(next.enabled).toBe(false)
  expect(camera.readyState).toBe('ended')
  expect(mic.readyState).toBe('live')
  expect(inputs.preferences.video).toBe('cam-2')
  inputs.stop()
  expect(current).toBe(null)
  expect(mic.readyState).toBe('ended')
  expect(next.readyState).toBe('ended')
})

test('restoring inputs requires the saved devices; failed capture retains the current input and saved choice', async () => {
  const mic = new Track('audio', 'mic-1'), camera = new Track('video', 'saved-camera')
  const preferences = storage('{"video":"saved-camera","audio":"mic-1"}')
  let current, request, fail = false
  const inputs = createMediaInputs({
    mediaDevices:{ async getUserMedia(c) { request = c; if (fail) throw new DOMException('Busy', 'NotReadableError'); return streamOf(mic, camera) } },
    storage:preferences, enabled:() => true, onStream:s => current = s, replaceTrack:async () => {}, onEnded() {},
  })
  await inputs.ensure()
  expect(request.video.deviceId).toEqual({ exact:'saved-camera' })
  expect(inputs.preferences).toEqual({ audio:'mic-1', video:'saved-camera' })
  fail = true
  await expect(inputs.select('video', 'busy-camera')).rejects.toThrow('Busy')
  expect(current.getTracks()).toEqual([mic, camera])
  expect(camera.readyState).toBe('live')
  expect(inputs.preferences.video).toBe('saved-camera')
})

test('closing a preview cancels pending capture without leaking devices or remembering an unconfirmed choice', async () => {
  const mic = new Track('audio', 'mic-1'), camera = new Track('video', 'cam-1')
  let grant, writes = 0, current
  const inputs = createMediaInputs({
    mediaDevices:{ getUserMedia:() => new Promise(resolve => grant = resolve) },
    storage:{ getItem:() => null, setItem:() => writes++ }, enabled:() => true,
    onStream:s => current = s, replaceTrack:async () => {}, onEnded() {},
  })
  const pending = inputs.ensure()
  inputs.stop()
  grant(streamOf(mic, camera))
  await expect(pending).rejects.toThrow('Capture cancelled')
  expect(current).toBe(null)
  expect(mic.readyState).toBe('ended')
  expect(camera.readyState).toBe('ended')
  expect(writes).toBe(0)
})


test('sender rejection restores the live previous track and does not save the failed choice', async () => {
  const mic = new Track('audio', 'mic'), camera = new Track('video', 'old'), next = new Track('video', 'new')
  let current, calls = 0, reject = false
  const inputs = createMediaInputs({
    mediaDevices:{ getUserMedia:async () => ++calls === 1 ? streamOf(mic, camera) : streamOf(next) },
    storage:storage('{}'), enabled:() => true, onStream:s => current = s, onEnded() {},
    replaceTrack:async () => { if (reject) throw new Error('Sender rejected') },
  })
  await inputs.ensure()
  reject = true
  await expect(inputs.select('video', 'new')).rejects.toThrow('Sender rejected')
  expect(current.getTracks()).toEqual([mic, camera])
  expect(camera.readyState).toBe('live')
  expect(next.readyState).toBe('ended')
  expect(inputs.preferences.video).toBe('')
})

test('a different device can recover a failed initial capture', async () => {
  let calls = 0, request
  const inputs = createMediaInputs({
    mediaDevices:{ getUserMedia:async constraints => {
      request = constraints
      if (++calls === 1) throw new Error('Default busy')
      return streamOf(new Track('audio', 'mic'), new Track('video', 'alternate'))
    } },
    storage:storage('{}'), enabled:() => true, onStream() {}, onEnded() {}, replaceTrack:async () => {},
  })
  await expect(inputs.ensure()).rejects.toThrow('Default busy')
  await inputs.select('video', 'alternate')
  expect(request.video.deviceId).toEqual({exact:'alternate'})
  expect(request.audio).toBeTruthy()
  expect(inputs.preferences.video).toBe('alternate')
})


test('partial two-input replacement rolls back every sender before releasing new tracks', async () => {
  const audio = new Track('audio', 'old-audio'), video = new Track('video', 'old-video')
  const nextAudio = new Track('audio', 'new-audio'), nextVideo = new Track('video', 'new-video')
  let calls = 0
  const senders = {}
  const inputs = createMediaInputs({
    mediaDevices:{ getUserMedia:async () => ++calls === 1 ? streamOf(audio, video) : streamOf(nextAudio, nextVideo) },
    storage:storage('{}'), enabled:() => true, onStream() {}, onEnded() {},
    replaceTrack:async track => {
      if (track === nextVideo) throw new Error('Video rejected')
      senders[track.kind] = track
    },
  })
  await inputs.ensure()
  video.stop()
  await expect(inputs.select('video', 'new-video')).rejects.toThrow('Video rejected')
  expect(senders.audio).toBe(audio)
  expect(senders.video).toBe(video)
  expect(audio.readyState).toBe('live')
  expect(nextAudio.readyState).toBe('ended')
  expect(nextVideo.readyState).toBe('ended')
})


test('reload restores the explicit camera even when the browser prefers a different one', async () => {
  const saved = storage('{"video":"chosen-camera","audio":"chosen-mic"}')
  for (let reload = 0; reload < 2; reload++) {
    let current
    const inputs = createMediaInputs({
      storage:saved, enabled:() => true, onStream:value => current = value, onEnded() {}, replaceTrack:async () => {},
      mediaDevices:{ getUserMedia:async constraints => streamOf(
        new Track('audio', constraints.audio.deviceId?.exact || 'default-mic'),
        new Track('video', constraints.video.deviceId?.exact || 'default-camera'),
      ) },
    })
    await inputs.ensure()
    expect(current.getTracks().map(track => track.id)).toEqual(['chosen-mic', 'chosen-camera'])
    inputs.stop()
  }
})


test('an unavailable saved camera is not replaced in storage during reload', async () => {
  const saved = storage('{"video":"unplugged","audio":"mic"}')
  const inputs = createMediaInputs({
    storage:saved, enabled:() => true, onStream() {}, onEnded() {}, replaceTrack:async () => {},
    mediaDevices:{ getUserMedia:async () => { throw new DOMException('Unavailable', 'OverconstrainedError') } },
  })
  await expect(inputs.ensure()).rejects.toThrow('Unavailable')
  expect(JSON.parse(saved.getItem())).toEqual({video:'unplugged',audio:'mic'})
})
