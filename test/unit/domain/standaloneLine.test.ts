import { describe, expect, it } from 'vitest'
import {
  lineBounds,
  linePoints,
  moveLinePoint,
  translateLinePoints,
} from '../../../src/domain/standaloneLine'
import { boundaryRectFor } from '../../../src/domain/geom'
import type { StandaloneLine } from '../../../src/types'

const line = (points: StandaloneLine['points']): StandaloneLine => ({
  id: 'l1',
  points,
  route: 'ortho',
})

describe('standalone line geometry', () => {
  it('reads points defensively from archived JSON', () => {
    expect(linePoints(line([[10, 20], [90, 80]]))).toEqual([[10, 20], [90, 80]])
    expect(linePoints({ id: 'x', points: [[1, 2]] })).toEqual([])
  })

  it('translates the whole line and moves a single point only', () => {
    const pts: StandaloneLine['points'] = [[10, 20], [50, 20], [50, 80], [90, 80]]
    expect(translateLinePoints(pts, 12, -5)).toEqual([
      [22, 15],
      [62, 15],
      [62, 75],
      [102, 75],
    ])
    expect(moveLinePoint(pts, 1, [60, 30])).toEqual([
      [10, 20],
      [60, 30],
      [50, 80],
      [90, 80],
    ])
    expect(pts[1]).toEqual([50, 20])
  })

  it('computes bounds for export fitting', () => {
    expect(lineBounds([[10, 20], [90, 80]])).toEqual({ x: 10, y: 20, w: 80, h: 60 })
    expect(lineBounds([[10, 20]])).toBeNull()
  })
})

describe('flowchart boundary geometry', () => {
  const boxes = [
    { id: 'a', pos: [100, 100] as [number, number], size: [160, 64] as [number, number] },
    { id: 'b', pos: [400, 300] as [number, number], size: [160, 64] as [number, number] },
  ]

  it('uses explicit pos/size of a drawn region box verbatim', () => {
    const r = boundaryRectFor(
      { wraps: [], pos: [40, 60], size: [320, 180] },
      boxes,
      { padLeft: 30, padRight: 30, padTop: 30, padBottom: 30 },
    )
    expect(r).toEqual({ x: 40, y: 60, w: 320, h: 180 })
  })

  it('derives a wrapped region from node boxes plus pads', () => {
    const r = boundaryRectFor(
      { wraps: ['a', 'b'] },
      boxes,
      { padLeft: 20, padRight: 30, padTop: 10, padBottom: 40 },
    )
    expect(r).toEqual({ x: 80, y: 90, w: 510, h: 314 })
  })
})
