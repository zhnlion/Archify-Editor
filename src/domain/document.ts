import type {
  AnyDiagram,
  ArchifyComponent,
  ArchifyDiagram,
  EditorLayer,
  FlowShape,
  FlowchartDocument,
  FlowchartNode,
  LaneOrientation,
  Point,
  Size,
} from '../types'
import {
  DEFAULT_LAYER_HEIGHT,
  LAYER_PAD,
  LAYER_WIDTH,
  MIN_SIZE,
  SHAPE_DEFAULT,
  VERTICAL_LANE_HEIGHT,
  VERTICAL_LANE_WIDTH,
} from '../types'
import { clampSize } from './geom'

let seq = 1
export function nextId(prefix: string) {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export function isFlowchart(d: AnyDiagram): d is FlowchartDocument {
  return d.diagram_type === 'flowchart'
}

export function isArchitecture(d: AnyDiagram): d is ArchifyDiagram {
  return d.diagram_type === 'architecture'
}

/**
 * Archify architecture 样例里 connections[].id 经常省略。
 * 编辑器渲染用 edge.id 做 React key；缺 id 会导致多边共用 undefined 键，画布只显示少数连线。
 */
export function normalizeArchitecture(doc: ArchifyDiagram): ArchifyDiagram {
  const used = new Set<string>()
  const connections = (doc.connections ?? []).map((edge, index) => {
    let id = typeof edge.id === 'string' ? edge.id.trim() : ''
    if (!id) id = `c${index + 1}`
    if (used.has(id)) {
      const base = id
      let n = 2
      while (used.has(`${base}-${n}`)) n += 1
      id = `${base}-${n}`
    }
    used.add(id)
    return { ...edge, id }
  })
  return { ...doc, connections }
}

export function parseDiagram(raw: unknown): AnyDiagram {
  if (!raw || typeof raw !== 'object') throw new Error('JSON 不是对象')
  const data = raw as Partial<AnyDiagram>
  if (data.diagram_type === 'flowchart') {
    const doc = data as FlowchartDocument
    if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
      throw new Error('flowchart 缺少 nodes / edges')
    }
    return doc
  }
  if (data.diagram_type === 'architecture') {
    const doc = data as ArchifyDiagram
    if (!Array.isArray(doc.components)) throw new Error('architecture 缺少 components')
    return normalizeArchitecture(doc)
  }
  throw new Error('无法识别 diagram_type（需要 flowchart 或 architecture）')
}

export function ensurePos(pos: Point | undefined, index: number): Point {
  if (pos) return pos
  return [80 + (index % 4) * 180, 80 + Math.floor(index / 4) * 120]
}

export function ensureSize(size: Size | undefined, fallback: Size = [140, 60]): Size {
  return clampSize(size ?? fallback, MIN_SIZE)
}

/**
 * 多选统一改节点尺寸：可只改宽或只改高，另一维保留各节点原值。
 * 仅作用于 flowchart.nodes / architecture.components，不改泳道层带。
 */
export function batchResizeNodes(
  diagram: AnyDiagram,
  ids: string[],
  patch: { width?: number; height?: number },
): AnyDiagram {
  if (!ids.length || (patch.width == null && patch.height == null)) return diagram
  const idset = new Set(ids)
  const apply = <T extends { id: string; size?: Size }>(node: T): T => {
    if (!idset.has(node.id)) return node
    const [ow, oh] = ensureSize(node.size)
    return {
      ...node,
      size: clampSize([
        patch.width != null ? patch.width : ow,
        patch.height != null ? patch.height : oh,
      ]),
    }
  }
  if (isFlowchart(diagram)) return { ...diagram, nodes: diagram.nodes.map(apply) }
  if (isArchitecture(diagram)) return { ...diagram, components: diagram.components.map(apply) }
  return diagram
}

export function emptyFlowchart(): FlowchartDocument {
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: { title: '未命名流程图', output: 'flow.html', locale: 'zh-CN' },
    nodes: [],
    edges: [],
  }
}

export function emptyArchitecture(mode: 'free' | 'layered' = 'free'): ArchifyDiagram {
  const layers: EditorLayer[] =
    mode === 'layered'
      ? [
          { id: 'layer-web', label: '展示层', order: 0, height: DEFAULT_LAYER_HEIGHT },
          { id: 'layer-svc', label: '服务层', order: 1, height: DEFAULT_LAYER_HEIGHT },
          { id: 'layer-data', label: '数据层', order: 2, height: DEFAULT_LAYER_HEIGHT },
        ]
      : []
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: mode === 'layered' ? '未命名分层架构' : '未命名架构图',
      output: 'architecture.html',
      locale: 'zh-CN',
      quality_profile: 'showcase',
      editor: { mode, layers },
    },
    components: [],
    connections: [],
    boundaries:
      mode === 'layered'
        ? layers.map((l) => ({ kind: 'region', label: l.label, wraps: [] as string[] }))
        : [],
  }
}

export function architectureMode(d: ArchifyDiagram): 'free' | 'layered' {
  return d.meta.editor?.mode === 'layered' ? 'layered' : 'free'
}

export function sortedLayers(d: ArchifyDiagram): EditorLayer[] {
  const layers = d.meta.editor?.layers ?? []
  return [...layers].sort((a, b) => a.order - b.order)
}

export function resolveLaneOrientation(d: {
  meta?: { editor?: { laneOrientation?: LaneOrientation; mode?: string } }
}): LaneOrientation {
  return d.meta?.editor?.laneOrientation === 'vertical' ? 'vertical' : 'horizontal'
}

export function resolveLaneWidth(d: {
  meta?: { editor?: { laneWidth?: number; layers?: EditorLayer[]; laneOrientation?: LaneOrientation } }
}): number {
  const vertical = resolveLaneOrientation(d) === 'vertical'
  const explicit = d.meta?.editor?.laneWidth
  const min = vertical ? 120 : 200
  if (typeof explicit === 'number' && explicit >= min) return explicit
  const fromLayer = d.meta?.editor?.layers?.find((l) => typeof l.width === 'number')?.width
  if (typeof fromLayer === 'number' && fromLayer >= min) return fromLayer
  return vertical ? VERTICAL_LANE_WIDTH : LAYER_WIDTH
}

export function layerBand(
  layers: EditorLayer[],
  index: number,
  laneWidth: number = LAYER_WIDTH,
  orientation: LaneOrientation = 'horizontal',
) {
  const layer = layers[index]!
  if (orientation === 'vertical') {
    // 与 workflowProjection / verticalSwimlane.V_LANE_GAP 对齐，避免美化后列心错位
    const gap = 12
    const x = layers
      .slice(0, index)
      .reduce((sum, l) => sum + (l.width ?? laneWidth ?? VERTICAL_LANE_WIDTH) + gap, LAYER_PAD)
    const w = layer.width ?? laneWidth ?? VERTICAL_LANE_WIDTH
    const h = layer.height ?? VERTICAL_LANE_HEIGHT
    return { x, y: LAYER_PAD, w, h }
  }
  const y = layers.slice(0, index).reduce((sum, l) => sum + (l.height ?? DEFAULT_LAYER_HEIGHT) + 8, LAYER_PAD)
  const h = layer.height ?? DEFAULT_LAYER_HEIGHT
  const w = layer.width ?? laneWidth
  return { x: LAYER_PAD, y, w, h }
}

export const MIN_LANE_HEIGHT = 80
export const MIN_LANE_WIDTH = 320
export const MIN_VERTICAL_LANE_WIDTH = 140
export const MAX_LANE_HEIGHT = 1600
export const MAX_LANE_WIDTH = 2400

export function layerIndexAtY(
  layers: EditorLayer[],
  y: number,
  laneWidth: number = LAYER_WIDTH,
  orientation: LaneOrientation = 'horizontal',
): number {
  if (!layers.length) return 0
  if (orientation === 'vertical') {
    // 纵向泳道按 Y 不换列；保留 API，默认落在当前列由 layerIndexAtX 处理
    return 0
  }
  for (let i = 0; i < layers.length; i++) {
    const b = layerBand(layers, i, laneWidth, orientation)
    if (y >= b.y && y <= b.y + b.h) return i
  }
  if (y < layerBand(layers, 0, laneWidth, orientation).y) return 0
  return layers.length - 1
}

export function layerIndexAtX(
  layers: EditorLayer[],
  x: number,
  laneWidth: number = LAYER_WIDTH,
  orientation: LaneOrientation = 'horizontal',
): number {
  if (!layers.length) return 0
  if (orientation !== 'vertical') return 0
  for (let i = 0; i < layers.length; i++) {
    const b = layerBand(layers, i, laneWidth, orientation)
    if (x >= b.x && x <= b.x + b.w) return i
  }
  if (x < layerBand(layers, 0, laneWidth, orientation).x) return 0
  return layers.length - 1
}

/** 按朝向取泳道索引（横向看 Y，纵向看 X） */
export function layerIndexAtPoint(
  layers: EditorLayer[],
  pt: Point,
  laneWidth: number = LAYER_WIDTH,
  orientation: LaneOrientation = 'horizontal',
): number {
  return orientation === 'vertical'
    ? layerIndexAtX(layers, pt[0], laneWidth, orientation)
    : layerIndexAtY(layers, pt[1], laneWidth, orientation)
}

export function clampToLayer(
  pos: Point,
  size: Size,
  band: { x: number; y: number; w: number; h: number },
  orientation: LaneOrientation = 'horizontal',
): Point {
  const topPad = orientation === 'vertical' ? 36 : 28
  const minX = band.x + 8
  const minY = band.y + topPad
  const maxX = band.x + band.w - size[0] - 8
  const maxY = band.y + band.h - size[1] - 8
  return [
    Math.round(Math.min(Math.max(pos[0], minX), Math.max(minX, maxX))),
    Math.round(Math.min(Math.max(pos[1], minY), Math.max(minY, maxY))),
  ]
}

export function componentLayerIndex(d: ArchifyDiagram, id: string): number {
  const layers = sortedLayers(d)
  const bounds = d.boundaries ?? []
  const hit = bounds.findIndex((b) => b.wraps.includes(id))
  if (hit >= 0) return Math.min(hit, Math.max(0, layers.length - 1))
  return 0
}

export function syncBoundaries(d: ArchifyDiagram): ArchifyDiagram {
  const layers = sortedLayers(d)
  if (!layers.length || architectureMode(d) !== 'layered') return d
  const assigned = new Set<string>()
  const layerLabels = new Set(layers.map((l) => l.label))
  /** 非层标签边界（外层系统框 / security-group 等）须保留，避免导入后丢失 */
  const extras = (d.boundaries ?? []).filter((b) => !layerLabels.has(b.label))
  const laneW = resolveLaneWidth(d)
  const layerBounds = layers.map((layer, i) => {
    const wraps = (d.boundaries ?? []).find((b) => b.label === layer.label)?.wraps.slice() ?? []
    const band = layerBand(layers, i, laneW)
    for (const c of d.components) {
      if (assigned.has(c.id)) continue
      const pos = ensurePos(c.pos, 0)
      const size = ensureSize(c.size)
      const cy = pos[1] + size[1] / 2
      if (cy >= band.y && cy <= band.y + band.h) {
        if (!wraps.includes(c.id)) wraps.push(c.id)
        assigned.add(c.id)
      }
    }
    return { kind: 'region' as const, label: layer.label, wraps }
  })
  for (const c of d.components) {
    if (assigned.has(c.id)) continue
    layerBounds[0]?.wraps.push(c.id)
  }
  return {
    ...d,
    boundaries: [...layerBounds, ...extras],
    meta: { ...d.meta, editor: { ...d.meta.editor, mode: 'layered', layers } },
  }
}

export function assignComponentLayer(d: ArchifyDiagram, id: string, layerIndex: number): ArchifyDiagram {
  const layers = sortedLayers(d)
  const boundaries = layers.map((layer, i) => {
    const prev = (d.boundaries ?? []).find((b) => b.label === layer.label)
    const wraps = (prev?.wraps ?? []).filter((w) => w !== id)
    if (i === layerIndex) wraps.push(id)
    return { kind: 'region', label: layer.label, wraps }
  })
  return { ...d, boundaries }
}

/** Archify architecture.schema.json 白名单（additionalProperties: false） */
const ARCH_META_KEYS = [
  'title',
  'locale',
  'translations',
  'subtitle',
  'output',
  'animation',
  'visual_preset',
  'quality_profile',
  'engineering_profile',
  'repository',
  'views',
  'legend',
  'viewBox',
] as const

const ARCH_COMPONENT_KEYS = [
  'id',
  'type',
  'label',
  'sublabel',
  'tag',
  'icon',
  'brand',
  'sources',
  'row',
  'col',
  'pos',
  'size',
] as const

const ARCH_CONNECTION_KEYS = [
  'id',
  'from',
  'to',
  'label',
  'variant',
  'fromSide',
  'toSide',
  'route',
  'via',
  'labelAt',
  'labelDx',
  'labelDy',
  'labelSegment',
  'width',
] as const

function pickDefined<T extends Record<string, unknown>>(src: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return out as Partial<T>
}

/** 仅保留 schema 允许的 boundary 字段（kind/label/wraps/pad）；丢弃分侧 pad 等编辑扩展 */
export function sanitizeBoundaryForFinalize(b: {
  kind: string
  label: string
  wraps: string[]
  pad?: number
  padX?: number
  padY?: number
  padLeft?: number
  padRight?: number
  padTop?: number
  padBottom?: number
  [k: string]: unknown
}): { kind: string; label: string; wraps: string[]; pad?: number } {
  const out: { kind: string; label: string; wraps: string[]; pad?: number } = {
    kind: b.kind,
    label: b.label,
    wraps: b.wraps,
  }
  const candidates = [b.pad, b.padX, b.padY, b.padLeft, b.padRight, b.padTop, b.padBottom].filter(
    (n): n is number => typeof n === 'number' && n >= 0,
  )
  if (candidates.length) out.pad = Math.max(...candidates)
  return out
}

export function stripForFinalize(d: ArchifyDiagram): ArchifyDiagram {
  const synced = architectureMode(d) === 'layered' ? syncBoundaries(d) : d
  const metaSrc = synced.meta as unknown as Record<string, unknown>
  const meta = pickDefined(metaSrc, ARCH_META_KEYS) as unknown as ArchifyDiagram['meta']
  if (!meta.title) meta.title = synced.meta.title
  if (!meta.output) meta.output = synced.meta.output || 'architecture.html'

  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta,
    components: synced.components.map((c) =>
      pickDefined(c as unknown as Record<string, unknown>, ARCH_COMPONENT_KEYS),
    ) as unknown as ArchifyDiagram['components'],
    connections: (synced.connections ?? []).map((c) => {
      const raw = { ...(c as unknown as Record<string, unknown>) }
      if (raw.route === 'curve') delete raw.route
      delete raw.via
      delete raw.style
      return pickDefined(raw, ARCH_CONNECTION_KEYS)
    }) as unknown as ArchifyDiagram['connections'],
    boundaries: (synced.boundaries ?? [])
      .filter((b) => b.wraps.length > 0)
      .map((b) =>
        sanitizeBoundaryForFinalize(b as { kind: string; label: string; wraps: string[]; pad?: number }),
      ),
    cards: synced.cards,
  }
}

export function filenameFor(d: AnyDiagram): string {
  const base = slugify(d.meta.title)
  return `${base}.${d.diagram_type}.json`
}

export function slugify(s: string) {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
      .replace(/^-|-$/g, '') || 'diagram'
  )
}

export function defaultFlowNode(shape: FlowchartNode['shape'], pos: Point): FlowchartNode {
  const size: Size =
    shape === 'decision'
      ? [140, 90]
      : shape === 'start' || shape === 'end' || shape === 'connector'
        ? [120, 48]
        : shape === 'arrow_up' || shape === 'arrow_down'
          ? [72, 100]
          : shape === 'arrow_right' || shape === 'arrow_left' || shape === 'arrow_both' || shape === 'chevron'
            ? [140, 48]
            : shape === 'database'
              ? [120, 72]
              : shape === 'merge'
                ? [120, 64]
                : shape === 'offpage'
                  ? [100, 72]
                  : shape === 'multi_document'
                    ? [140, 72]
                    : shape === 'text'
                      ? [160, 40]
                      : shape === 'note'
                        ? [140, 72]
                        : [150, 56]
  const labels: Partial<Record<FlowchartNode['shape'], string>> = {
    start: '开始',
    end: '结束',
    decision: '判断?',
    process: '过程',
    subprocess: '子流程',
    document: '文档',
    data: '数据',
    preparation: '准备',
    manual: '手工',
    delay: '延迟',
    connector: '○',
    display: '显示',
    note: '注释',
    text: '文本',
    database: '数据库',
    offpage: '跨页',
    merge: '合并',
    multi_document: '多文档',
    chevron: '下一步',
    arrow_right: '→',
    arrow_left: '←',
    arrow_up: '↑',
    arrow_down: '↓',
    arrow_both: '↔',
  }
  return {
    id: nextId(shape),
    shape,
    label: labels[shape] ?? shape,
    pos,
    size,
  }
}

export function defaultArchNode(type: ArchifyComponent['type'], pos: Point): ArchifyComponent {
  return {
    id: nextId(type),
    type,
    label: type,
    sublabel: 'new',
    pos,
    size: [140, 60],
  }
}

/** 从统一流程符号库插入到架构图；shape/style 仅存在于编辑器，finalize 会剥离。 */
export function defaultArchShapeNode(shape: FlowShape, pos: Point): ArchifyComponent {
  const flow = defaultFlowNode(shape, pos)
  return {
    id: flow.id,
    type: 'backend',
    label: flow.label,
    pos: flow.pos,
    size: flow.size,
    shape,
    style: SHAPE_DEFAULT[shape],
  }
}
