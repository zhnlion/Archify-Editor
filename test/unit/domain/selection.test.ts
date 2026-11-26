import { describe, expect, it } from 'vitest'
import {
  boundaryIndexesOf,
  isBoundarySelected,
  normalizeRect,
  rectsIntersect,
  selectAllOnCanvas,
  selectNodes,
  selectOnlyNode,
  toggleNodeInSelection,
  nodeIdsOf,
} from '../../../src/domain/selection'

describe('selection', () => {
  it('toggle adds and removes', () => {
    let s = selectOnlyNode('a')
    s = toggleNodeInSelection(s, 'b')
    expect(nodeIdsOf(s)).toEqual(['a', 'b'])
    s = toggleNodeInSelection(s, 'a')
    expect(nodeIdsOf(s)).toEqual(['b'])
    s = toggleNodeInSelection(s, 'b')
    expect(s).toBeNull()
  })

  it('selectNodes dedupes', () => {
    expect(nodeIdsOf(selectNodes(['a', 'a', 'b']))).toEqual(['a', 'b'])
    expect(selectNodes([])).toBeNull()
  })

  it('selectAllOnCanvas includes nested boundary indexes', () => {
    const s = selectAllOnCanvas(['a', 'b'], [0, 2, 1])
    expect(s?.kind).toBe('all')
    expect(nodeIdsOf(s)).toEqual(['a', 'b'])
    expect(boundaryIndexesOf(s)).toEqual([0, 1, 2])
    expect(isBoundarySelected(s, 2)).toBe(true)
  })

  it('marquee rect intersection', () => {
    const r = normalizeRect(10, 10, 40, 50)
    expect(r).toEqual({ x: 10, y: 10, w: 30, h: 40 })
    expect(rectsIntersect(r, { x: 20, y: 20, w: 10, h: 10 })).toBe(true)
    expect(rectsIntersect(r, { x: 100, y: 100, w: 10, h: 10 })).toBe(false)
  })
})
