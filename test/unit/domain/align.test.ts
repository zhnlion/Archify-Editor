import { describe, expect, it } from 'vitest'
import { alignNodes, distributeNodes } from '../../../src/domain/align'

const boxes = [
  { id: 'a', pos: [10, 20] as [number, number], size: [40, 20] as [number, number] },
  { id: 'b', pos: [100, 80] as [number, number], size: [60, 30] as [number, number] },
  { id: 'c', pos: [50, 40] as [number, number], size: [20, 20] as [number, number] },
]

describe('alignNodes', () => {
  it('aligns left to bbox when no anchor', () => {
    const r = alignNodes(boxes, 'left')
    expect(r.every((x) => x.pos[0] === 10)).toBe(true)
  })

  it('aligns top to bbox when no anchor', () => {
    const r = alignNodes(boxes, 'top')
    expect(r.every((x) => x.pos[1] === 20)).toBe(true)
  })

  it('left-align keeps primary anchor fixed; others match its left', () => {
    const r = alignNodes(boxes, 'left', 'b')
    const byId = Object.fromEntries(r.map((x) => [x.id, x.pos]))
    expect(byId.b).toEqual([100, 80])
    expect(byId.a![0]).toBe(100)
    expect(byId.c![0]).toBe(100)
    expect(byId.a![1]).toBe(20)
  })

  it('bottom-align keeps primary anchor fixed; others match its bottom edge', () => {
    // b bottom = 80+30 = 110
    const r = alignNodes(boxes, 'bottom', 'b')
    const byId = Object.fromEntries(r.map((x) => [x.id, x.pos]))
    expect(byId.b).toEqual([100, 80])
    expect(byId.a![1]).toBe(110 - 20)
    expect(byId.c![1]).toBe(110 - 20)
    expect(byId.a![0]).toBe(10)
  })

  it('center-align keeps primary anchor fixed; others match its vertical midline', () => {
    // b center X = 100 + 60/2 = 130
    const r = alignNodes(boxes, 'center', 'b')
    const byId = Object.fromEntries(r.map((x) => [x.id, x.pos]))
    expect(byId.b).toEqual([100, 80])
    expect(byId.a![0]).toBe(130 - 20)
    expect(byId.c![0]).toBe(130 - 10)
    expect(byId.a![1]).toBe(20)
  })

  it('middle-align keeps primary anchor fixed; others match its horizontal midline', () => {
    // b center Y = 80 + 30/2 = 95
    const r = alignNodes(boxes, 'middle', 'b')
    const byId = Object.fromEntries(r.map((x) => [x.id, x.pos]))
    expect(byId.b).toEqual([100, 80])
    expect(byId.a![1]).toBe(95 - 10)
    expect(byId.c![1]).toBe(95 - 10)
    expect(byId.a![0]).toBe(10)
  })

  it('single or empty selection returns no moves', () => {
    expect(alignNodes([], 'left')).toEqual([])
    expect(alignNodes([boxes[0]!], 'left', 'a')).toEqual([])
  })
})

describe('distributeNodes', () => {
  it('distributes horizontally keeping ends', () => {
    const r = distributeNodes(boxes, 'horizontal')
    const byId = Object.fromEntries(r.map((x) => [x.id, x.pos]))
    expect(byId.a).toEqual([10, 20])
    expect(byId.b![0]).toBe(100)
    expect(byId.c![0]).toBeGreaterThan(10)
    expect(byId.c![0]).toBeLessThan(100)
  })
})
