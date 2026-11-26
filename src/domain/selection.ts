import type { Selection } from '../ui/Canvas'

export function nodeIdsOf(selection: Selection): string[] {
  if (selection?.kind === 'nodes') return selection.ids
  if (selection?.kind === 'all') return selection.nodeIds
  return []
}

export function boundaryIndexesOf(selection: Selection): number[] {
  if (selection?.kind === 'boundary') return selection.indexes
  if (selection?.kind === 'all') return selection.boundaryIndexes
  return []
}

export function laneIdsOf(selection: Selection): string[] {
  if (selection?.kind === 'lanes') return selection.ids
  if (selection?.kind === 'all') return selection.laneIds ?? []
  return []
}

export function isNodeSelected(selection: Selection, id: string): boolean {
  return nodeIdsOf(selection).includes(id)
}

export function isBoundarySelected(selection: Selection, index: number): boolean {
  return boundaryIndexesOf(selection).includes(index)
}

export function isLaneSelected(selection: Selection, id: string): boolean {
  return laneIdsOf(selection).includes(id)
}

export function primaryNodeId(selection: Selection): string | null {
  const ids = nodeIdsOf(selection)
  return ids.length ? ids[ids.length - 1]! : null
}

export function primaryBoundaryIndex(selection: Selection): number | null {
  if (selection?.kind !== 'boundary' || selection.indexes.length !== 1) return null
  return selection.indexes[0]!
}

export function selectOnlyNode(id: string): Selection {
  return { kind: 'nodes', ids: [id] }
}

export function selectOnlyBoundary(index: number): Selection {
  return { kind: 'boundary', indexes: [index] }
}

export function toggleNodeInSelection(selection: Selection, id: string): Selection {
  const ids = nodeIdsOf(selection)
  if (ids.includes(id)) {
    const next = ids.filter((x) => x !== id)
    return next.length ? { kind: 'nodes', ids: next } : null
  }
  return { kind: 'nodes', ids: [...ids, id] }
}

export function selectNodes(ids: string[]): Selection {
  const uniq = [...new Set(ids)]
  return uniq.length ? { kind: 'nodes', ids: uniq } : null
}

export function selectBoundaries(indexes: number[]): Selection {
  const uniq = [...new Set(indexes)].sort((a, b) => a - b)
  return uniq.length ? { kind: 'boundary', indexes: uniq } : null
}

export function selectLanes(ids: string[]): Selection {
  const uniq = [...new Set(ids)]
  return uniq.length ? { kind: 'lanes', ids: uniq } : null
}

export function toggleLaneInSelection(selection: Selection, id: string): Selection {
  const ids = laneIdsOf(selection)
  if (ids.includes(id)) {
    const next = ids.filter((x) => x !== id)
    return next.length ? selectLanes(next) : null
  }
  return selectLanes([...ids, id])
}

/** 全选：组件 + 所有区域框（含父子嵌套）+ 可选泳道 */
export function selectAllOnCanvas(
  nodeIds: string[],
  boundaryIndexes: number[],
  laneIds: string[] = [],
): Selection {
  const nodes = [...new Set(nodeIds)]
  const bounds = [...new Set(boundaryIndexes)].sort((a, b) => a - b)
  const lanes = [...new Set(laneIds)]
  if (!nodes.length && !bounds.length && !lanes.length) return null
  if (!bounds.length && !lanes.length) return selectNodes(nodes)
  if (!nodes.length && !lanes.length) return selectBoundaries(bounds)
  if (!nodes.length && !bounds.length) return selectLanes(lanes)
  return {
    kind: 'all',
    nodeIds: nodes,
    boundaryIndexes: bounds,
    ...(lanes.length ? { laneIds: lanes } : {}),
  }
}

export function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function normalizeRect(x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  return { x, y, w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
}
