import { describe, expect, it } from 'vitest'
import {
  clampRasterScale,
  opaqueRasterFill,
  padBox,
  rasterQuality,
} from '../../../src/export/canvasSnapshot'

describe('padBox', () => {
  it('expands content box for image export crop', () => {
    expect(padBox({ x: 10, y: 20, w: 100, h: 40 }, 8)).toEqual({ x: 2, y: 12, w: 116, h: 56 })
  })
})

describe('JPEG/WebP raster helpers', () => {
  it('forces opaque hex fill for jpeg', () => {
    expect(opaqueRasterFill('#0f1419', 'jpeg')).toBe('#0f1419')
    expect(opaqueRasterFill('#abc', 'jpeg')).toBe('#aabbcc')
    expect(opaqueRasterFill('rgb(15, 20, 25)', 'jpeg')).toBe('#0f1419')
    expect(opaqueRasterFill('transparent', 'jpeg')).toBe('#ffffff')
    expect(opaqueRasterFill('color-mix(in srgb, red, blue)', 'jpeg')).toBe('#ffffff')
  })

  it('keeps hex/rgb for webp/png', () => {
    expect(opaqueRasterFill('#112233', 'webp')).toBe('#112233')
    expect(opaqueRasterFill('rgb(1,2,3)', 'png')).toBe('#010203')
  })

  it('quality only for jpeg/webp and clamps', () => {
    expect(rasterQuality('png')).toBeUndefined()
    expect(rasterQuality('jpeg', 0.92)).toBe(0.92)
    expect(rasterQuality('webp', 0.1)).toBe(0.5)
    expect(rasterQuality('jpeg', 2)).toBe(1)
  })

  it('clamps export scale by max edge', () => {
    expect(clampRasterScale(100, 50, 2)).toBe(2)
    expect(clampRasterScale(5000, 5000, 2, 8192)).toBeLessThan(2)
    expect(clampRasterScale(100, 100, 8)).toBe(4)
  })
})
