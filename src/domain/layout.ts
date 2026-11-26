import type { AnyDiagram, FlowchartDocument, Point, Size } from '../types'
import { isArchitecture, isFlowchart } from './document'

const COLS = 4
const GAP_X = 200
const GAP_Y = 120
const ORIGIN_X = 80
const ORIGIN_Y = 60
const BOX_W = 160
const BOX_H = 64
const FLOW_GAP_X = 80
const FLOW_GAP_Y = 72

export function gridPosition(index: number): Point {
  return [ORIGIN_X + (index % COLS) * GAP_X, ORIGIN_Y + Math.floor(index / COLS) * GAP_Y]
}

function boxOf(pos: Point, size?: Size): { pos: Point; w: number; h: number } {
  return { pos, w: size?.[0] ?? BOX_W, h: size?.[1] ?? BOX_H }
}

function overlaps(
  a: { pos: Point; w: number; h: number },
  b: { pos: Point; w: number; h: number },
): boolean {
  return a.pos[0] < b.pos[0] + b.w && a.pos[0] + a.w > b.pos[0] && a.pos[1] < b.pos[1] + b.h && a.pos[1] + a.h > b.pos[1]
}

export function firstFreeSlot(occupied: { pos: Point; size?: Size }[]): Point {
  const boxes = occupied.map((o) => boxOf(o.pos, o.size))
  for (let i = 0; i < 500; i++) {
    const pos = gridPosition(i)
    const candidate = boxOf(pos)
    if (!boxes.some((b) => overlaps(candidate, b))) return pos
  }
  return gridPosition(occupied.length + 8)
}

type NodeGeom = { id: string; pos?: Point; size?: Size; tagId?: string }
type EdgeGeom = { id: string; via?: Point[]; fromSide?: string; toSide?: string }

/**
 * 同 id 节点几何合并。
 * preferIncoming=true：完全按文件恢复（历史编辑器 JSON 带 pos/size）。
 * preferIncoming=false：保留画布上人工调整过的几何（Mermaid 等无坐标来源）。
 */
function mergeNodes<T extends NodeGeom>(prev: T[], next: T[], preferIncoming: boolean): T[] {
  const prevBy = new Map(prev.map((n) => [n.id, n]))
  return next.map((n) => {
    const old = prevBy.get(n.id)
    if (!old) return n
    if (preferIncoming) {
      return { ...n, pos: n.pos ?? old.pos, size: n.size ?? old.size, tagId: n.tagId ?? old.tagId }
    }
    return { ...n, pos: old.pos ?? n.pos, size: old.size ?? n.size, tagId: old.tagId ?? n.tagId }
  })
}

/** 连线几何同理：preferIncoming 决定文件 via/side 是否覆盖画布旧值。 */
function mergeEdges<T extends EdgeGeom>(prev: T[], next: T[], preferIncoming: boolean): T[] {
  const prevBy = new Map(prev.map((e) => [e.id, e]))
  return next.map((e) => {
    const old = prevBy.get(e.id)
    if (!old) return e
    if (preferIncoming) {
      return { ...e, via: e.via ?? old.via, fromSide: e.fromSide ?? old.fromSide, toSide: e.toSide ?? old.toSide }
    }
    return { ...e, via: old.via ?? e.via, fromSide: old.fromSide ?? e.fromSide, toSide: old.toSide ?? e.toSide }
  })
}

/** 导入图是否自带排版坐标：历史编辑器 JSON 都带 pos；Mermaid / 无坐标来源不带。 */
export function hasOwnGeometry(diagram: AnyDiagram): boolean {
  if (isFlowchart(diagram)) return diagram.nodes.some((n) => !!n.pos)
  if (isArchitecture(diagram)) return diagram.components.some((n) => !!n.pos)
  return false
}

/**
 * 同类型再次导入：
 * - 文件自带坐标 → 完全按文件恢复排版（pos/size/via/side 以文件为准）；
 * - 文件无坐标（Mermaid 等）→ 保留画布上人工调整过的几何。
 * 文案与增删始终以新图为准。
 */
export function mergeImportedGeometry(previous: AnyDiagram, incoming: AnyDiagram): AnyDiagram {
  if (previous.diagram_type !== incoming.diagram_type) return incoming
  const preferIncoming = hasOwnGeometry(incoming)
  const colorTags = incoming.meta.editor?.colorTags ?? previous.meta.editor?.colorTags
  const editor = {
    ...previous.meta.editor,
    ...incoming.meta.editor,
    ...(colorTags ? { colorTags } : {}),
  }
  if (isFlowchart(previous) && isFlowchart(incoming)) {
    return {
      ...incoming,
      meta: { ...incoming.meta, editor },
      nodes: mergeNodes(previous.nodes, incoming.nodes, preferIncoming),
      edges: mergeEdges(previous.edges, incoming.edges, preferIncoming),
    }
  }
  if (isArchitecture(previous) && isArchitecture(incoming)) {
    return {
      ...incoming,
      meta: { ...incoming.meta, editor },
      components: mergeNodes(previous.components, incoming.components, preferIncoming),
      connections: mergeEdges(previous.connections ?? [], incoming.connections ?? [], preferIncoming),
    }
  }
  return incoming
}

/**
 * 只给没有坐标的节点找不重叠的网格位。
 * 已有坐标（含 pinned）一律原样保留，重叠也不动——导入历史文件时必须逐点还原。
 */
export function layoutMissingPositions(diagram: AnyDiagram, pinnedIds?: ReadonlySet<string>): AnyDiagram {
  const pin = pinnedIds ?? new Set<string>()
  if (isFlowchart(diagram)) {
    // 拓扑分层只用于带 flowDirection 的导入（Mermaid TD/LR 等）：这类图本就没有排版，
    // 按连线方向分层更符合语义。普通历史 JSON 即使无坐标也走网格平铺，保持旧版排版一致。
    const wantsGraphLayout = !!diagram.meta.editor?.flowDirection
    if (
      wantsGraphLayout &&
      pin.size === 0 &&
      diagram.nodes.length > 0 &&
      diagram.nodes.every((node) => !node.pos)
    ) {
      return layoutFlowGraph(diagram)
    }
    return { ...diagram, nodes: placeNodes(diagram.nodes) }
  }
  if (isArchitecture(diagram)) {
    return { ...diagram, components: placeNodes(diagram.components) }
  }
  return diagram
}

function layoutFlowGraph(diagram: FlowchartDocument): FlowchartDocument {
  const byId = new Map(diagram.nodes.map((node) => [node.id, node]))
  const indegree = new Map(diagram.nodes.map((node) => [node.id, 0]))
  const next = new Map<string, string[]>()
  for (const edge of diagram.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) continue
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to])
  }

  let frontier = diagram.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)
  const ranks: string[][] = []
  const seen = new Set<string>()
  while (frontier.length) {
    ranks.push(frontier)
    frontier.forEach((id) => seen.add(id))
    const following: string[] = []
    for (const id of frontier) {
      for (const to of next.get(id) ?? []) {
        indegree.set(to, (indegree.get(to) ?? 0) - 1)
        if ((indegree.get(to) ?? 0) === 0 && !seen.has(to)) following.push(to)
      }
    }
    frontier = following
  }
  const rest = diagram.nodes.filter((node) => !seen.has(node.id)).map((node) => node.id)
  if (rest.length) ranks.push(rest)

  const direction = diagram.meta.editor?.flowDirection ?? 'TB'
  const vertical = direction === 'TB' || direction === 'BT'
  const rankOrder = direction === 'BT' || direction === 'RL' ? [...ranks].reverse() : ranks
  const sizedRanks = rankOrder.map((ids) =>
    ids.map((id) => {
      const node = byId.get(id)!
      const [w, h] = node.size ?? [BOX_W, BOX_H]
      return { id, w, h }
    }),
  )
  const rankWidths = sizedRanks.map(
    (rank) => rank.reduce((sum, node) => sum + node.w, 0) + Math.max(0, rank.length - 1) * FLOW_GAP_X,
  )
  const rankHeights = sizedRanks.map((rank) => Math.max(0, ...rank.map((node) => node.h)))
  const pos = new Map<string, Point>()

  if (vertical) {
    const contentW = Math.max(0, ...rankWidths)
    let y = ORIGIN_Y
    sizedRanks.forEach((rank, rankIndex) => {
      let x = ORIGIN_X + (contentW - rankWidths[rankIndex]!) / 2
      for (const node of rank) {
        pos.set(node.id, [x, y])
        x += node.w + FLOW_GAP_X
      }
      y += rankHeights[rankIndex]! + FLOW_GAP_Y
    })
  } else {
    const contentH =
      rankHeights.reduce((sum, height) => sum + height, 0) +
      Math.max(0, rankHeights.length - 1) * FLOW_GAP_Y
    let x = ORIGIN_X
    sizedRanks.forEach((rank, rankIndex) => {
      let y = ORIGIN_Y + (contentH - rankHeights[rankIndex]!) / 2
      for (const node of rank) {
        pos.set(node.id, [x, y])
        y += node.h + FLOW_GAP_Y
      }
      x += rankWidths[rankIndex]! + FLOW_GAP_X
    })
  }

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => (pos.has(node.id) ? { ...node, pos: pos.get(node.id) } : node)),
    edges: diagram.edges.map((edge) => ({ ...edge, via: undefined })),
  }
}

function placeNodes<T extends NodeGeom>(nodes: T[]): T[] {
  // 文件/画布上已有的坐标一律视为已排版：即使互相重叠也原样保留。
  // 历史导出 JSON 的坐标是用户资产，导入时只能补缺，不能「帮」用户重排。
  const placed: { pos: Point; size?: Size }[] = nodes
    .filter((n) => !!n.pos)
    .map((n) => ({ pos: n.pos!, size: n.size }))

  return nodes.map((n) => {
    if (n.pos) return n
    const pos = firstFreeSlot(placed)
    const size = n.size ?? ([BOX_W, BOX_H] as Size)
    placed.push({ pos, size })
    return { ...n, pos, size }
  })
}

export function pinnedPositionIds(diagram: AnyDiagram): Set<string> {
  if (isFlowchart(diagram)) return new Set(diagram.nodes.filter((n) => n.pos).map((n) => n.id))
  if (isArchitecture(diagram)) return new Set(diagram.components.filter((n) => n.pos).map((n) => n.id))
  return new Set()
}
