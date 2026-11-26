import { describe, expect, it } from 'vitest'
import { normalizeHex, toColorInput } from '../../../src/ui/ColorPicker'

describe('ColorPicker color parse', () => {
  it('keeps 6-digit hex', () => {
    expect(toColorInput('#2dd4bf')).toBe('#2dd4bf')
  })

  it('strips alpha from 8-digit hex (boundary stroke)', () => {
    expect(toColorInput('#2dd4bf88')).toBe('#2dd4bf')
    expect(toColorInput('#86909Caa')).toBe('#86909C')
    expect(normalizeHex('#2dd4bf88')).toBe('#2DD4BF')
  })

  it('parses rgba fill used by boundary theme', () => {
    expect(toColorInput('rgba(45, 212, 191, 0.06)')).toBe('#2dd4bf')
  })

  it('expands 3-digit hex', () => {
    expect(toColorInput('#abc')).toBe('#aabbcc')
  })
})
