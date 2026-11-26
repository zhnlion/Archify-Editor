import { describe, expect, it } from 'vitest'
import { emptyFlowchart } from '../../../src/domain/document'
import { gridPosition, layoutMissingPositions, mergeImportedGeometry } from '../../../src/domain/layout'
import { importMermaidFlowchart } from '../../../src/import/mermaidImport'
import type { FlowchartDocument } from '../../../src/types'

function flow(partial: Partial<FlowchartDocument> = {}): FlowchartDocument {
  return {
    ...emptyFlowchart(),
    nodes: [
      { id: 'a', shape: 'process', label: 'A', pos: [10, 10], size: [160, 64] },
      { id: 'b', shape: 'process', label: 'B' },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b', via: [[40, 40]], fromSide: 'e', toSide: 'w' }],
    ...partial,
  }
}

describe('layout', () => {
  it('places a node without pos away from occupied boxes', () => {
    const laid = layoutMissingPositions(flow())
    if (laid.diagram_type !== 'flowchart') throw new Error('type')
    expect(laid.nodes.find((n) => n.id === 'a')?.pos).toEqual([10, 10])
    const b = laid.nodes.find((n) => n.id === 'b')
    expect(b?.pos).toBeTruthy()
    expect(b?.pos).not.toEqual([10, 10])
    expect(b?.pos?.[0]).toBeGreaterThanOrEqual(0)
  })

  it('keeps every archived coordinate untouched, even when boxes overlap', () => {
    const archived: FlowchartDocument = {
      ...emptyFlowchart(),
      nodes: [
        { id: 'a', shape: 'process', label: 'A', pos: [120, 100], size: [160, 64] },
        { id: 'b', shape: 'process', label: 'B', pos: [140, 120], size: [160, 64] },
        { id: 'c', shape: 'process', label: 'C', pos: [1080, 640], size: [160, 64] },
      ],
      edges: [],
    }
    const laid = layoutMissingPositions(archived)
    if (laid.diagram_type !== 'flowchart') throw new Error('type')
    expect(laid.nodes.map((n) => n.pos)).toEqual([
      [120, 100],
      [140, 120],
      [1080, 640],
    ])
  })

  it('restores file geometry when the same ids are imported again', () => {
    const current = flow()
    current.nodes[0] = { ...current.nodes[0], pos: [400, 240], tagId: 'review' }
    const incoming = flow()
    incoming.nodes = [
      { id: 'a', shape: 'process', label: 'A2', pos: [80, 60] },
      { id: 'b', shape: 'decision', label: 'B2', pos: [80, 60] },
      { id: 'c', shape: 'process', label: 'C' },
    ]
    incoming.edges = [
      { id: 'e1', from: 'a', to: 'b', label: '新', via: [[9, 9]], fromSide: 'w' },
      { id: 'e2', from: 'b', to: 'c' },
    ]
    const merged = mergeImportedGeometry(current, incoming)
    if (merged.diagram_type !== 'flowchart') throw new Error('type')
    const a = merged.nodes.find((n) => n.id === 'a')
    const edge = merged.edges.find((e) => e.id === 'e1')
    // 文件带了几何 → 用文件的，完全按文件恢复（覆盖画布上拖过的位置）
    expect(a?.label).toBe('A2')
    expect(a?.pos).toEqual([80, 60])
    expect(edge?.label).toBe('新')
    expect(edge?.via).toEqual([[9, 9]])
    expect(edge?.fromSide).toBe('w')
    expect(merged.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c'])

    // 文件完全没带坐标（Mermaid 类）→ 回退画布上的旧值
    const incomingNoGeom = flow()
    incomingNoGeom.nodes = [{ id: 'a', shape: 'process', label: 'A3' }]
    incomingNoGeom.edges = [{ id: 'e1', from: 'a', to: 'a', label: '仅文案' }]
    const kept = mergeImportedGeometry(current, incomingNoGeom)
    if (kept.diagram_type !== 'flowchart') throw new Error('type')
    expect(kept.nodes.find((n) => n.id === 'a')?.pos).toEqual([400, 240])
    expect(kept.nodes.find((n) => n.id === 'a')?.tagId).toBe('review')
    expect(kept.edges.find((e) => e.id === 'e1')?.via).toEqual([[40, 40]])
  })

  it('history JSON without coords uses grid layout, not topological layout', () => {
    const legacy: FlowchartDocument = {
      ...emptyFlowchart(),
      nodes: [
        { id: 'a', shape: 'process', label: 'A' },
        { id: 'b', shape: 'process', label: 'B' },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
      // 历史 JSON 无 flowDirection
    }
    const laid = layoutMissingPositions(legacy)
    if (laid.diagram_type !== 'flowchart') throw new Error('type')
    const a = laid.nodes.find((n) => n.id === 'a')!
    const b = laid.nodes.find((n) => n.id === 'b')!
    // 旧版网格平铺：同一行、横向排列（不是拓扑分层那样纵向堆叠）
    expect(a.pos).toEqual([80, 60])
    expect(b.pos).toEqual([280, 60])
  })

  it('grid starts at the origin', () => {
    expect(gridPosition(0)).toEqual([80, 60])
  })

  it('auto-layout follows Mermaid TD direction and ranks branches', () => {
    const imported = importMermaidFlowchart(`flowchart TD
      A[Start] --> B{Check}
      B -->|yes| C[Done]
      B -->|no| D[Retry]`)
    const laid = layoutMissingPositions(imported)
    if (laid.diagram_type !== 'flowchart') throw new Error('type')
    const byId = new Map(laid.nodes.map((node) => [node.id, node]))
    expect(byId.get('A')!.pos![1]).toBeLessThan(byId.get('B')!.pos![1])
    expect(byId.get('B')!.pos![1]).toBeLessThan(byId.get('C')!.pos![1])
    expect(byId.get('C')!.pos![1]).toBe(byId.get('D')!.pos![1])
    expect(byId.get('C')!.pos![0]).not.toBe(byId.get('D')!.pos![0])
  })

  it('auto-layout follows Mermaid LR direction', () => {
    const imported = importMermaidFlowchart(`flowchart LR
      A[Start] --> B[Work]
      B --> C[End]`)
    const laid = layoutMissingPositions(imported)
    if (laid.diagram_type !== 'flowchart') throw new Error('type')
    const byId = new Map(laid.nodes.map((node) => [node.id, node]))
    expect(byId.get('A')!.pos![0]).toBeLessThan(byId.get('B')!.pos![0])
    expect(byId.get('B')!.pos![0]).toBeLessThan(byId.get('C')!.pos![0])
    expect(byId.get('A')!.pos![1]).toBe(byId.get('B')!.pos![1])
  })
})
