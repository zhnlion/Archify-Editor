import type { ComponentType, FlowShape, FlowchartDocument } from '../types'

type WorkflowNode = {
  id: string
  lane: string
  col: number
  type: string
  label: string
  sublabel?: string
  tag?: string
  width?: number
}

type WorkflowEdge = {
  id: string
  from: string
  to: string
  label?: string
  variant?: string
  role?: string
}

type WorkflowDoc = {
  schema_version: number
  diagram_type: 'workflow'
  meta: Record<string, unknown>
  lanes: Array<{ id: string; label: string; variant?: string }>
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  phases?: unknown[]
  groups?: unknown[]
  mainPath?: string[]
  cards?: unknown[]
}

/** Archify workflow.meta 允许字段（additionalProperties: false） */
const WORKFLOW_META_KEYS = new Set([
  'title',
  'locale',
  'translations',
  'subtitle',
  'output',
  'animation',
  'visual_preset',
  'quality_profile',
  'repository',
  'views',
  'legend',
  'viewBox',
])

/** Schema 允许至 63；合成网格取近似方形，控制宽高以免 browser-check viewport-overflow */
/** 单泳道建议列数上限（过大则图过宽；过小则泳道过多导致过高） */
const COLS_PER_LANE_CAP = 8
/** 超过该列宽时，finalize 优先用 standard（desktop-readability 在 showcase 下为硬错误） */
export const SHOWCASE_SAFE_MAX_COL = 8

function preferredColsPerLane(nodeCount: number): number {
  // ≈√N，夹在 4..8，使 30 节点约 6×5，减轻单一方向撑破视口
  const square = Math.ceil(Math.sqrt(Math.max(1, nodeCount)))
  return Math.min(COLS_PER_LANE_CAP, Math.max(4, square))
}

function shapeToType(shape: FlowShape): ComponentType {
  switch (shape) {
    case 'start':
      return 'external'
    case 'end':
      return 'backend'
    case 'decision':
      return 'security'
    case 'subprocess':
      return 'messagebus'
    case 'database':
    case 'data':
    case 'document':
    case 'multi_document':
      return 'database'
    case 'display':
    case 'note':
    case 'text':
      return 'frontend'
    case 'offpage':
    case 'merge':
      return 'backend'
    default:
      return 'backend'
  }
}

function splitLabel(label: string): { label: string; sublabel?: string } {
  const i = label.indexOf('\n')
  if (i < 0) return { label: label || 'node' }
  return { label: label.slice(0, i) || 'node', sublabel: label.slice(i + 1) || undefined }
}

function sanitizeWorkflowMeta(
  meta: Record<string, unknown>,
  fallback: { title: string; output: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (WORKFLOW_META_KEYS.has(k) && v !== undefined) out[k] = v
  }
  out.title = (typeof out.title === 'string' && out.title) || fallback.title
  out.output = (typeof out.output === 'string' && out.output) || fallback.output
  if (!out.quality_profile) out.quality_profile = 'showcase'
  return out
}

/** 将编辑器 flowchart 文案合并回保留的 Archify workflow（布局/泳道/卡片等仍用源文档） */
export function mergeFlowchartIntoWorkflow(
  flow: FlowchartDocument,
  source: Record<string, unknown>,
): WorkflowDoc {
  const clone = structuredClone(source) as WorkflowDoc
  if (clone.diagram_type !== 'workflow') {
    throw new Error('archify_workflow 不是 workflow 文档')
  }
  const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]))
  const edgeMap = new Map(flow.edges.map((e) => [e.id, e]))

  clone.meta = sanitizeWorkflowMeta(
    {
      ...clone.meta,
      title: flow.meta.title,
      output: flow.meta.output || (clone.meta.output as string) || 'workflow.html',
      subtitle: flow.meta.subtitle ?? clone.meta.subtitle,
      locale: flow.meta.locale ?? clone.meta.locale,
      animation: flow.meta.animation ?? clone.meta.animation,
      visual_preset: flow.meta.visual_preset ?? clone.meta.visual_preset,
      quality_profile: flow.meta.quality_profile || clone.meta.quality_profile || 'showcase',
    },
    { title: flow.meta.title, output: flow.meta.output || 'workflow.html' },
  )

  for (const n of clone.nodes ?? []) {
    const f = nodeMap.get(n.id)
    if (!f) continue
    const parts = splitLabel(f.label)
    n.label = parts.label
    if (parts.sublabel) n.sublabel = parts.sublabel
  }

  for (const e of clone.edges ?? []) {
    const f = edgeMap.get(e.id)
    if (!f) continue
    if (f.label) e.label = f.label
    else delete e.label
  }

  return clone
}

/**
 * 无源文档时合成可 finalize 的 workflow。
 * 关键：同 lane 内 col 必须唯一且间距合法（否则 Archify 报 workflow/node-overlap，退出码 1）。
 */
export function flowchartToWorkflow(flow: FlowchartDocument): WorkflowDoc {
  if (!flow.nodes.length) {
    throw new Error('flowchart 无节点，无法合成 workflow')
  }

  const ordered = [...flow.nodes].sort((a, b) => {
    const ay = a.pos?.[1] ?? 0
    const by = b.pos?.[1] ?? 0
    if (Math.abs(ay - by) > 48) return ay - by
    return (a.pos?.[0] ?? 0) - (b.pos?.[0] ?? 0)
  })

  const colsPerLane = preferredColsPerLane(ordered.length)
  const laneCount = Math.max(1, Math.ceil(ordered.length / colsPerLane))
  const lanes = Array.from({ length: laneCount }, (_, i) => ({
    id: `lane-${i}`,
    label: laneCount === 1 ? 'Main' : `Lane ${i + 1}`,
  }))

  const nodes: WorkflowNode[] = ordered.map((n, i) => {
    const parts = splitLabel(n.label)
    const laneIdx = Math.min(laneCount - 1, Math.floor(i / colsPerLane))
    const col = i % colsPerLane
    // 大图收紧框宽，降低横向溢出概率
    const widthCap = ordered.length >= 20 ? 112 : 140
    return {
      id: n.id,
      lane: lanes[laneIdx].id,
      col,
      type: shapeToType(n.shape),
      label: parts.label,
      sublabel: parts.sublabel,
      width: Math.max(32, Math.min(Math.round(n.size?.[0] ?? widthCap), widthCap)),
    }
  })

  const edges: WorkflowEdge[] = flow.edges
    .filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to))
    .map((e) => {
      const edge: WorkflowEdge = {
        id: e.id,
        from: e.from,
        to: e.to,
        variant: 'default',
      }
      if (e.label) edge.label = e.label
      return edge
    })

  // 大图省略 mainPath，避免额外路由约束把画布撑破视口
  const start = ordered.find((n) => n.shape === 'start')?.id ?? ordered[0]?.id
  const end =
    [...ordered].reverse().find((n) => n.shape === 'end')?.id ?? ordered[ordered.length - 1]?.id
  const mainPath =
    ordered.length <= 16 && start && end && start !== end
      ? buildMainPath(start, end, edges)
      : undefined

  return {
    schema_version: 2,
    diagram_type: 'workflow',
    meta: sanitizeWorkflowMeta(
      {
        title: flow.meta.title,
        output: flow.meta.output || 'workflow.html',
        locale: flow.meta.locale,
        // 合成图默认 standard，避免宽图在 showcase 下被 desktop-readability 否决
        quality_profile: 'standard',
      },
      { title: flow.meta.title, output: 'workflow.html' },
    ),
    lanes,
    nodes,
    edges,
    ...(mainPath && mainPath.length >= 2 ? { mainPath } : {}),
  }
}

export function workflowMaxCol(doc: { nodes?: Array<{ col?: number }> }): number {
  return Math.max(0, ...(doc.nodes ?? []).map((n) => (Number.isInteger(n.col) ? (n.col as number) : 0)))
}

/** 编辑器导出 HTML 时的质量档：宽图 / 节点多 → standard */
export function recommendFinalizeQuality(doc: WorkflowDoc): 'showcase' | 'standard' {
  if (doc.meta.quality_profile === 'standard') return 'standard'
  if (workflowMaxCol(doc) > SHOWCASE_SAFE_MAX_COL) return 'standard'
  if ((doc.nodes?.length ?? 0) > 24) return 'standard'
  return 'showcase'
}

function buildMainPath(start: string, end: string, edges: WorkflowEdge[]): string[] | undefined {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const list = adj.get(e.from) ?? []
    list.push(e.to)
    adj.set(e.from, list)
  }
  const prev = new Map<string, string | null>()
  const q = [start]
  prev.set(start, null)
  while (q.length) {
    const cur = q.shift()!
    if (cur === end) break
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) continue
      prev.set(next, cur)
      q.push(next)
    }
  }
  if (!prev.has(end)) return undefined
  const path: string[] = []
  for (let cur: string | null = end; cur; cur = prev.get(cur) ?? null) path.push(cur)
  path.reverse()
  return path.length >= 2 ? path : undefined
}

export function prepareWorkflowFinalizePayload(flow: FlowchartDocument): {
  diagram: WorkflowDoc
  fromSource: boolean
  quality: 'showcase' | 'standard'
} {
  const source = flow.meta.editor?.archify_workflow
  if (source && typeof source === 'object' && (source as { diagram_type?: string }).diagram_type === 'workflow') {
    const diagram = mergeFlowchartIntoWorkflow(flow, source)
    const quality = recommendFinalizeQuality(diagram)
    diagram.meta.quality_profile = quality
    return { diagram, fromSource: true, quality }
  }
  const diagram = flowchartToWorkflow(flow)
  const quality = recommendFinalizeQuality(diagram)
  diagram.meta.quality_profile = quality
  return { diagram, fromSource: false, quality }
}
