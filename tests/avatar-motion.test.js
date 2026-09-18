import { test, expect } from 'bun:test'
import { lateralLegPose } from '../public/proposals/avatar-motion.js'

test('lateral feet plant, lift alternately and keep connected knees through the cycle', () => {
  for (let distance = 0; distance < 40; distance += .25) {
    const pose = lateralLegPose(distance)
    const other = lateralLegPose(distance, 20)
    if (pose.planted) {
      expect(pose.foot.y).toBeCloseTo(0)
      expect(distance + pose.foot.x).toBeCloseTo(10)
    }
    expect(pose.planted).not.toBe(other.planted)
    expect(Math.hypot(pose.knee.x - pose.hip.x, pose.knee.y - pose.hip.y)).toBeCloseTo(16)
    expect(Math.hypot(pose.ankle.x - pose.knee.x, pose.ankle.y - pose.knee.y)).toBeCloseTo(13)
    const next = lateralLegPose(distance + .01)
    expect(Math.hypot(next.foot.x - pose.foot.x, next.foot.y - pose.foot.y)).toBeLessThan(.03)
  }
  expect(lateralLegPose(30).foot.y).toBe(-8)
  expect(lateralLegPose(30, 0, 0).foot.y).toBeCloseTo(0)
})
