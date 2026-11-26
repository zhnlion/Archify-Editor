import { describe, expect, it } from 'vitest'
import { snapPoint, snapValue } from '../../../src/domain/snap'

describe('snap', () => {
  it('snaps to 24px grid', () => {
    expect(snapValue(10)).toBe(0)
    expect(snapValue(13)).toBe(24)
    expect(snapPoint([13, 35])).toEqual([24, 24])
  })
})
