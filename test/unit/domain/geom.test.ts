import { describe, expect, it } from 'vitest'
import {
  applyBoundaryPadResize,
  applyResize,
  boundaryRect,
  boxBorderPoint,
  clampSize,
  edgeEndpoints,
  resolveBoundaryPads,
  wrapsStrictlyContains,
} from '../../../src/domain/geom'

describe('clampSize', () => {
  it('raises below-minimum sizes', () => {
    expect(clampSize([10, 5])).toEqual([40, 24])
  })
})

describe('applyResize', () => {
  it('grows east and south', () => {
    const r = applyResize([10, 20], [100, 50], 'se', 20, 10)
    expect(r.pos).toEqual([10, 20])
    expect(r.size).toEqual([120, 60])
  })

  it('moves origin when resizing north-west and respects min', () => {
    const r = applyResize([100, 100], [80, 40], 'nw', 70, 50)
    expect(r.size[0]).toBeGreaterThanOrEqual(40)
    expect(r.size[1]).toBeGreaterThanOrEqual(24)
    expect(r.pos[0] + r.size[0]).toBe(180)
    expect(r.pos[1] + r.size[1]).toBe(140)
  })

  it('locks aspect ratio on corner resize when lockAspect', () => {
    const r = applyResize([10, 20], [100, 50], 'se', 50, 0, undefined, { lockAspect: true })
    expect(r.pos).toEqual([10, 20])
    expect(r.size[0] / r.size[1]).toBeCloseTo(2, 1)
    expect(r.size[0]).toBeGreaterThan(100)
  })
})

describe('edgeEndpoints', () => {
  it('lands on box borders so arrows are not buried in centers', () => {
    const fromPos: [number, number] = [0, 0]
    const fromSize: [number, number] = [100, 40]
    const toPos: [number, number] = [200, 0]
    const toSize: [number, number] = [100, 40]
    const { start, end } = edgeEndpoints(fromPos, fromSize, toPos, toSize, 0)
    expect(start[0]).toBe(100)
    expect(start[1]).toBe(20)
    expect(end[0]).toBe(200)
    expect(end[1]).toBe(20)
  })

  it('boxBorderPoint hits the nearer side', () => {
    const p = boxBorderPoint([0, 0], [100, 50], [300, 25])
    expect(p[0]).toBe(100)
    expect(p[1]).toBe(25)
  })
})

describe('boundary nest pad', () => {
  it('detects strict containment', () => {
    expect(wrapsStrictlyContains(['a', 'b', 'c'], ['a', 'b'])).toBe(true)
    expect(wrapsStrictlyContains(['a', 'b'], ['a', 'b'])).toBe(false)
  })

  it('gives outer regions larger auto pad', () => {
    const pads = resolveBoundaryPads([
      { wraps: ['a', 'b', 'c'] },
      { wraps: ['b'] },
    ])
    expect(pads[0].nestDepth).toBe(0)
    expect(pads[1].nestDepth).toBe(1)
    expect(pads[0].pad).toBeGreaterThan(pads[1].pad)
  })

  it('applyBoundaryPadResize: E only grows padRight (left edge fixed)', () => {
    const r = applyBoundaryPadResize(16, 'e', 10, 50)
    expect(r.padRight).toBe(26)
    expect(r.padLeft).toBe(16)
    expect(r.padTop).toBe(16)
  })

  it('applyBoundaryPadResize: W outward grows padLeft (right edge fixed)', () => {
    const r = applyBoundaryPadResize(16, 'w', -8, 50)
    expect(r.padLeft).toBe(24)
    expect(r.padRight).toBe(16)
  })

  it('applyBoundaryPadResize: N/S only change top/bottom', () => {
    const s = applyBoundaryPadResize(
      { padLeft: 20, padRight: 20, padTop: 16, padBottom: 20 },
      's',
      40,
      12,
    )
    expect(s.padBottom).toBe(32)
    expect(s.padTop).toBe(16)
    expect(s.padLeft).toBe(20)
    const n = applyBoundaryPadResize(
      { padLeft: 20, padRight: 20, padTop: 16, padBottom: 20 },
      'n',
      40,
      -10,
    )
    expect(n.padTop).toBe(26)
    expect(n.padBottom).toBe(20)
  })

  it('boundaryRect asymmetric: only right pad widens without moving left', () => {
    const boxes = [
      { id: 'a', pos: [100, 100] as [number, number], size: [80, 40] as [number, number] },
    ]
    const base = boundaryRect(['a'], boxes, {
      padLeft: 20,
      padRight: 20,
      padTop: 16,
      padBottom: 20,
    })!
    const wide = boundaryRect(['a'], boxes, {
      padLeft: 20,
      padRight: 40,
      padTop: 16,
      padBottom: 20,
    })!
    expect(wide.x).toBe(base.x)
    expect(wide.w).toBe(base.w + 20)
  })
})
