import type { AnyDiagram, ArchifyDiagram, FlowchartDocument, Point, Size } from '../types'
import { enrichArchitectureBoundaries } from './boundaries'
import {
  architectureMode,
  ensureSize,
  isArchitecture,
  isFlowchart,
  layerBand,
  resolveLaneOrientation,
  resolveLaneWidth,
  sortedLayers,
} from './document'
import {
  ARCHIFY_BOUNDARY_EXTRA_BOTTOM,
  ARCHIFY_BOUNDARY_PAD,
  ARCHIFY_BOUNDARY_TOP_MIN,
  ARCHIFY_GAP_X,
  ARCHIFY_GAP_Y,
  BOUNDARY_NEST_GAP,
  boundaryRect,
  wrapsStrictlyContains,
} from './geom'
import {
  V_STACK_GAP,
  V_TOP,
  applyVerticalCrossLaneRoutes,
  verticalLaneContentHeight,
} from './verticalSwimlane'

const ORIGIN_X = 40
const ORIGIN_Y = 80

type Frame = { x: number; y: number; w: number; h: number }

type FlowItem =
  | { kind: 'node'; id: string; w: number; h: number }
  | { kind: 'group'; w: number; h: number; pad: number; top: number; inner: FlowPacked }

type FlowPacked = { w: number; h: number; items: Array<{ item: FlowItem; x: number; y: number }> }

function boxesOf(diagram: AnyDiagram): Array<{ id: string; w: number; h: number }> {
  const nodes = isFlowchart(diagram) ? diagram.nodes : isArchitecture(diagram) ? diagram.components : []
  return nodes.map((node) => {
    const size = ensureSize(node.size)
    return { id: node.id, w: size[0], h: size[1] }
  })
}

function gapOverlap(a: Frame, b: Frame): boolean {
  return (
    a.x < b.x + b.w + ARCHIFY_GAP_X &&
    a.x + a.w + ARCHIFY_GAP_X > b.x &&
    a.y < b.y + b.h + ARCHIFY_GAP_Y &&
    a.y + a.h + ARCHIFY_GAP_Y > b.y
  )
}

export function componentGapsTooTight(nodes: Array<{ id: string; pos?: Point; size?: Size }>): boolean {
  const frames: Frame[] = []
  for (const node of nodes) {
    if (!node.pos) continue
    const size = ensureSize(node.size)
    frames.push({ x: node.pos[0], y: node.pos[1], w: size[0], h: size[1] })
  }
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (gapOverlap(frames[i], frames[j])) return true
    }
  }
  return false
}

function packFlow(items: FlowItem[]): FlowPacked {
  const cols = 4
  let x = 0
  let y = 0
  let rowH = 0
  let col = 0
  let maxX = 0
  const placed: FlowPacked['items'] = []
  for (const item of items) {
    if (col === cols) {
      y += rowH + ARCHIFY_GAP_Y
      x = 0
      rowH = 0
      col = 0
    }
    placed.push({ item, x, y })
    x += item.w + ARCHIFY_GAP_X
    rowH = Math.max(rowH, item.h)
    maxX = Math.max(maxX, x - ARCHIFY_GAP_X)
    col += 1
  }
  return { w: Math.max(0, maxX), h: placed.length ? y + rowH : 0, items: placed }
}

function stamp(packed: FlowPacked, ox: number, oy: number, pos: Map<string, Point>) {
  for (const entry of packed.items) {
    const x = ox + entry.x
    const y = oy + entry.y
    if (entry.item.kind === 'node') {
      pos.set(entry.item.id, [Math.round(x), Math.round(y)])
      continue
    }
    stamp(entry.item.inner, x + entry.item.pad, y + entry.item.top, pos)
  }
}

function groupFrame(pad: number, inner: FlowPacked): { w: number; h: number; top: number } {
  const top = Math.max(pad, ARCHIFY_BOUNDARY_TOP_MIN)
  return {
    top,
    w: inner.w + pad * 2,
    h: inner.h + top + ARCHIFY_BOUNDARY_EXTRA_BOTTOM,
  }
}

function applyPositions(diagram: AnyDiagram, pos: Map<string, Point>): AnyDiagram {
  if (isFlowchart(diagram)) {
    return {
      ...diagram,
      nodes: diagram.nodes.map((node) => (pos.has(node.id) ? { ...node, pos: pos.get(node.id) } : node)),
      edges: diagram.edges.map((edge) => ({ ...edge, via: undefined })),
    }
  }
  if (isArchitecture(diagram)) {
    return {
      ...diagram,
      components: diagram.components.map((node) => (pos.has(node.id) ? { ...node, pos: pos.get(node.id) } : node)),
      connections: (diagram.connections ?? []).map((edge) => ({ ...edge, via: undefined })),
    }
  }
  return diagram
}

/** 纵向泳道：每列内垂直等距 + 水平居中；列高按内容收紧；重算跨列顶部走廊 */
function beautifyVerticalSwimlane(diagram: FlowchartDocument): FlowchartDocument {
  const layers = [...(diagram.meta.editor?.layers ?? [])].sort((a, b) => a.order - b.order)
  if (!layers.length) return diagram
  const laneW = resolveLaneWidth(diagram)
  const counts = layers.map((_, i) => {
    const band = layerBand(layers, i, laneW, 'vertical')
    return Math.max(
      1,
      diagram.nodes.filter((n) => {
        const cx = (n.pos?.[0] ?? 0) + (n.size?.[0] ?? 140) / 2
        return cx >= band.x && cx <= band.x + band.w
      }).length,
    )
  })
  const nextLayers = layers.map((l, i) => ({
    ...l,
    height: verticalLaneContentHeight(counts[i] ?? 1),
  }))
  const pos = new Map<string, Point>()
  const laneOf = new Map<string, number>()
  for (let i = 0; i < nextLayers.length; i++) {
    const band = layerBand(nextLayers, i, laneW, 'vertical')
    const inLane = diagram.nodes
      .filter((n) => {
        const cx = (n.pos?.[0] ?? 0) + (n.size?.[0] ?? 140) / 2
        return cx >= band.x && cx <= band.x + band.w
      })
      .slice()
      .sort((a, b) => (a.pos?.[1] ?? 0) - (b.pos?.[1] ?? 0))
    inLane.forEach((n, stackIdx) => {
      const size = ensureSize(n.size)
      const x = Math.round(band.x + (band.w - size[0]) / 2)
      const y = band.y + V_TOP + stackIdx * V_STACK_GAP
      pos.set(n.id, [x, y])
      laneOf.set(n.id, i)
    })
  }
  const placed = applyPositions(diagram, pos) as FlowchartDocument
  const edges = applyVerticalCrossLaneRoutes(placed.nodes, placed.edges, (id) => laneOf.get(id) ?? 0)
  return {
    ...placed,
    edges,
    meta: {
      ...placed.meta,
      editor: {
        ...placed.meta.editor,
        mode: 'swimlane',
        laneOrientation: 'vertical',
        layers: nextLayers,
      },
    },
  }
}

function beautifyFlow(diagram: FlowchartDocument): FlowchartDocument {
  if (
    diagram.meta.editor?.mode === 'swimlane' &&
    resolveLaneOrientation(diagram) === 'vertical' &&
    (diagram.meta.editor.layers?.length ?? 0) > 0
  ) {
    return beautifyVerticalSwimlane(diagram)
  }

  const boxes = boxesOf(diagram)
  const byId = new Map(boxes.map((box) => [box.id, box]))
  const indegree = new Map(boxes.map((box) => [box.id, 0]))
  const next = new Map<string, string[]>()
  for (const edge of diagram.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to) || edge.from === edge.to) continue
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
    next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to])
  }
  let frontier = boxes.filter((box) => (indegree.get(box.id) ?? 0) === 0).map((box) => box.id)
  const seen = new Set<string>()
  const ranks: string[][] = []
  while (frontier.length) {
    ranks.push(frontier)
    frontier.forEach((id) => seen.add(id))
    const following: string[] = []
    for (const id of frontier) {
      for (const to of next.get(id) ?? []) {
        indegree.set(to, (indegree.get(to) ?? 1) - 1)
        if ((indegree.get(to) ?? 0) === 0 && !seen.has(to)) following.push(to)
      }
    }
    frontier = following
  }
  const rest = boxes.filter((box) => !seen.has(box.id)).map((box) => box.id)
  if (rest.length) ranks.push(rest)

  const pos = new Map<string, Point>()
  let x = ORIGIN_X
  for (const rank of ranks) {
    let y = ORIGIN_Y
    let colW = 0
    for (const id of rank) {
      const box = byId.get(id)!
      pos.set(id, [x, y])
      y += box.h + ARCHIFY_GAP_Y
      colW = Math.max(colW, box.w)
    }
    x += colW + ARCHIFY_GAP_X
  }
  return applyPositions(diagram, pos) as FlowchartDocument
}

function directChildren(boundaries: ArchifyDiagram['boundaries'], index: number): number[] {
  const list = boundaries ?? []
  const boundary = list[index]
  return list
    .map((_, child) => child)
    .filter((child) => {
      if (child === index) return false
      if (!wrapsStrictlyContains(boundary.wraps, list[child].wraps)) return false
      return !list.some(
        (mid, midIndex) =>
          midIndex !== index &&
          midIndex !== child &&
          wrapsStrictlyContains(boundary.wraps, mid.wraps) &&
          wrapsStrictlyContains(mid.wraps, list[child].wraps),
      )
    })
}

function beautifyArchitecture(diagram: ArchifyDiagram): ArchifyDiagram {
  if (architectureMode(diagram) === 'layered') return beautifyLayered(diagram)
  const boundaries = diagram.boundaries ?? []
  const sizeOf = new Map(boxesOf(diagram).map((box) => [box.id, box]))
  const pads = new Map<number, number>()

  function build(index: number): FlowItem {
    const boundary = boundaries[index]
    const childIndexes = directChildren(boundaries, index)
    const children = childIndexes.map((child) => build(child))
    const childWraps = new Set(childIndexes.flatMap((child) => boundaries[child].wraps))
    const own = boundary.wraps.filter((id) => sizeOf.has(id) && !childWraps.has(id))
    const childPads = children
      .filter((item): item is Extract<FlowItem, { kind: 'group' }> => item.kind === 'group')
      .map((item) => item.pad)
    const pad = Math.max(ARCHIFY_BOUNDARY_PAD, ...childPads.map((value) => value + BOUNDARY_NEST_GAP), 0)
    pads.set(index, pad)
    const inner = packFlow([
      ...own.map((id) => ({ kind: 'node' as const, id, w: sizeOf.get(id)!.w, h: sizeOf.get(id)!.h })),
      ...children,
    ])
    const frame = groupFrame(pad, inner)
    return { kind: 'group', w: frame.w, h: frame.h, pad, top: frame.top, inner }
  }

  const contained = boundaries.map((boundary, index) =>
    boundaries.some((other, otherIndex) => otherIndex !== index && wrapsStrictlyContains(other.wraps, boundary.wraps)),
  )
  const roots: FlowItem[] = []
  boundaries.forEach((_, index) => {
    if (!contained[index]) roots.push(build(index))
  })
  const wrapped = new Set(boundaries.flatMap((boundary) => boundary.wraps))
  for (const component of diagram.components) {
    if (wrapped.has(component.id)) continue
    const box = sizeOf.get(component.id)
    if (box) roots.push({ kind: 'node', id: box.id, w: box.w, h: box.h })
  }
  const pos = new Map<string, Point>()
  stamp(packFlow(roots), ORIGIN_X, ORIGIN_Y, pos)
  const moved = applyPositions(diagram, pos) as ArchifyDiagram
  return enrichArchitectureBoundaries({
    ...moved,
    boundaries: (moved.boundaries ?? []).map((boundary, index) => ({
      ...boundary,
      pad: Math.max(boundary.pad ?? 0, pads.get(index) ?? ARCHIFY_BOUNDARY_PAD),
    })),
  })
}

function beautifyLayered(diagram: ArchifyDiagram): ArchifyDiagram {
  const layers = sortedLayers(diagram)
  const laneW = diagram.meta.editor?.laneWidth ?? 1080
  const groups = layers.map(() => [] as string[])
  for (const component of diagram.components) {
    groups[layerIndexFor(diagram, component.id, component.pos)].push(component.id)
  }
  const sizeOf = new Map(boxesOf(diagram).map((box) => [box.id, box]))
  const pos = new Map<string, Point>()
  let y = 16
  let maxWidth = laneW
  const nextLayers = layers.map((layer, index) => {
    let x = 40
    let rowH = 56
    const header = 36
    for (const id of groups[index]) {
      const box = sizeOf.get(id)
      if (!box) continue
      pos.set(id, [x, y + header])
      x += box.w + ARCHIFY_GAP_X
      rowH = Math.max(rowH, box.h)
    }
    const height = Math.max(80, header + rowH + 24)
    const width = Math.max(laneW, x + 24)
    maxWidth = Math.max(maxWidth, width)
    y += height + 8
    return { ...layer, height, width }
  })
  const moved = applyPositions(diagram, pos) as ArchifyDiagram
  return {
    ...moved,
    meta: {
      ...moved.meta,
      editor: { ...moved.meta.editor, laneWidth: maxWidth, layers: nextLayers },
    },
  }
}

function layerIndexFor(diagram: ArchifyDiagram, id: string, pos?: Point): number {
  const layers = sortedLayers(diagram)
  if (!layers.length) return 0
  const byWraps = layers.findIndex((layer) =>
    (diagram.boundaries ?? []).some((boundary) => boundary.label === layer.label && boundary.wraps.includes(id)),
  )
  if (byWraps >= 0) return byWraps
  if (!pos) return 0
  let y = 16
  const center = pos[1] + 28
  for (let i = 0; i < layers.length; i++) {
    const height = layers[i].height ?? 140
    if (center <= y + height) return i
    y += height + 8
  }
  return layers.length - 1
}

export function beautifyDiagram(diagram: AnyDiagram): AnyDiagram {
  if (isFlowchart(diagram)) return beautifyFlow(diagram)
  if (isArchitecture(diagram)) return beautifyArchitecture(diagram)
  return diagram
}

/** 真正矩形相交（不含「缝偏小」）；导入密集排版不应被当成冲突。 */
function boxesCollide(a: Frame, b: Frame): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function collidingIds(nodes: Array<{ id: string; pos?: Point; size?: Size }>): string[] {
  const frames: Array<Frame & { id: string }> = []
  for (const node of nodes) {
    if (!node.pos) continue
    const size = ensureSize(node.size)
    frames.push({ id: node.id, x: node.pos[0], y: node.pos[1], w: size[0], h: size[1] })
  }
  const ids = new Set<string>()
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (!boxesCollide(frames[i], frames[j])) continue
      ids.add(frames[i].id)
      ids.add(frames[j].id)
    }
  }
  return [...ids]
}

/**
 * 导入后处理：仅在节点真正重叠时重排（无坐标来源）。
 * preserveFileGeometry=true 时完全跳过：文件自带坐标的历史 JSON 必须按原坐标恢复。
 * 官方/人工密集排版（缝 &lt; Archify gap）也必须保留；「美化」按钮仍走 beautifyDiagram。
 */
export function beautifyImported(
  diagram: AnyDiagram,
  pinnedIds: ReadonlySet<string>,
  preserveFileGeometry = false,
): AnyDiagram {
  // 历史导出文件自带的坐标是用户资产：哪怕存在重叠也按文件原样恢复。
  if (preserveFileGeometry) return diagram
  const nodes = isFlowchart(diagram) ? diagram.nodes : isArchitecture(diagram) ? diagram.components : []
  const colliding = collidingIds(nodes)
  if (!colliding.length) return diagram
  if (colliding.every((id) => pinnedIds.has(id))) return diagram
  return beautifyDiagram(diagram)
}

export function boundaryFrames(diagram: ArchifyDiagram): Frame[] {
  const boxes = diagram.components
    .filter((component) => component.pos)
    .map((component) => ({
      id: component.id,
      pos: component.pos!,
      size: ensureSize(component.size),
    }))
  return (diagram.boundaries ?? [])
    .map((boundary) => boundaryRect(boundary.wraps, boxes, boundary.pad ?? ARCHIFY_BOUNDARY_PAD))
    .filter((frame): frame is Frame => !!frame)
}
