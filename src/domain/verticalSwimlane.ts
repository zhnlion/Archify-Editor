import type {
  EditorLayer,
  FlowchartDocument,
  FlowchartEdge,
  FlowchartNode,
  LaneOrientation,
  Point,
} from '../types'
import {
  DEFAULT_LAYER_HEIGHT,
  LAYER_WIDTH,
  VERTICAL_LANE_HEIGHT,
  VERTICAL_LANE_WIDTH,
} from '../types'
import {
  ensureSize,
  layerBand,
  layerIndexAtPoint,
  resolveLaneOrientation,
  resolveLaneWidth,
} from './document'
import { edgeEndpoints } from './geom'

/** 纵向泳道列宽 / 间距 / 顶边距 / 竖排步距（与 workflowProjection、beautify 共用） */
export const V_LANE_W = 220
export const V_LANE_GAP = 12
export const V_LANE_PAD = 16
/** 同列相邻过程框顶边距 = 高 38 + 净间隙 48（等高时亦等于中心距） */
export const V_STACK_GAP = 86
export const V_TOP = 52
export const V_NODE_H = 38
/** 末节点底边到泳道框底的余量 */
const V_BOTTOM_PAD = 28
/** 顶部走廊：泳道标题下方、首节点上方 */
const V_CHANNEL_Y = V_LANE_PAD + 28

/** 按列内节点数收紧泳道高度（避免短列大片空白） */
export function verticalLaneContentHeight(stackCount: number): number {
  const n = Math.max(1, stackCount)
  return V_TOP + (n - 1) * V_STACK_GAP + V_NODE_H + V_BOTTOM_PAD
}

/**
 * 切换 flowchart 泳道方向：按原朝向归属列/带，再重排节点几何。
 * 无泳道时仅写入 laneOrientation（供后续「新增泳道」使用）。
 */
export function reorientFlowchartSwimlanes(
  diagram: FlowchartDocument,
  orientation: LaneOrientation,
): FlowchartDocument {
  const layers = [...(diagram.meta.editor?.layers ?? [])].sort((a, b) => a.order - b.order)
  const editorBase = {
    ...diagram.meta.editor,
    mode: layers.length ? ('swimlane' as const) : diagram.meta.editor?.mode,
    laneOrientation: orientation,
  }

  if (!layers.length) {
    return {
      ...diagram,
      meta: { ...diagram.meta, editor: editorBase },
    }
  }

  const current = resolveLaneOrientation(diagram)
  const laneW = resolveLaneWidth(diagram)
  const laneOf = new Map<string, number>()
  for (const n of diagram.nodes) {
    const pos = n.pos ?? [0, 0]
    const size = ensureSize(n.size)
    const mid: Point = [pos[0] + size[0] / 2, pos[1] + size[1] / 2]
    laneOf.set(n.id, layerIndexAtPoint(layers, mid, laneW, current))
  }

  const counts = layers.map((_, i) => [...laneOf.values()].filter((x) => x === i).length)
  const nextLayers: EditorLayer[] = layers.map((l, i) => {
    if (orientation === 'vertical') {
      return {
        ...l,
        width: l.width ?? VERTICAL_LANE_WIDTH,
        height: verticalLaneContentHeight(Math.max(1, counts[i] ?? 1)),
      }
    }
    return {
      ...l,
      height: l.height ?? DEFAULT_LAYER_HEIGHT,
      width: l.width,
    }
  })

  const nextLaneW =
    orientation === 'vertical'
      ? resolveLaneWidth({
          meta: { editor: { layers: nextLayers, laneOrientation: 'vertical' } },
        })
      : (diagram.meta.editor?.laneWidth ?? LAYER_WIDTH)

  const byLane = new Map<number, FlowchartNode[]>()
  for (const n of diagram.nodes) {
    const li = laneOf.get(n.id) ?? 0
    const list = byLane.get(li) ?? []
    list.push(n)
    byLane.set(li, list)
  }

  const pos = new Map<string, Point>()
  for (let i = 0; i < nextLayers.length; i++) {
    const band = layerBand(nextLayers, i, nextLaneW, orientation)
    const list = (byLane.get(i) ?? []).slice().sort((a, b) => {
      if (orientation === 'vertical') return (a.pos?.[1] ?? 0) - (b.pos?.[1] ?? 0)
      return (a.pos?.[0] ?? 0) - (b.pos?.[0] ?? 0)
    })
    list.forEach((n, stackIdx) => {
      const size = ensureSize(n.size)
      if (orientation === 'vertical') {
        pos.set(n.id, [
          Math.round(band.x + (band.w - size[0]) / 2),
          band.y + V_TOP + stackIdx * V_STACK_GAP,
        ])
      } else {
        const gap = 24
        pos.set(n.id, [
          Math.round(band.x + 24 + stackIdx * (size[0] + gap)),
          Math.round(band.y + Math.max(28, (band.h - size[1]) / 2)),
        ])
      }
    })
  }

  const nodes = diagram.nodes.map((n) => (pos.has(n.id) ? { ...n, pos: pos.get(n.id)! } : n))
  let edges: FlowchartEdge[] = diagram.edges.map((e) => {
    const { via: _via, ...rest } = e
    return rest
  })
  if (orientation === 'vertical') {
    edges = applyVerticalCrossLaneRoutes(nodes, edges, (id) => laneOf.get(id) ?? 0)
  }

  return {
    ...diagram,
    nodes,
    edges,
    meta: {
      ...diagram.meta,
      editor: {
        ...editorBase,
        mode: 'swimlane',
        layers: nextLayers,
        ...(orientation === 'vertical'
          ? { laneWidth: undefined }
          : { laneWidth: diagram.meta.editor?.laneWidth }),
      },
    },
  }
}

/** 纵向模式下新增泳道的默认几何 */
export function defaultVerticalLane(order: number, id: string, label: string): EditorLayer {
  return {
    id,
    label,
    order,
    width: VERTICAL_LANE_WIDTH,
    height: VERTICAL_LANE_HEIGHT,
  }
}

type Side = FlowchartEdge['fromSide']

/**
 * 跨纵向泳道：强制东/西出边 + 北入边，经顶部走廊正交折线。
 * （勿先按 laneDelta 写成 s→n，否则会从列底绕顶穿柱）
 */
export function applyVerticalCrossLaneRoutes(
  nodes: FlowchartNode[],
  edges: FlowchartEdge[],
  laneOf: (id: string) => number,
): FlowchartEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return edges.map((e) => {
    const fromLi = laneOf(e.from)
    const toLi = laneOf(e.to)
    const colDelta = toLi - fromLi
    if (Math.abs(colDelta) < 1) return e

    const fromSide: Side = colDelta > 0 ? 'e' : 'w'
    const toSide: Side = 'n'
    const a = byId.get(e.from)
    const b = byId.get(e.to)
    let via: Point[] | undefined
    if (a?.pos && a.size && b?.pos && b.size) {
      const { start, end } = edgeEndpoints(a.pos, a.size, b.pos, b.size, 2, fromSide, toSide)
      const channelY = Math.max(
        V_CHANNEL_Y,
        Math.min(start[1], end[1], a.pos[1], b.pos[1]) - 28,
      )
      via = [
        [start[0], channelY],
        [end[0], channelY],
      ]
    }
    return {
      ...e,
      fromSide,
      toSide,
      via,
      route: e.route === 'straight' || e.route === 'curve' ? e.route : 'ortho',
    }
  })
}
