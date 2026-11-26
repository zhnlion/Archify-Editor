import { describe, expect, it } from 'vitest'
import {
  movableIdsForSelection,
  nudgeMovesForIds,
  translateViasForUniformMoves,
} from '../../../src/domain/nudge'
import type { Point } from '../../../src/types'

describe('movableIdsForSelection', () => {
  const boundaries = [{ wraps: ['a', 'b'] }, { wraps: ['c'] }, { wraps: ['b', 'd'] }]

  it('returns node ids for nodes selection', () => {
    expect(movableIdsForSelection({ kind: 'nodes', ids: ['a', 'c'] }, boundaries)).toEqual(['a', 'c'])
  })

  it('expands boundary wraps (mouse drag semantics)', () => {
    expect(movableIdsForSelection({ kind: 'boundary', indexes: [0] }, boundaries)).toEqual(['a', 'b'])
  })

  it('unions nodes and boundary wraps without duplicates', () => {
    expect(
      movableIdsForSelection(
        { kind: 'all', nodeIds: ['a', 'x'], boundaryIndexes: [0, 1] },
        boundaries,
      ),
    ).toEqual(['a', 'x', 'b', 'c'])
  })

  it('returns empty for edge / lanes / null', () => {
    expect(movableIdsForSelection({ kind: 'edge', id: 'e1' }, boundaries)).toEqual([])
    expect(movableIdsForSelection({ kind: 'lanes', ids: ['L1'] }, boundaries)).toEqual([])
    expect(movableIdsForSelection(null, boundaries)).toEqual([])
  })
})

describe('nudgeMovesForIds', () => {
  const nodes = [
    { id: 'a', pos: [10, 20] as Point },
    { id: 'b', pos: [100, 80] as Point },
    { id: 'c' }, // missing pos — must still move via ensurePos
  ]

  it('nudges all selected by the same delta', () => {
    const moves = nudgeMovesForIds(nodes, ['a', 'b'], 1, -2)
    expect(moves).toEqual([
      { id: 'a', pos: [11, 18] },
      { id: 'b', pos: [101, 78] },
    ])
  })

  it('does not drop nodes without explicit pos', () => {
    const moves = nudgeMovesForIds(nodes, ['c', 'a'], 10, 0)
    expect(moves).toHaveLength(2)
    expect(moves[0]!.id).toBe('c')
    expect(moves[0]!.pos[0]).toBeGreaterThan(10)
    expect(moves[1]).toEqual({ id: 'a', pos: [20, 20] })
  })

  it('Shift-sized step (10) is just a larger delta', () => {
    expect(nudgeMovesForIds(nodes, ['a'], 10, 0)).toEqual([{ id: 'a', pos: [20, 20] }])
  })
})

describe('translateViasForUniformMoves', () => {
  const oldPos = new Map<string, Point>([
    ['a', [0, 0]],
    ['b', [100, 0]],
    ['c', [200, 50]],
  ])

  it('translates via when both ends move by the same delta', () => {
    const newPos = new Map<string, Point>([
      ['a', [10, 5]],
      ['b', [110, 5]],
    ])
    const edges = [{ id: 'e1', from: 'a', to: 'b', via: [[50, 20] as Point] }]
    const out = translateViasForUniformMoves(edges, oldPos, newPos)
    expect(out[0]!.via).toEqual([[60, 25]])
  })

  it('leaves via when only one end moves', () => {
    const newPos = new Map<string, Point>([['a', [10, 0]]])
    const edges = [{ id: 'e1', from: 'a', to: 'b', via: [[50, 20] as Point] }]
    expect(translateViasForUniformMoves(edges, oldPos, newPos)[0]!.via).toEqual([[50, 20]])
  })

  it('leaves via when deltas differ', () => {
    const newPos = new Map<string, Point>([
      ['a', [10, 0]],
      ['b', [120, 0]],
    ])
    const edges = [{ id: 'e1', from: 'a', to: 'b', via: [[50, 20] as Point] }]
    expect(translateViasForUniformMoves(edges, oldPos, newPos)[0]!.via).toEqual([[50, 20]])
  })
})
