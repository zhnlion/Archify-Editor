import type {
  BoxStyle,
  ComponentType,
  FlowShape,
  FlowchartDocument,
  FlowchartEdge,
  FlowchartNode,
  Point,
  Size,
} from '../types'
import { TYPE_COLOR } from '../types'
import { mapWorkflowRouteToFlow } from '../domain/edgeRoute'
import { edgeEndpoints } from '../domain/geom'
import {
  V_LANE_GAP,
  V_LANE_PAD,
  V_LANE_W,
  V_NODE_H,
  V_STACK_GAP,
  V_TOP,
  applyVerticalCrossLaneRoutes,
  verticalLaneContentHeight,
} from '../domain/verticalSwimlane'
import type { LossyReport, ParseResult } from './types'

interface WorkflowNode {
  id: string
  lane?: string
  col?: number
  type?: string
  label?: string
  sublabel?: string
  tag?: string
  width?: number
  /** 同列竖排：相对泳道内容区中心的纵向偏移（Archify workflow v2） */
  yOffset?: number
  height?: number
}

interface WorkflowEdge {
  id?: string
  from: string
  to: string
  label?: string
  role?: string
  variant?: string
  route?: string
  fromSide?: string
  toSide?: string
}

interface WorkflowDoc {
  schema_version?: number
  diagram_type?: string
  meta?: {
    title?: string
    subtitle?: string
    output?: string
    locale?: string
    animation?: string
    visual_preset?: string
    quality_profile?: string
  }
  lanes?: Array<{ id: string; label?: string; variant?: string }>
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  phases?: unknown[]
  groups?: Array<{ id: string; label?: string; lane?: string; fromCol?: number; toCol?: number }>
  mainPath?: string[]
  cards?: unknown[]
}

const COL_W = 200
const LANE_H = 150
const ORIGIN_X = 72
const ORIGIN_Y = 48
const NODE_H = V_NODE_H

function mapWorkflowSide(side?: string): FlowchartEdge['fromSide'] | undefined {
  if (side === 'top' || side === 'n') return 'n'
  if (side === 'bottom' || side === 's') return 's'
  if (side === 'left' || side === 'w') return 'w'
  if (side === 'right' || side === 'e') return 'e'
  return undefined
}

const SEMANTIC_TYPES = new Set<string>([
  'external',
  'frontend',
  'backend',
  'database',
  'cloud',
  'security',
  'messagebus',
])

function styleForType(type?: string): BoxStyle | undefined {
  if (!type || !SEMANTIC_TYPES.has(type)) return undefined
  const stroke = TYPE_COLOR[type as ComponentType]
  return {
    fill: '#1e2731',
    stroke,
    text: '#e7eef6',
    strokeWidth: 1.6,
  }
}

function inferShape(
  node: WorkflowNode,
  incoming: Set<string>,
  outgoing: Set<string>,
  mainPath: string[] | undefined,
  branchSources: Set<string>,
): FlowShape {
  if (mainPath?.[0] === node.id || (!incoming.has(node.id) && outgoing.has(node.id))) return 'start'
  if (
    (mainPath && mainPath[mainPath.length - 1] === node.id) ||
    (incoming.has(node.id) && !outgoing.has(node.id))
  ) {
    return 'end'
  }
  if (branchSources.has(node.id) || node.type === 'security') return 'decision'
  return 'process'
}

/**
 * 框图主标题用 label（如 redirect）；丢弃「快路径 1」「2」等序号类 sublabel。
 * 「5 · 分流本机流」仅保留描述作副行。
 */
export function workflowDisplayLabel(n: Pick<WorkflowNode, 'id' | 'label' | 'sublabel'>): string {
  const title = (n.label ?? n.id).trim()
  const raw = n.sublabel?.trim()
  if (!raw) return title
  if (/^(?:快路径\s*)?\d+$/u.test(raw)) return title
  const note = raw.replace(/^\d+\s*·\s*/u, '').trim()
  if (!note || /^(?:快路径\s*)?\d+$/u.test(note)) return title
  return `${title}\n${note}`
}

export function isArchifyWorkflow(raw: unknown): raw is WorkflowDoc {
  if (!raw || typeof raw !== 'object') return false
  const d = raw as WorkflowDoc
  return d.diagram_type === 'workflow' && Array.isArray(d.nodes) && Array.isArray(d.edges)
}

/** Archify workflow → flowchart（保留源文档供 finalize HTML） */
export function projectWorkflowToFlowchart(raw: unknown): ParseResult {
  if (!isArchifyWorkflow(raw)) {
    return {
      ok: false,
      error: {
        code: 'ValidateError',
        message: '不是合法的 Archify workflow（需要 diagram_type=workflow 与 nodes/edges）',
      },
    }
  }

  const lanes = raw.lanes ?? []
  const laneIndex = new Map(lanes.map((l, i) => [l.id, i]))
  const mainPath = raw.mainPath
  const dropped: string[] = []
  if (raw.phases?.length) dropped.push('phases（编辑态未画；导出 HTML 仍保留）')
  if (raw.groups?.length) dropped.push('groups（编辑态未画；导出 HTML 仍保留）')
  if (raw.cards?.length) dropped.push('cards（编辑态未画；导出 HTML 仍保留）')

  const incoming = new Set<string>()
  const outgoing = new Set<string>()
  const branchSources = new Set<string>()
  for (const e of raw.edges ?? []) {
    outgoing.add(e.from)
    incoming.add(e.to)
    if (e.role === 'branch' || e.role === 'error' || (e.label && /[?？]|yes|no|是|否|denied|approval/i.test(e.label))) {
      branchSources.add(e.from)
    }
  }

  const hasVerticalStack = (raw.nodes ?? []).some(
    (n) => typeof n.yOffset === 'number' && Number.isFinite(n.yOffset),
  )
  /** 多 group 同泳道分列 → 编辑态纵向泳道（每 SFC / Fast path 一列） */
  const colGroups = (raw.groups ?? []).filter(
    (g) => typeof g.fromCol === 'number' && g.fromCol === g.toCol,
  )
  const useVerticalLanes = hasVerticalStack && colGroups.length >= 2

  type LaneDef = { id: string; label: string; col: number; order: number }
  const verticalLaneDefs: LaneDef[] = useVerticalLanes
    ? [
        ...colGroups
          .slice()
          .sort((a, b) => (a.fromCol ?? 0) - (b.fromCol ?? 0))
          .map((g, order) => ({
            id: g.id,
            label: g.label ?? g.id,
            col: g.fromCol ?? order,
            order,
          })),
        // Output 等非 group 列（如 lane=out）
        ...lanes
          .filter((l) => l.id !== 'main' && !colGroups.some((g) => g.lane === l.id))
          .map((l, i) => ({
            id: l.id,
            label: l.label ?? l.id,
            col: 100 + i,
            order: colGroups.length + i,
          })),
      ]
    : []

  const colToLaneOrder = new Map(verticalLaneDefs.map((d) => [d.col, d.order]))
  const nodeLane = new Map<string, number>()
  const nodeCol = new Map<string, number>()

  // 先按列收集，便于纵向对齐
  const rawNodes = raw.nodes ?? []
  const byCol = new Map<number, WorkflowNode[]>()
  for (const n of rawNodes) {
    const col = n.col ?? 0
    if (!byCol.has(col)) byCol.set(col, [])
    byCol.get(col)!.push(n)
  }
  for (const list of byCol.values()) {
    list.sort((a, b) => (a.yOffset ?? 0) - (b.yOffset ?? 0))
  }

  const stackCountByOrder = new Map<number, number>()
  if (useVerticalLanes) {
    for (const d of verticalLaneDefs) {
      const count =
        d.col >= 100
          ? rawNodes.filter((n) => n.lane === d.id).length
          : (byCol.get(d.col)?.length ?? 0)
      stackCountByOrder.set(d.order, Math.max(1, count))
    }
  }

  const nodes: FlowchartNode[] = rawNodes.map((n, index) => {
    const li = n.lane != null ? (laneIndex.get(n.lane) ?? 0) : Math.floor(index / 4)
    const col = n.col ?? index % 4
    const size: Size = [
      Math.min(n.width ?? 140, useVerticalLanes ? V_LANE_W - 24 : 140),
      useVerticalLanes ? Math.max(32, n.height ?? NODE_H) : NODE_H,
    ]
    let pos: Point
    if (useVerticalLanes) {
      const order =
        n.lane && n.lane !== 'main'
          ? (verticalLaneDefs.find((d) => d.id === n.lane)?.order ?? colToLaneOrder.get(col) ?? 0)
          : (colToLaneOrder.get(col) ?? col)
      nodeLane.set(n.id, order)
      nodeCol.set(n.id, order)
      const bandX = V_LANE_PAD + order * (V_LANE_W + V_LANE_GAP)
      const peers =
        n.lane && n.lane !== 'main'
          ? rawNodes
              .filter((p) => p.lane === n.lane)
              .slice()
              .sort((a, b) => (a.col ?? 0) - (b.col ?? 0) || (a.yOffset ?? 0) - (b.yOffset ?? 0))
          : (byCol.get(col) ?? [n])
      const stackIdx = Math.max(0, peers.findIndex((p) => p.id === n.id))
      const x = Math.round(bandX + (V_LANE_W - size[0]) / 2)
      const y = V_LANE_PAD + V_TOP + stackIdx * V_STACK_GAP
      pos = [x, y]
    } else {
      nodeLane.set(n.id, li)
      nodeCol.set(n.id, col)
      pos = [ORIGIN_X + col * COL_W, ORIGIN_Y + 28 + li * LANE_H]
    }
    return {
      id: n.id,
      // 纵向 SFC 投影：一律过程矩形，避免 security 被推断成菱形决策
      shape: useVerticalLanes
        ? 'process'
        : inferShape(n, incoming, outgoing, mainPath, branchSources),
      label: workflowDisplayLabel(n),
      pos,
      size,
      style: styleForType(n.type),
    }
  })

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const maxRight = nodes.reduce((m, n) => Math.max(m, (n.pos?.[0] ?? 0) + (n.size?.[0] ?? 0)), 0)

  let edges: FlowchartEdge[] = (raw.edges ?? []).map((e, i) => {
    const fromLi = nodeLane.get(e.from) ?? 0
    const toLi = nodeLane.get(e.to) ?? 0
    const fromCol = nodeCol.get(e.from) ?? 0
    const toCol = nodeCol.get(e.to) ?? 0
    const laneDelta = toLi - fromLi
    const colDelta = toCol - fromCol
    const authoredFrom = mapWorkflowSide(e.fromSide)
    const authoredTo = mapWorkflowSide(e.toSide)
    let fromSide: FlowchartEdge['fromSide'] = authoredFrom
    let toSide: FlowchartEdge['toSide'] = authoredTo
    let via: Point[] | undefined
    if (!fromSide && !toSide) {
      // 纵向泳道：仅同列竖排用 s→n；跨列交给 applyVerticalCrossLaneRoutes
      if (useVerticalLanes && colDelta === 0) {
        fromSide = 's'
        toSide = 'n'
      } else if (!useVerticalLanes && laneDelta > 0) {
        fromSide = 's'
        toSide = 'n'
      } else if (!useVerticalLanes && laneDelta < 0) {
        fromSide = 'n'
        toSide = 's'
      } else if (!useVerticalLanes && hasVerticalStack && colDelta === 0) {
        fromSide = 's'
        toSide = 'n'
      }
    }
    // 非纵向多泳道：保留旧的右侧走廊回退
    if (!useVerticalLanes && Math.abs(laneDelta) >= 2 && Math.abs(colDelta) >= 3) {
      const a = nodeById.get(e.from)
      const b = nodeById.get(e.to)
      if (a?.pos && a.size && b?.pos && b.size) {
        const { start, end } = edgeEndpoints(a.pos, a.size, b.pos, b.size, 2, fromSide, toSide)
        const channelX = Math.round(maxRight + 48)
        via = [
          [start[0], start[1] + (laneDelta > 0 ? -18 : 18)],
          [channelX, start[1] + (laneDelta > 0 ? -18 : 18)],
          [channelX, end[1]],
        ]
      }
    }
    return {
      id: e.id ?? `e-${i + 1}`,
      from: e.from,
      to: e.to,
      label: e.label,
      route: mapWorkflowRouteToFlow(e.route),
      fromSide,
      toSide,
      via,
      style:
        e.variant === 'emphasis'
          ? { stroke: '#3d9cf0', strokeWidth: 2, arrow: 'end' as const }
          : e.variant === 'security' || e.role === 'error'
            ? { stroke: '#f87171', strokeWidth: 1.6, arrow: 'end' as const }
            : e.variant === 'dashed'
              ? {
                  stroke: '#94a3b8',
                  strokeWidth: 1.4,
                  arrow: 'end' as const,
                  strokeDasharray: '6 4',
                }
              : undefined,
    }
  })

  if (useVerticalLanes) {
    edges = applyVerticalCrossLaneRoutes(nodes, edges, (id) => nodeLane.get(id) ?? 0)
  }

  const editorLayers = useVerticalLanes
    ? verticalLaneDefs.map((d) => ({
        id: d.id,
        label: d.label,
        order: d.order,
        width: V_LANE_W,
        height: verticalLaneContentHeight(stackCountByOrder.get(d.order) ?? 1),
        style: {
          fill:
            d.id === 'g_fast' || d.label.includes('Fast')
              ? 'rgba(61,156,240,0.10)'
              : 'rgba(148,163,184,0.08)',
          stroke:
            d.label.includes('Forward')
              ? '#f87171'
              : d.label.includes('Localin')
                ? '#a78bfa'
                : '#64748b',
        },
      }))
    : lanes.map((l, order) => {
        const offsets = (raw.nodes ?? [])
          .filter((n) => n.lane === l.id && typeof n.yOffset === 'number')
          .map((n) => Math.abs(n.yOffset as number))
        const stackH = offsets.length
          ? Math.max(LANE_H, Math.max(...offsets) * 2 + NODE_H + 80)
          : LANE_H
        return {
          id: l.id,
          label: l.label ?? l.id,
          order,
          height: stackH,
          style:
            l.variant === 'exception'
              ? { fill: 'rgba(248,113,113,0.08)', stroke: '#7f1d1d' }
              : { fill: 'rgba(61,156,240,0.06)', stroke: '#2a3542' },
        }
      })

  const diagram: FlowchartDocument = {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: {
      title: raw.meta?.title ?? 'Imported workflow',
      subtitle: raw.meta?.subtitle,
      output: raw.meta?.output ?? 'workflow.html',
      locale: raw.meta?.locale,
      animation: raw.meta?.animation,
      visual_preset: raw.meta?.visual_preset,
      quality_profile: raw.meta?.quality_profile,
      format_hints: { source: 'archify' },
      editor: {
        mode: editorLayers.length ? 'swimlane' : 'free',
        laneOrientation: useVerticalLanes ? 'vertical' : 'horizontal',
        laneWidth: useVerticalLanes ? V_LANE_W : undefined,
        layers: editorLayers,
        /** 完整源文档：导出 HTML 走 Archify finalize workflow，观感与 CLI 一致 */
        archify_workflow: structuredClone(raw) as Record<string, unknown>,
      },
    },
    nodes,
    edges,
  }

  const lossy: LossyReport | undefined = dropped.length
    ? {
        dropped,
        notes: [
          '已从 Archify workflow 转换；编辑态为简化泳道视图',
          '导出 HTML 将使用保留的源文档经 Archify finalize，精美效果与 Archify 一致',
        ],
      }
    : {
        dropped: [],
        notes: ['导出 HTML 可走 Archify finalize workflow'],
      }

  return {
    ok: true,
    diagram,
    format_hints: { source: 'archify' },
    lossy,
    warnings: dropped.length
      ? [
          {
            code: 'LossyImportWarning',
            message: '编辑态未展示 phases/groups/cards；导出 HTML 仍完整保留',
            details: dropped,
          },
        ]
      : undefined,
  }
}
