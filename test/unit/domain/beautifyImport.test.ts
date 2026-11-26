import { describe, expect, it } from 'vitest'
import { beautifyImported } from '../../../src/domain/beautify'
import { emptyFlowchart } from '../../../src/domain/document'
import type { FlowchartDocument } from '../../../src/types'

function archived(): FlowchartDocument {
  return {
    ...emptyFlowchart(),
    nodes: [
      { id: 'a', shape: 'process', label: 'A', pos: [120, 100], size: [160, 64] },
      { id: 'b', shape: 'process', label: 'B', pos: [140, 120], size: [160, 64] },
      { id: 'c', shape: 'process', label: 'C', pos: [1080, 640], size: [160, 64] },
    ],
    edges: [],
  }
}

const originalPositions: Array<[number, number]> = [
  [120, 100],
  [140, 120],
  [1080, 640],
]

describe('beautifyImported', () => {
  it('reflows colliding nodes when the source has no coordinates', () => {
    const result = beautifyImported(archived(), new Set())
    if (!('nodes' in result)) throw new Error('type')
    expect(result.nodes.map((n) => n.pos)).not.toEqual(originalPositions)
  })

  it('preserves archived coordinates when the file carries its own geometry', () => {
    const input = archived()
    const result = beautifyImported(input, new Set(), true)
    if (!('nodes' in result)) throw new Error('type')
    expect(result.nodes.map((n) => n.pos)).toEqual(originalPositions)
    expect(result).toBe(input)
  })
})
