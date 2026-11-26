import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  AnyDiagram,
  ArchifyComponent,
  FlowchartNode,
  Handle,
  Point,
  Size,
} from '../types'
import {
  applyBoundaryPadResize,
  applyResize,
  boundaryRectFor,
  clientToSvg,
  edgeEndpoints,
  handleCursor,
  handlePos,
  HANDLES,
  resolveBoundaryPads,
} from '../domain/geom'
import { getBoundaryStyle } from '../domain/boundaryStyle'
import {
  MAX_LANE_HEIGHT,
  MAX_LANE_WIDTH,
  MIN_LANE_HEIGHT,
  MIN_LANE_WIDTH,
  MIN_VERTICAL_LANE_WIDTH,
  architectureMode,
  clampToLayer,
  ensurePos,
  ensureSize,
  isArchitecture,
  layerBand,
  layerIndexAtPoint,
  resolveLaneOrientation,
  resolveLaneWidth,
  sortedLayers,
} from '../domain/document'
import {
  buildEdgeGeometry,
  listOrthoSegmentHandles,
  moveOrthoCorner,
  moveOrthoSegment,
  curvePath,
  orthoPoints,
  pointsToPath,
  type Side,
} from '../domain/edgeRoute'
import { linePoints, moveLinePoint, translateLinePoints } from '../domain/standaloneLine'
import { snapToAlignGuides, type AlignGuide } from '../domain/alignGuides'
import { snapPoint, snapResize } from '../domain/snap'
import {
  isNoneFill,
  resolveLineStyle,
  resolveNodeStyle,
  resolveSubFontSize,
  svgStrokeDasharray,
  type ThemeMode,
} from '../domain/style'
import { LANE_THEME } from '../domain/themePalette'
import { labelTextBlockPlacement, nodeLabelLineLayout } from '../domain/textWrap'
import type { TextHAlign, TextVAlign } from '../domain/textWrap'
import {
  boxAnchorPoints,
  nearestAnchor,
  type AnchorPoint,
} from '../domain/anchorPoints'
import { PALETTE_MIME, decodePaletteDrag, type PaletteDragPayload } from '../io/paletteDrag'
import {
  isBoundarySelected,
  isLaneSelected,
  isNodeSelected,
  laneIdsOf,
  normalizeRect,
  nodeIdsOf,
  rectsIntersect,
  selectLanes,
  selectNodes,
  selectOnlyBoundary,
  selectOnlyNode,
  toggleLaneInSelection,
  toggleNodeInSelection,
} from '../domain/selection'
import { sideAnchor, type AnchorSide } from '../domain/geom'
import { FlowShapeGeom } from './flowShapeGeom'

export type Selection =
  | { kind: 'nodes'; ids: string[] }
  | { kind: 'edge'; id: string }
  /** 独立直线 / 折线 */
  | { kind: 'line'; id: string }
  /** 单选或多选区域框（indexes 含父子嵌套框） */
  | { kind: 'boundary'; indexes: number[] }
  /** 单选或多选泳道/层带框体 */
  | { kind: 'lanes'; ids: string[] }
  /** Ctrl+A：组件与全部区域框（可选含泳道） */
  | { kind: 'all'; nodeIds: string[]; boundaryIndexes: number[]; laneIds?: string[]; lineIds?: string[] }
  | null

type Props = {
  diagram: AnyDiagram
  selection: Selection
  linkFrom: string | null
  /** 画布昼夜主题（对齐 Archify data-theme：填充/字色随主题） */
  theme?: ThemeMode
  /** 是否显示画布网格（右键可切换） */
  showGrid?: boolean
  /** 拖拽是否吸附网格（Alt 临时取消） */
  snapToGrid?: boolean
  /** 绘制工具：选中后画布拖拽放置独立线 / 区域框 */
  drawTool?: 'straight' | 'ortho' | 'curve' | 'boundary' | null
  /** 在画布指定位置放置独立直线 / 折线 / 曲线 */
  onAddLine?: (route: 'straight' | 'ortho' | 'curve', from: Point, to: Point) => void
  /** 在画布指定位置画区域框 */
  onAddBoundaryRect?: (pos: Point, size: Size) => void
  /** 改独立线端点 / 拐点 */
  onLinePoints?: (id: string, points: Point[]) => void
  onSelect: (s: Selection) => void
  onMove: (id: string, pos: Point, layerIndex?: number) => void
  onMoveGroup: (moves: Array<{ id: string; pos: Point }>) => void
  onResize: (id: string, pos: Point, size: Size) => void
  /** 区域框：拖哪侧只改哪侧 pad；对侧不动 */
  onBoundaryPad?: (
    index: number,
    pad: Partial<{
      padLeft: number
      padRight: number
      padTop: number
      padBottom: number
      padX: number
      padY: number
      pad: number
    }>,
    /** 手绘区域框的显式矩形；有值时按矩形几何回写 */
    rect?: { pos: Point; size: Size },
  ) => void
  onConnect: (from: string, to: string, meta?: { fromSide?: string; toSide?: string }) => void
  /** 边柄拖到空白处：落新形并连线（续形） */
  onConnectToEmpty?: (from: string, pos: Point, meta?: { fromSide?: string }) => void
  onLinkPick: (id: string) => void
  onEdgeLabel: (id: string, label: string) => void
  onNodeLabel: (id: string, label: string) => void
  onEdgeVia?: (id: string, via: Point[]) => void
  onDropPalette?: (payload: PaletteDragPayload, pos: Point) => void
  /** 调整层/泳道高度/列宽；laneWidth 写全局，width 写单列 */
  onLaneGeometry?: (patch: {
    layerId: string
    height?: number
    width?: number
    laneWidth?: number
  }) => void
  onBeautify?: () => void
  /** 递增时把视口对准图内容（导入 / 切换模板） */
  fitEpoch?: number
  onContextMenu: (e: React.MouseEvent, target: ContextTarget) => void
  /** 格式刷激活：点击节点 / 边应用样式 */
  styleBrushActive?: boolean
  styleBrushKind?: 'node' | 'edge' | null
  onStyleBrushApply?: (id: string) => void
  onStyleBrushApplyEdge?: (id: string) => void
  /** 边标签拖偏移 */
  onEdgeLabelOffset?: (id: string, offset: Point) => void
  /** layered 跨层规则违规边 id（高亮） */
  layerEdgeViolationIds?: ReadonlySet<string>
}

export type ContextTarget =
  | { kind: 'canvas' }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'line'; id: string }
  | { kind: 'boundary'; index: number }

type Drag =
  | {
      kind: 'move'
      /** 主拖动节点；若多选则带动全部 */
      id: string
      ox: number
      oy: number
      starts: Array<{ id: string; pos: Point }>
    }
  | { kind: 'resize'; id: string; handle: Handle; startPos: Point; startSize: Size; origin: Point }
  | {
      kind: 'boundary'
      index: number
      origin: Point
      starts: Array<{ id: string; pos: Point }>
      /** 手绘框：平移显式矩形而非 wraps */
      rect?: { pos: Point; size: Size }
    }
  | {
      kind: 'boundary-resize'
      index: number
      handle: Handle
      startPadLeft: number
      startPadRight: number
      startPadTop: number
      startPadBottom: number
      origin: Point
      /** 手绘框：用 applyResize 改 pos/size */
      rect?: { pos: Point; size: Size }
    }
  | {
      kind: 'lane-resize'
      layerId: string
      /** 多选泳道时一并改高度/宽度 */
      applyIds: string[]
      edge: 'n' | 's' | 'e' | 'w'
      startH: number
      startW: number
      origin: Point
    }
  | { kind: 'pan'; originClient: Point; startScroll: Point }
  | { kind: 'marquee'; origin: Point; current: Point; additive: boolean }
  | { kind: 'link'; fromId: string; fromSide: Side; current: Point }
  /** 拐点拖拽（via 数组下标；basePoints 为按下时含端点的折线快照） */
  | { kind: 'via'; edgeId: string; index: number; basePoints: Point[] }
  /** 中段拖拽（相对 basePoints 的 segment 下标） */
  | { kind: 'via-seg'; edgeId: string; segIndex: number; basePoints: Point[] }
  /** 边标签拖偏移 */
  | { kind: 'label-offset'; edgeId: string; origin: Point; startOffset: Point }
  /** 画布上拖拽画独立线 / 区域框（draw.io 式） */
  | { kind: 'draw-line'; route: 'straight' | 'ortho' | 'curve'; origin: Point; current: Point }
  | { kind: 'draw-boundary'; origin: Point; current: Point }
  /** 独立线整线平移 / 端点拐点拖拽 */
  | { kind: 'line-move'; id: string; origin: Point; basePoints: Point[] }
  | { kind: 'line-point'; id: string; index: number; basePoints: Point[] }

/** 画布世界坐标范围（滚动条可滚区域） */
const CANVAS_WORLD = { x: -120, y: -120, w: 2600, h: 2000 }

function markerId(edgeId: string, kind: 'end' | 'start') {
  return `arrow-${kind}-${edgeId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

export function Canvas({
  diagram,
  selection,
  linkFrom,
  theme = 'dark',
  showGrid = true,
  snapToGrid = true,
  onSelect,
  onMove,
  onMoveGroup,
  onResize,
  onBoundaryPad,
  onAddLine,
  onAddBoundaryRect,
  onLinePoints,
  drawTool = null,
  onConnect,
  onConnectToEmpty,
  onLinkPick,
  onEdgeLabel,
  onNodeLabel,
  onEdgeVia,
  onDropPalette,
  onLaneGeometry,
  onBeautify,
  fitEpoch = 0,
  onContextMenu,
  styleBrushActive = false,
  styleBrushKind = null,
  onStyleBrushApply,
  onStyleBrushApplyEdge,
  onEdgeLabelOffset,
  layerEdgeViolationIds,
}: Props) {
  const dragRef = useRef<Drag | null>(null)
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  const nodeLabelInputRef = useRef<HTMLTextAreaElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([])
  const spacePan = useRef(false)
  const didInitScroll = useRef(false)

  const arch = isArchitecture(diagram)
  const nodes = arch ? diagram.components : diagram.nodes
  const edges = arch ? (diagram.connections ?? []) : diagram.edges
  const boundaries = diagram.boundaries ?? []
  const lines = diagram.lines ?? []
  const swimlane = !arch && diagram.meta.editor?.mode === 'swimlane'
  const layers = arch
    ? sortedLayers(diagram)
    : swimlane
      ? [...(diagram.meta.editor?.layers ?? [])].sort((a, b) => a.order - b.order)
      : []
  /** architecture 分层 或 workflow 导入后的泳道编辑态 */
  const layered = (arch && architectureMode(diagram) === 'layered') || swimlane
  const laneOrientation = resolveLaneOrientation(diagram)
  const laneWidth = resolveLaneWidth(diagram)
  const worldPxW = CANVAS_WORLD.w * zoom
  const worldPxH = CANVAS_WORLD.h * zoom

  useEffect(() => {
    if (editingEdgeId && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [editingEdgeId])

  useEffect(() => {
    if (editingNodeId && nodeLabelInputRef.current) {
      nodeLabelInputRef.current.focus()
      nodeLabelInputRef.current.select()
    }
  }, [editingNodeId])

  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [linkPreview, setLinkPreview] = useState<{ from: Point; to: Point } | null>(null)
  // 拖线经过目标框时：该框的候选锚点 + 离光标最近者（亿图式每边多候选光点）
  const [linkHover, setLinkHover] = useState<{
    nodeId: string
    anchors: AnchorPoint[]
    nearestIndex: number
  } | null>(null)
  const [drawPreview, setDrawPreview] = useState<{
    kind: 'line' | 'boundary'
    from: Point
    to: Point
    route?: 'straight' | 'ortho' | 'curve'
  } | null>(null)

  useEffect(() => {
    if (selection?.kind !== 'edge') setEditingEdgeId(null)
    if (selection?.kind !== 'nodes' || selection.ids.length !== 1) setEditingNodeId(null)
  }, [selection])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (dragRef.current?.kind === 'link' || linkPreview)) {
        dragRef.current = null
        setLinkPreview(null)
        setLinkHover(null)
        return
      }
      if (e.code === 'Space' && !(e.target as HTMLElement)?.closest?.('input,textarea,select')) {
        spacePan.current = true
      }
      const mod = e.ctrlKey || e.metaKey
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomAt(zoom * 1.15)
      }
      if (mod && e.key === '-') {
        e.preventDefault()
        zoomAt(zoom / 1.15)
      }
      if (mod && e.key === '0') {
        e.preventDefault()
        resetView()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spacePan.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [zoom, linkPreview])

  const clampZoom = (z: number) => Math.round(Math.min(2.5, Math.max(0.4, z)) * 100) / 100

  useEffect(() => {
    if (didInitScroll.current) return
    const sc = scrollRef.current
    if (!sc) return
    didInitScroll.current = true
    sc.scrollLeft = (0 - CANVAS_WORLD.x) * zoom - 48
    sc.scrollTop = (0 - CANVAS_WORLD.y) * zoom - 48
  }, [zoom])

  /** 导入后对准内容，避免右侧/下方节点像「消失」 */
  useEffect(() => {
    if (!fitEpoch) return
    const sc = scrollRef.current
    if (!sc) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    nodes.forEach((node, i) => {
      const pos = ensurePos(node.pos, i)
      const size = ensureSize(node.size)
      minX = Math.min(minX, pos[0])
      minY = Math.min(minY, pos[1])
      maxX = Math.max(maxX, pos[0] + size[0])
      maxY = Math.max(maxY, pos[1] + size[1])
    })
    if (!Number.isFinite(minX)) return
    const pad = 48
    const contentW = Math.max(1, maxX - minX + pad * 2)
    const contentH = Math.max(1, maxY - minY + pad * 2)
    const next = clampZoom(Math.min(sc.clientWidth / contentW, sc.clientHeight / contentH, 1.25))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setZoom(next)
    requestAnimationFrame(() => {
      const box = scrollRef.current
      if (!box) return
      box.scrollLeft = (cx - CANVAS_WORLD.x) * next - box.clientWidth / 2
      box.scrollTop = (cy - CANVAS_WORLD.y) * next - box.clientHeight / 2
    })
  }, [fitEpoch])

  const nodeBox = (id: string, i: number) => {
    const n = nodes.find((x) => x.id === id)
    if (!n) return null
    return { pos: ensurePos(n.pos, i), size: ensureSize(n.size) }
  }

  const resetView = () => {
    setZoom(1)
    requestAnimationFrame(() => {
      const sc = scrollRef.current
      if (!sc) return
      sc.scrollLeft = (0 - CANVAS_WORLD.x) * 1 - 48
      sc.scrollTop = (0 - CANVAS_WORLD.y) * 1 - 48
    })
  }

  const zoomAt = (nextZoom: number, clientX?: number, clientY?: number) => {
    const svg = svgRef.current
    const sc = scrollRef.current
    const next = clampZoom(nextZoom)
    if (svg && sc && clientX != null && clientY != null) {
      const before = clientToSvg(svg, clientX, clientY)
      const rect = sc.getBoundingClientRect()
      setZoom(next)
      requestAnimationFrame(() => {
        sc.scrollLeft = (before[0] - CANVAS_WORLD.x) * next - (clientX - rect.left)
        sc.scrollTop = (before[1] - CANVAS_WORLD.y) * next - (clientY - rect.top)
      })
      return
    }
    setZoom(next)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      const sc = scrollRef.current
      if (sc) {
        sc.scrollLeft = drag.startScroll[0] - (e.clientX - drag.originClient[0])
        sc.scrollTop = drag.startScroll[1] - (e.clientY - drag.originClient[1])
      }
      return
    }
    const pt = clientToSvg(e.currentTarget, e.clientX, e.clientY)
    if (drag.kind === 'marquee') {
      drag.current = pt
      setMarquee(normalizeRect(drag.origin[0], drag.origin[1], pt[0], pt[1]))
      return
    }
    if (drag.kind === 'draw-line' || drag.kind === 'draw-boundary') {
      drag.current = pt
      setDrawPreview({
        kind: drag.kind === 'draw-line' ? 'line' : 'boundary',
        from: drag.origin,
        to: pt,
        route: drag.kind === 'draw-line' ? drag.route : undefined,
      })
      return
    }
    if (drag.kind === 'line-move') {
      const dx = pt[0] - drag.origin[0]
      const dy = pt[1] - drag.origin[1]
      onLinePoints?.(drag.id, translateLinePoints(drag.basePoints, dx, dy))
      return
    }
    if (drag.kind === 'line-point') {
      onLinePoints?.(drag.id, moveLinePoint(drag.basePoints, drag.index, pt))
      return
    }
    if (drag.kind === 'link') {
      drag.current = pt
      const fromBox = nodeBox(drag.fromId, nodes.findIndex((n) => n.id === drag.fromId))
      const fromPt = fromBox ? sideAnchor(fromBox.pos, fromBox.size, drag.fromSide as AnchorSide) : pt
      // 命中目标框：显示其每边 3 个候选光点，并把预览线吸附到最近点
      const hit = hitNodeAt(pt)
      if (hit && hit.id !== drag.fromId) {
        const targetIdx = nodes.findIndex((n) => n.id === hit.id)
        const box = nodeBox(hit.id, targetIdx)
        if (box) {
          const anchors = boxAnchorPoints(box.pos, box.size)
          const nearest = nearestAnchor(anchors, pt)
          setLinkHover({ nodeId: hit.id, anchors, nearestIndex: nearest ? anchors.indexOf(nearest) : -1 })
          const snapTo = nearest?.point ?? pt
          setLinkPreview({ from: fromPt, to: snapTo })
          return
        }
      }
      setLinkHover(null)
      setLinkPreview({ from: fromPt, to: pt })
      return
    }
    if (drag.kind === 'via' || drag.kind === 'via-seg') {
      if (!onEdgeVia) return
      const snapped =
        snapToGrid && !e.altKey ? snapPoint(pt) : ([Math.round(pt[0]), Math.round(pt[1])] as Point)
      // 相对按下时的折线快照计算，避免插入 stub 后下标漂移
      if (drag.kind === 'via-seg') {
        onEdgeVia(drag.edgeId, moveOrthoSegment(drag.basePoints, drag.segIndex, snapped))
      } else if (drag.basePoints.length > 2) {
        onEdgeVia(drag.edgeId, moveOrthoCorner(drag.basePoints, drag.index, snapped))
      } else {
        onEdgeVia(drag.edgeId, [snapped])
      }
      return
    }
    if (drag.kind === 'move') {
      const doGrid = snapToGrid && !e.altKey
      const movingIds = new Set(drag.starts.map((s) => s.id))
      const others = nodes
        .map((n, i) => ({
          id: n.id,
          pos: ensurePos(n.pos, i),
          size: ensureSize(n.size),
        }))
        .filter((n) => !movingIds.has(n.id))
      if (drag.starts.length > 1) {
        const originPrimary = drag.starts.find((s) => s.id === drag.id)?.pos
        if (!originPrimary) return
        let odx = Math.round(pt[0] - drag.ox) - originPrimary[0]
        let ody = Math.round(pt[1] - drag.oy) - originPrimary[1]
        const primaryNode = nodes.find((x) => x.id === drag.id)
        const primarySize = ensureSize(primaryNode?.size)
        let tentative: Point = [originPrimary[0] + odx, originPrimary[1] + ody]
        let usedAlign = false
        if (!e.altKey && others.length) {
          const aligned = snapToAlignGuides(
            { id: drag.id, pos: tentative, size: primarySize },
            others,
          )
          if (aligned.guides.length) {
            tentative = aligned.pos
            setAlignGuides(aligned.guides)
            usedAlign = true
            odx = tentative[0] - originPrimary[0]
            ody = tentative[1] - originPrimary[1]
          } else {
            setAlignGuides([])
          }
        } else {
          setAlignGuides([])
        }
        if (doGrid && !usedAlign) {
          const snappedPrimary = snapPoint([originPrimary[0] + odx, originPrimary[1] + ody])
          odx = snappedPrimary[0] - originPrimary[0]
          ody = snappedPrimary[1] - originPrimary[1]
        }
        onMoveGroup(drag.starts.map((s) => ({ id: s.id, pos: [s.pos[0] + odx, s.pos[1] + ody] })))
        return
      }
      const primary = nodes.find((x) => x.id === drag.id)
      let pos: Point = [Math.round(pt[0] - drag.ox), Math.round(pt[1] - drag.oy)]
      const size = ensureSize(primary?.size)
      let usedAlign = false
      if (!e.altKey && others.length) {
        const aligned = snapToAlignGuides({ id: drag.id, pos, size }, others)
        if (aligned.guides.length) {
          pos = aligned.pos
          setAlignGuides(aligned.guides)
          usedAlign = true
        } else {
          setAlignGuides([])
        }
      } else {
        setAlignGuides([])
      }
      if (doGrid && !usedAlign) pos = snapPoint(pos)
      let layerIndex: number | undefined
      if (layered && layers.length) {
        const mid: Point = [pos[0] + size[0] / 2, pos[1] + size[1] / 2]
        layerIndex = layerIndexAtPoint(layers, mid, laneWidth, laneOrientation)
        const band = layerBand(layers, layerIndex, laneWidth, laneOrientation)
        pos = clampToLayer(pos, size, band, laneOrientation)
      }
      onMove(drag.id, pos, layerIndex)
      return
    }
    if (drag.kind === 'boundary') {
      const dx = Math.round(pt[0] - drag.origin[0])
      const dy = Math.round(pt[1] - drag.origin[1])
      if (drag.rect) {
        onBoundaryPad?.(
          drag.index,
          {},
          {
            pos: [drag.rect.pos[0] + dx, drag.rect.pos[1] + dy],
            size: drag.rect.size,
          },
        )
        return
      }
      onMoveGroup(drag.starts.map((s) => ({ id: s.id, pos: [s.pos[0] + dx, s.pos[1] + dy] })))
      return
    }
    if (drag.kind === 'boundary-resize') {
      if (drag.rect) {
        const next = applyResize(drag.rect.pos, drag.rect.size, drag.handle, pt[0] - drag.origin[0], pt[1] - drag.origin[1])
        onBoundaryPad?.(drag.index, {}, { pos: next.pos, size: next.size })
        return
      }
      const dx = pt[0] - drag.origin[0]
      const dy = pt[1] - drag.origin[1]
      const next = applyBoundaryPadResize(
        {
          padLeft: drag.startPadLeft,
          padRight: drag.startPadRight,
          padTop: drag.startPadTop,
          padBottom: drag.startPadBottom,
        },
        drag.handle,
        dx,
        dy,
      )
      onBoundaryPad?.(drag.index, next)
      return
    }
    if (drag.kind === 'lane-resize') {
      const minW = laneOrientation === 'vertical' ? MIN_VERTICAL_LANE_WIDTH : MIN_LANE_WIDTH
      const targets = drag.applyIds.length ? drag.applyIds : [drag.layerId]
      const patchAll = (patch: { height?: number; width?: number; laneWidth?: number }) => {
        for (const id of targets) onLaneGeometry?.({ layerId: id, ...patch })
      }
      if (drag.edge === 's') {
        const dy = pt[1] - drag.origin[1]
        const height = Math.max(MIN_LANE_HEIGHT, Math.min(MAX_LANE_HEIGHT, Math.round(drag.startH + dy)))
        patchAll({ height })
      } else if (drag.edge === 'n') {
        const dy = pt[1] - drag.origin[1]
        const height = Math.max(MIN_LANE_HEIGHT, Math.min(MAX_LANE_HEIGHT, Math.round(drag.startH - dy)))
        patchAll({ height })
      } else if (drag.edge === 'w') {
        const dx = pt[0] - drag.origin[0]
        const w = Math.max(minW, Math.min(MAX_LANE_WIDTH, Math.round(drag.startW - dx)))
        patchAll(laneOrientation === 'vertical' ? { width: w } : { laneWidth: w })
      } else {
        const dx = pt[0] - drag.origin[0]
        const w = Math.max(minW, Math.min(MAX_LANE_WIDTH, Math.round(drag.startW + dx)))
        patchAll(laneOrientation === 'vertical' ? { width: w } : { laneWidth: w })
      }
      return
    }
    if (drag.kind === 'label-offset') {
      const dx = Math.round(pt[0] - drag.origin[0])
      const dy = Math.round(pt[1] - drag.origin[1])
      onEdgeLabelOffset?.(drag.edgeId, [
        drag.startOffset[0] + dx,
        drag.startOffset[1] + dy,
      ])
      return
    }
    if (drag.kind !== 'resize') return
    const dx = pt[0] - drag.origin[0]
    const dy = pt[1] - drag.origin[1]
    const lockAspect = e.shiftKey && drag.handle.length === 2
    let next = applyResize(drag.startPos, drag.startSize, drag.handle, dx, dy, undefined, {
      lockAspect,
    })
    if (snapToGrid && !e.altKey && !lockAspect) {
      next = snapResize(next.pos, next.size, drag.handle)
    }
    onResize(drag.id, next.pos, next.size)
  }

  const hitNodeAt = (pt: Point): { id: string; side: Side } | null => {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]!
      const pos = ensurePos(n.pos, i)
      const size = ensureSize(n.size)
      if (pt[0] >= pos[0] && pt[0] <= pos[0] + size[0] && pt[1] >= pos[1] && pt[1] <= pos[1] + size[1]) {
        const cx = pos[0] + size[0] / 2
        const cy = pos[1] + size[1] / 2
        const dx = pt[0] - cx
        const dy = pt[1] - cy
        let side: Side = 'e'
        if (Math.abs(dx) > Math.abs(dy)) side = dx >= 0 ? 'e' : 'w'
        else side = dy >= 0 ? 's' : 'n'
        return { id: n.id, side }
      }
    }
    return null
  }

  const endDrag = () => {
    const drag = dragRef.current
    if (drag?.kind === 'draw-line') {
      const dist = Math.hypot(drag.current[0] - drag.origin[0], drag.current[1] - drag.origin[1])
      if (dist >= 12) onAddLine?.(drag.route, drag.origin, drag.current)
      setDrawPreview(null)
    }
    if (drag?.kind === 'draw-boundary') {
      const r = normalizeRect(drag.origin[0], drag.origin[1], drag.current[0], drag.current[1])
      if (r.w >= 40 && r.h >= 24) onAddBoundaryRect?.([r.x, r.y], [r.w, r.h])
      setDrawPreview(null)
    }
    if (drag?.kind === 'marquee') {
      const rect = normalizeRect(drag.origin[0], drag.origin[1], drag.current[0], drag.current[1])
      const hit = nodes
        .map((n, i) => {
          const pos = ensurePos(n.pos, i)
          const size = ensureSize(n.size)
          return { id: n.id, box: { x: pos[0], y: pos[1], w: size[0], h: size[1] } }
        })
        .filter((n) => rectsIntersect(rect, n.box))
        .map((n) => n.id)
      const hitLanes =
        layered && !hit.length
          ? layers
              .map((layer, i) => {
                const b = layerBand(layers, i, laneWidth, laneOrientation)
                return { id: layer.id, box: { x: b.x, y: b.y, w: b.w, h: b.h } }
              })
              .filter((l) => rectsIntersect(rect, l.box))
              .map((l) => l.id)
          : []
      if (hitLanes.length && !hit.length) {
        onSelect(
          drag.additive
            ? selectLanes([...laneIdsOf(selection), ...hitLanes])
            : selectLanes(hitLanes),
        )
      } else if (drag.additive) {
        onSelect(selectNodes([...nodeIdsOf(selection), ...hit]))
      } else {
        onSelect(selectNodes(hit))
      }
      setMarquee(null)
    }
    if (drag?.kind === 'link') {
      const hit = hitNodeAt(drag.current)
      // 吸附光点所在边优先，保证落点侧与用户看到的高亮点一致
      const snapSide =
        linkHover && linkHover.nodeId === hit?.id && linkHover.nearestIndex >= 0
          ? linkHover.anchors[linkHover.nearestIndex]?.side
          : undefined
      if (hit && hit.id !== drag.fromId) {
        onConnect(drag.fromId, hit.id, {
          fromSide: drag.fromSide,
          toSide: snapSide ?? hit.side,
        })
      } else if (onConnectToEmpty && (!hit || hit.id === drag.fromId)) {
        const fromBox = nodeBox(drag.fromId, nodes.findIndex((n) => n.id === drag.fromId))
        const fromPt = fromBox
          ? sideAnchor(fromBox.pos, fromBox.size, drag.fromSide as AnchorSide)
          : drag.current
        const dist = Math.hypot(drag.current[0] - fromPt[0], drag.current[1] - fromPt[1])
        // 短拖视为取消，避免点一下端口就落形
        if (dist >= 28) {
          onConnectToEmpty(drag.fromId, drag.current, { fromSide: drag.fromSide })
        }
      }
      setLinkPreview(null)
      setLinkHover(null)
    }
    if (drag?.kind === 'move') setAlignGuides([])
    dragRef.current = null
  }

  const startLink = (e: React.PointerEvent, id: string, side: Side) => {
    e.stopPropagation()
    e.preventDefault()
    const svg = (e.target as Element).closest('svg')
    if (!svg) return
    const pt = clientToSvg(svg, e.clientX, e.clientY)
    const box = nodeBox(id, nodes.findIndex((n) => n.id === id))
    const from = box ? sideAnchor(box.pos, box.size, side as AnchorSide) : pt
    dragRef.current = { kind: 'link', fromId: id, fromSide: side, current: pt }
    setLinkPreview({ from, to: pt })
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onSelect(selectOnlyNode(id))
  }

  const edgePolylinePoints = (edgeId: string): Point[] | null => {
    const edge = edges.find((ed) => ed.id === edgeId)
    if (!edge) return null
    const fi = nodes.findIndex((n) => n.id === edge.from)
    const ti = nodes.findIndex((n) => n.id === edge.to)
    if (fi < 0 || ti < 0) return null
    const a = nodeBox(edge.from, fi)!
    const b = nodeBox(edge.to, ti)!
    const fromSide = 'fromSide' in edge ? (edge.fromSide as string | undefined) : undefined
    const toSide = 'toSide' in edge ? (edge.toSide as string | undefined) : undefined
    const route = 'route' in edge ? (edge.route as string | undefined) : undefined
    const via = 'via' in edge && Array.isArray(edge.via) ? (edge.via as Point[]) : undefined
    const { start, end } = edgeEndpoints(a.pos, a.size, b.pos, b.size, 2, fromSide, toSide)
    return buildEdgeGeometry({
      kind: arch ? 'architecture' : 'flowchart',
      start,
      end,
      fromPos: a.pos,
      fromSize: a.size,
      toPos: b.pos,
      toSize: b.size,
      route,
      via,
      fromSide,
      toSide,
    }).points
  }

  const startVia = (e: React.PointerEvent, edgeId: string, index: number) => {
    e.stopPropagation()
    e.preventDefault()
    const svg = (e.target as Element).closest('svg')
    if (!svg) return
    const basePoints = edgePolylinePoints(edgeId)
    if (!basePoints) return
    dragRef.current = { kind: 'via', edgeId, index, basePoints }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onSelect({ kind: 'edge', id: edgeId })
  }

  const startViaSeg = (e: React.PointerEvent, edgeId: string, segIndex: number) => {
    e.stopPropagation()
    e.preventDefault()
    const svg = (e.target as Element).closest('svg')
    if (!svg) return
    const basePoints = edgePolylinePoints(edgeId)
    if (!basePoints) return
    dragRef.current = { kind: 'via-seg', edgeId, segIndex, basePoints }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onSelect({ kind: 'edge', id: edgeId })
  }

  const startMove = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    const svg = (e.target as Element).closest('svg')
    if (!svg) return
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    setEditingEdgeId(null)
    setEditingNodeId(null)

    if (linkFrom === 'pick') {
      onSelect(selectOnlyNode(id))
      onLinkPick(id)
      return
    }
    if (linkFrom && linkFrom !== id) {
      onConnect(linkFrom, id)
      return
    }

    if (styleBrushActive && styleBrushKind === 'node' && onStyleBrushApply) {
      onStyleBrushApply(id)
      return
    }

    if (additive) {
      onSelect(toggleNodeInSelection(selection, id))
      return
    }

    const already = isNodeSelected(selection, id)
    const groupIds = already && nodeIdsOf(selection).length > 1 ? nodeIdsOf(selection) : [id]
    if (!already || groupIds.length === 1) onSelect(selectOnlyNode(id))

    const pt = clientToSvg(svg, e.clientX, e.clientY)
    const i = nodes.findIndex((n) => n.id === id)
    const n = nodes[i]
    const pos = ensurePos(n.pos, i)
    const starts = groupIds
      .map((gid) => {
        const gi = nodes.findIndex((x) => x.id === gid)
        if (gi < 0) return null
        return { id: gid, pos: ensurePos(nodes[gi]!.pos, gi) as Point }
      })
      .filter((x): x is { id: string; pos: Point } => Boolean(x))
    dragRef.current = { kind: 'move', id, ox: pt[0] - pos[0], oy: pt[1] - pos[1], starts }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  }

  const startResize = (e: React.PointerEvent, id: string, handle: Handle, pos: Point, size: Size) => {
    e.stopPropagation()
    const svg = (e.target as Element).closest('svg')
    if (!svg) return
    const origin = clientToSvg(svg, e.clientX, e.clientY)
    dragRef.current = { kind: 'resize', id, handle, startPos: pos, startSize: size, origin }
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    onSelect(selectOnlyNode(id))
  }

  return (
    <div className={`canvas-stage${styleBrushActive ? ' format-brush-cursor' : ''}`}>
      <div className="canvas-zoom-bar" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="primary" title="美化布局" onClick={() => onBeautify?.()}>
          美化
        </button>
        <button type="button" title="缩小" onClick={() => zoomAt(zoom / 1.15)}>
          −
        </button>
        <button type="button" title="重置视图" onClick={() => resetView()}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" title="放大" onClick={() => zoomAt(zoom * 1.15)}>
          +
        </button>
        <span className="canvas-zoom-hint">框选/Shift点选 · 滚动条平移 · Ctrl+滚轮缩放 · 空格拖移</span>
      </div>
      <div
        ref={scrollRef}
        className="canvas-scroll"
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1
            zoomAt(zoom * factor, e.clientX, e.clientY)
          }
        }}
      >
        <div className="canvas-world" style={{ width: worldPxW, height: worldPxH }}>
      <svg
      ref={svgRef}
      className={`canvas-svg${showGrid ? '' : ' canvas-svg--no-grid'}${drawTool ? ' canvas-svg--drawing' : ''}`}
      width={worldPxW}
      height={worldPxH}
      viewBox={`${CANVAS_WORLD.x} ${CANVAS_WORLD.y} ${CANVAS_WORLD.w} ${CANVAS_WORLD.h}`}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={() => {
        // 向右/外拉区域框时常移出 SVG；有 capture 的拖拽勿在 leave 时打断
        const d = dragRef.current
        if (
          d &&
          (d.kind === 'boundary-resize' ||
            d.kind === 'resize' ||
            d.kind === 'move' ||
            d.kind === 'boundary' ||
            d.kind === 'lane-resize' ||
            d.kind === 'via' ||
            d.kind === 'via-seg' ||
            d.kind === 'link' ||
            d.kind === 'draw-line' ||
            d.kind === 'draw-boundary' ||
            d.kind === 'line-move' ||
            d.kind === 'line-point')
        ) {
          return
        }
        endDrag()
      }}
      onPointerDown={(e) => {
        if (e.button === 1 || (e.button === 0 && spacePan.current)) {
          e.preventDefault()
          const sc = scrollRef.current
          dragRef.current = {
            kind: 'pan',
            originClient: [e.clientX, e.clientY],
            startScroll: [sc?.scrollLeft ?? 0, sc?.scrollTop ?? 0],
          }
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          return
        }
        if (e.button !== 0) return
        const pt = clientToSvg(e.currentTarget, e.clientX, e.clientY)
        if (drawTool) {
          e.preventDefault()
          if (drawTool === 'boundary') {
            dragRef.current = { kind: 'draw-boundary', origin: pt, current: pt }
          } else {
            dragRef.current = { kind: 'draw-line', route: drawTool, origin: pt, current: pt }
          }
          setDrawPreview({ kind: drawTool === 'boundary' ? 'boundary' : 'line', from: pt, to: pt, route: drawTool === 'boundary' ? undefined : drawTool })
          ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
          return
        }
        const raw = e.target as Element | null
        if (
          raw?.closest?.(
            '.handle, .boundary-edge-hit, .node, .edge, .boundary, .layer-band, .edge-seg-handle, .edge-via-handle, .node-port, .standalone-line',
          )
        ) {
          return
        }
        const additive = e.shiftKey || e.ctrlKey || e.metaKey
        dragRef.current = { kind: 'marquee', origin: pt, current: pt, additive }
        setMarquee(normalizeRect(pt[0], pt[1], pt[0], pt[1]))
        if (!additive) onSelect(null)
        setEditingEdgeId(null)
        setEditingNodeId(null)
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      }}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes(PALETTE_MIME)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        e.preventDefault()
        const payload = decodePaletteDrag(e.dataTransfer.getData(PALETTE_MIME))
        if (!payload || !onDropPalette) return
        const pt = clientToSvg(e.currentTarget, e.clientX, e.clientY)
        onDropPalette(payload, [Math.round(pt[0]), Math.round(pt[1])])
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, { kind: 'canvas' })
      }}
    >
      <defs>
        {edges.map((edge) => {
          const ls = resolveLineStyle(
            edge.style,
            'variant' in edge && edge.variant === 'emphasis',
            theme,
          )
          const fill = layerEdgeViolationIds?.has(edge.id) ? '#f59e0b' : ls.stroke
          const endId = markerId(edge.id, 'end')
          const startId = markerId(edge.id, 'start')
          return (
            <g key={`m-${edge.id}`}>
              <marker
                id={endId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="10"
                markerHeight="10"
                markerUnits="userSpaceOnUse"
                orient="auto"
                overflow="visible"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={fill} />
              </marker>
              <marker
                id={startId}
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="10"
                markerHeight="10"
                markerUnits="userSpaceOnUse"
                orient="auto"
                overflow="visible"
              >
                <path d="M 10 0 L 0 5 L 10 10 z" fill={fill} />
              </marker>
            </g>
          )
        })}
      {lines.map((line) => {
        const ls = resolveLineStyle(line.style, false, theme)
        return (
          <g key={`line-m-${line.id}`}>
            <marker id={markerId(line.id, 'end')} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto" overflow="visible">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={ls.stroke} />
            </marker>
            <marker id={markerId(line.id, 'start')} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto" overflow="visible">
              <path d="M 10 0 L 0 5 L 10 10 z" fill={ls.stroke} />
            </marker>
          </g>
        )
      })}
      </defs>

      {layered
        ? layers.map((layer, i) => {
            const b = layerBand(layers, i, laneWidth, laneOrientation)
            const labelX =
              laneOrientation === 'vertical' ? b.x + b.w / 2 : b.x + 12
            const labelAnchor = laneOrientation === 'vertical' ? 'middle' : 'start'
            const laneSelected = isLaneSelected(selection, layer.id)
            return (
              <g
                key={layer.id}
                className={`layer-band${laneOrientation === 'vertical' ? ' vertical' : ''}${laneSelected ? ' selected' : ''}`}
              >
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={10}
                  fill={layer.style?.fill ?? LANE_THEME[theme].fill}
                  stroke={
                    laneSelected
                      ? '#2dd4bf'
                      : (layer.style?.stroke ?? LANE_THEME[theme].stroke)
                  }
                  strokeWidth={laneSelected ? 2.4 : laneOrientation === 'vertical' ? 1.6 : 1}
                  strokeDasharray={
                    layer.style?.strokeDasharray !== undefined
                      ? svgStrokeDasharray(layer.style.strokeDasharray)
                      : laneOrientation === 'vertical'
                        ? '6 4'
                        : undefined
                  }
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                      onSelect(toggleLaneInSelection(selection, layer.id))
                    } else {
                      onSelect(selectLanes([layer.id]))
                    }
                  }}
                />
                <text
                  x={labelX}
                  y={b.y + 22}
                  textAnchor={labelAnchor}
                  fill={layer.style?.stroke ?? LANE_THEME[theme].text}
                  fontSize={13}
                  fontWeight={600}
                  style={{ pointerEvents: 'none' }}
                >
                  {layer.label}
                </text>
                {(
                  [
                    { edge: 's' as const, x: b.x, y: b.y + b.h - 5, w: b.w, h: 10, cursor: 'ns-resize' },
                    { edge: 'n' as const, x: b.x, y: b.y - 5, w: b.w, h: 10, cursor: 'ns-resize' },
                    { edge: 'e' as const, x: b.x + b.w - 5, y: b.y, w: 10, h: b.h, cursor: 'ew-resize' },
                    { edge: 'w' as const, x: b.x - 5, y: b.y, w: 10, h: b.h, cursor: 'ew-resize' },
                  ] as const
                ).map((h) => (
                  <rect
                    key={h.edge}
                    className={`lane-handle lane-handle-${h.edge}`}
                    x={h.x}
                    y={h.y}
                    width={h.w}
                    height={h.h}
                    fill="transparent"
                    style={{ cursor: h.cursor }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const svg = (e.target as Element).closest('svg')
                      if (!svg) return
                      const origin = clientToSvg(svg, e.clientX, e.clientY)
                      const selected = laneIdsOf(selection)
                      const applyIds =
                        selected.includes(layer.id) && selected.length > 1
                          ? selected
                          : [layer.id]
                      if (!selected.includes(layer.id)) onSelect(selectLanes([layer.id]))
                      dragRef.current = {
                        kind: 'lane-resize',
                        layerId: layer.id,
                        applyIds,
                        edge: h.edge,
                        startH: b.h,
                        startW: b.w,
                        origin,
                      }
                      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                    }}
                  />
                ))}
              </g>
            )
          })
        : null}

      {/* free：全部 boundaries；layered：层带已表达层框，仍须画外层/非层标签 wraps 框 */}
      {(() => {
        const layerLabels = new Set(layers.map((l) => l.label))
        const boxes = nodes.map((c, idx) => ({
          id: c.id,
          pos: ensurePos(c.pos, idx),
          size: ensureSize(c.size),
        }))
        const pads = resolveBoundaryPads(boundaries, boxes)
        // 先画外层（面积大 / nestDepth 小），内层叠上
        const drawOrder = boundaries
          .map((b, i) => {
            const r = boundaryRectFor(b, boxes, pads[i])
            const area = r ? r.w * r.h : 0
            return { b, i, ...pads[i], n: b.wraps.length, area, r }
          })
          .filter(({ b }) => !(layered && layerLabels.has(b.label)))
          .sort((a, c) => c.area - a.area || c.n - a.n || a.nestDepth - c.nestDepth || a.i - c.i)
        return drawOrder.map(({ b, i, nestDepth, r }) => {
          if (!r) return null
          const selected = isBoundarySelected(selection, i)
          const nestClass = `nest-${Math.min(nestDepth, 4)}`
          const kindClass = `boundary-kind-${(b.kind || 'region').replace(/[^a-z0-9_-]/gi, '-')}`
          const bst = getBoundaryStyle(diagram, b.label, theme)
          const fontSize = bst.fontSize ?? 12
          const labelText = b.label || '区域框'
          const explicitRect = b.pos && b.size ? { pos: b.pos, size: b.size } : undefined
          const wrapStarts = b.wraps
            .map((id) => {
              const idx = nodes.findIndex((n) => n.id === id)
              if (idx < 0) return null
              return { id, pos: ensurePos(nodes[idx]!.pos, idx) as Point }
            })
            .filter((x): x is { id: string; pos: Point } => Boolean(x))
          return (
            <g
              key={`${b.label}-${i}`}
              data-boundary-index={i}
              className={`boundary ${nestClass} ${kindClass} ${selected ? 'selected' : ''}`}
              style={{ cursor: 'move' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                const svg = (e.target as Element).closest('svg')
                if (!svg) return
                const origin = clientToSvg(svg, e.clientX, e.clientY)
                dragRef.current = { kind: 'boundary', index: i, origin, starts: wrapStarts, rect: explicitRect }
                ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                onSelect(selectOnlyBoundary(i))
                setEditingEdgeId(null)
                setEditingNodeId(null)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSelect(selectOnlyBoundary(i))
                onContextMenu(e, { kind: 'boundary', index: i })
              }}
            >
              <rect
                className="boundary-rect"
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={12}
                fill={bst.fill}
                stroke={bst.stroke}
                strokeWidth={bst.strokeWidth ?? 1.5}
                strokeDasharray={
                  bst.strokeDasharray !== undefined
                    ? svgStrokeDasharray(bst.strokeDasharray)
                    : b.kind === 'security-group'
                      ? '3 3'
                      : '6 4'
                }
              />
              <text
                x={r.x + 12}
                y={r.y + 4 + fontSize}
                fill={bst.text}
                style={{
                  fontSize: `${fontSize}px`,
                  fontWeight: bst.fontWeight === 'bold' ? 700 : undefined,
                  fontStyle: bst.fontStyle === 'italic' ? 'italic' : undefined,
                }}
              >
                {labelText}
              </text>
            </g>
          )
        })
      })()}

            {/* 独立直线 / 折线：不接节点，直接放在画布指定位置 */}
      {lines.map((line) => {
        const pts = linePoints(line)
        if (pts.length < 2) return null
        const selected =
          (selection?.kind === 'line' && selection.id === line.id) ||
          (selection?.kind === 'all' && Boolean(selection.lineIds?.includes(line.id)))
        const ls = resolveLineStyle(line.style, false, theme)
        const showEnd = ls.arrow === 'end' || ls.arrow === 'both'
        const showStart = ls.arrow === 'start' || ls.arrow === 'both'
        const d =
          line.route === 'curve'
            ? curvePath(pts[0]!, pts[pts.length - 1]!)
            : pointsToPath(pts)
        return (
          <g
            key={line.id}
            data-line-id={line.id}
            className={`standalone-line ${selected ? 'selected' : ''}`}
            onPointerDown={(e) => {
              e.stopPropagation()
              const svg = (e.target as Element).closest('svg')
              if (!svg) return
              const origin = clientToSvg(svg, e.clientX, e.clientY)
              dragRef.current = { kind: 'line-move', id: line.id, origin, basePoints: pts }
              ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              onSelect({ kind: 'line', id: line.id })
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect({ kind: 'line', id: line.id })
              onContextMenu(e, { kind: 'line', id: line.id })
            }}
          >
            <path className="edge-hit" d={d} stroke="transparent" strokeWidth={14} fill="none" />
            <path
              className="edge-line"
              d={d}
              stroke={ls.stroke}
              strokeWidth={ls.strokeWidth}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={svgStrokeDasharray(ls.strokeDasharray)}
              markerEnd={showEnd ? `url(#${markerId(line.id, 'end')})` : undefined}
              markerStart={showStart ? `url(#${markerId(line.id, 'start')})` : undefined}
            />
          </g>
        )
      })}

{edges.map((edge) => {
        const fi = nodes.findIndex((n) => n.id === edge.from)
        const ti = nodes.findIndex((n) => n.id === edge.to)
        if (fi < 0 || ti < 0) return null
        const a = nodeBox(edge.from, fi)!
        const b = nodeBox(edge.to, ti)!
        const fromSide = 'fromSide' in edge ? (edge.fromSide as string | undefined) : undefined
        const toSide = 'toSide' in edge ? (edge.toSide as string | undefined) : undefined
        const via = 'via' in edge && Array.isArray(edge.via) ? (edge.via as Point[]) : undefined
        const { start, end } = edgeEndpoints(a.pos, a.size, b.pos, b.size, 2, fromSide, toSide)
        const route = 'route' in edge ? edge.route : undefined
        const geom = buildEdgeGeometry({
          route,
          kind: arch ? 'architecture' : 'flowchart',
          start,
          end,
          fromPos: a.pos,
          fromSize: a.size,
          toPos: b.pos,
          toSize: b.size,
          via,
          fromSide,
          toSide,
        })
        const mid = geom.labelAt
        const labelOff: Point =
          'labelOffset' in edge && Array.isArray(edge.labelOffset)
            ? (edge.labelOffset as Point)
            : [0, 0]
        const labelAt: Point = [mid[0] + labelOff[0], mid[1] + labelOff[1]]
        const selected = selection?.kind === 'edge' && selection.id === edge.id
        const layerViolation = Boolean(layerEdgeViolationIds?.has(edge.id))
        const ls = resolveLineStyle(
          edge.style,
          'variant' in edge && edge.variant === 'emphasis',
          theme,
        )
        const stroke = layerViolation ? '#f59e0b' : ls.stroke
        const showEnd = ls.arrow === 'end' || ls.arrow === 'both'
        const showStart = ls.arrow === 'start' || ls.arrow === 'both'
        const editing = editingEdgeId === edge.id
        const label = edge.label ?? ''
        const labelFillRaw = ls.labelFill ?? edge.style?.labelFill
        const labelHasFill = Boolean(labelFillRaw && !isNoneFill(labelFillRaw))
        const labelBoxW = Math.max(28, (label || '标签').length * 6 + 10)
        return (
          <g
            key={edge.id}
            className={`edge ${selected ? 'selected' : ''}${layerViolation ? ' layer-violation' : ''}`}
            data-layer-violation={layerViolation ? '1' : undefined}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (styleBrushActive && styleBrushKind === 'edge' && onStyleBrushApplyEdge) {
                onStyleBrushApplyEdge(edge.id)
                return
              }
              onSelect({ kind: 'edge', id: edge.id })
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onSelect({ kind: 'edge', id: edge.id })
              setEditingEdgeId(edge.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect({ kind: 'edge', id: edge.id })
              onContextMenu(e, { kind: 'edge', id: edge.id })
            }}
          >
            <path className="edge-hit" d={geom.d} stroke="transparent" strokeWidth={14} fill="none" />
            <path
              className="edge-line"
              d={geom.d}
              stroke={stroke}
              strokeWidth={layerViolation ? Math.max(ls.strokeWidth, 2.2) : ls.strokeWidth}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={
                layerViolation
                  ? '6 4'
                  : svgStrokeDasharray(ls.strokeDasharray)
              }
              markerEnd={showEnd ? `url(#${markerId(edge.id, 'end')})` : undefined}
              markerStart={showStart ? `url(#${markerId(edge.id, 'start')})` : undefined}
            />
            {layerViolation ? (
              <title>跨层规则：自下而上依赖（仅提示）</title>
            ) : null}
            {editing ? (
              <foreignObject x={labelAt[0] - 70} y={labelAt[1] - 14} width={140} height={28}>
                <input
                  ref={labelInputRef}
                  className="edge-label-input"
                  value={label}
                  placeholder="输入标签"
                  onChange={(e) => onEdgeLabel(edge.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      e.preventDefault()
                      setEditingEdgeId(null)
                    }
                  }}
                  onBlur={() => setEditingEdgeId(null)}
                />
              </foreignObject>
            ) : label || selected ? (
              <g
                className="edge-label"
                style={{ cursor: selected ? 'move' : undefined }}
                onPointerDown={(e) => {
                  if (!selected || !onEdgeLabelOffset) return
                  e.stopPropagation()
                  const svg = (e.target as Element).closest('svg')
                  if (!svg) return
                  const origin = clientToSvg(svg, e.clientX, e.clientY)
                  dragRef.current = {
                    kind: 'label-offset',
                    edgeId: edge.id,
                    origin,
                    startOffset: labelOff,
                  }
                  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                }}
              >
                <rect
                  className="edge-label-bg"
                  x={labelAt[0] - labelBoxW / 2}
                  y={labelAt[1] - 12}
                  width={labelBoxW}
                  height={18}
                  rx={4}
                  fill={labelHasFill ? String(labelFillRaw).trim() : 'none'}
                  stroke={selected ? '#2dd4bf' : 'none'}
                  strokeWidth={selected ? 1 : 0}
                />
                <text
                  x={labelAt[0]}
                  y={labelAt[1] + 2}
                  textAnchor="middle"
                  fill={label ? ls.stroke : '#8b9aab'}
                >
                  {label || '双击编辑'}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}

      {nodes.map((node, i) => {
        const pos = ensurePos(node.pos, i)
        const size = ensureSize(node.size)
        const selected = isNodeSelected(selection, node.id)
        const sole = selected && nodeIdsOf(selection).length === 1
        const editing = editingNodeId === node.id
        // 编辑框高度随换行行数增长，敲回车换行后仍可完整看到并编辑每一行
        const editLines = Math.max(1, node.label.replace(/\r\n/g, '\n').split('\n').length)
        const editHeight = Math.max(56, editLines * 20 + 12)
        const archNode = arch ? (node as ArchifyComponent) : null
        const key = archNode ? (archNode.shape ?? archNode.type) : (node as FlowchartNode).shape
        const st = resolveNodeStyle(
          archNode && !archNode.shape ? 'architecture' : 'flowchart',
          key,
          node.style,
          theme,
        )
        return (
          <g
            key={node.id}
            className={`node ${selected ? 'selected' : ''}`}
            transform={`translate(${pos[0]}, ${pos[1]})`}
            onPointerDown={(e) => startMove(e, node.id)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onSelect(selectOnlyNode(node.id))
              setEditingNodeId(node.id)
              setEditingEdgeId(null)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isNodeSelected(selection, node.id)) onSelect(selectOnlyNode(node.id))
              onContextMenu(e, { kind: 'node', id: node.id })
            }}
          >
            <NodeShape
              flowchart={!arch}
              node={node}
              w={size[0]}
              h={size[1]}
              fill={st.fill}
              stroke={st.stroke}
              strokeWidth={st.strokeWidth}
              text={st.text}
              fontSize={st.fontSize}
              subFontSize={st.subFontSize}
              fontWeight={st.fontWeight}
              fontStyle={st.fontStyle}
              strokeDasharray={svgStrokeDasharray(st.strokeDasharray)}
              textHAlign={st.textHAlign}
              textVAlign={st.textVAlign}
              hideLabel={editing}
            />
            {editing ? (
              <foreignObject x={8} y={Math.max(4, size[1] / 2 - editHeight / 2)} width={Math.max(40, size[0] - 16)} height={editHeight}>
                <textarea
                  ref={nodeLabelInputRef}
                  className="edge-label-input node-label-input"
                  value={node.label}
                  onChange={(e) => onNodeLabel(node.id, e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                      e.preventDefault()
                      setEditingNodeId(null)
                    }
                  }}
                  onBlur={() => setEditingNodeId(null)}
                />
              </foreignObject>
            ) : null}
            {sole && !editing
              ? HANDLES.map((h) => {
                  const [hx, hy] = handlePos(size, h)
                  return (
                    <rect
                      key={h}
                      className="handle"
                      x={hx - 4}
                      y={hy - 4}
                      width={8}
                      height={8}
                      style={{ cursor: handleCursor(h) }}
                      onPointerDown={(e) => startResize(e, node.id, h, pos, size)}
                    />
                  )
                })
              : null}
            {selected && !editing
              ? (['n', 's', 'e', 'w'] as const).map((side) => {
                // 连线端口外移，避免盖住同一边中点的缩放手柄。
                const portGap = 9
                  const local =
                    side === 'n'
                      ? [size[0] / 2, -portGap]
                      : side === 's'
                        ? [size[0] / 2, size[1] + portGap]
                        : side === 'e'
                          ? [size[0] + portGap, size[1] / 2]
                          : [-portGap, size[1] / 2]
                  return (
                    <circle
                      key={`port-${side}`}
                      className="node-port"
                      cx={local[0]}
                      cy={local[1]}
                      r={5}
                      onPointerDown={(e) => startLink(e, node.id, side)}
                    />
                  )
                })
              : null}
            {/* 拖线经过目标框：每边 3 个候选光点，最近点高亮（亿图式吸附提示） */}
            {linkHover && linkHover.nodeId === node.id && !editing
              ? linkHover.anchors.map((anchor, i) => {
                  const isNearest = i === linkHover.nearestIndex
                  return (
                    <circle
                      key={`snap-${i}`}
                      className={`snap-anchor${isNearest ? ' nearest' : ''}`}
                      cx={anchor.point[0] - pos[0]}
                      cy={anchor.point[1] - pos[1]}
                      r={isNearest ? 5.5 : 3.5}
                      pointerEvents="none"
                    />
                  )
                })
              : null}
          </g>
        )
      })}

      {/* 区域框缩放手柄叠在节点之上，否则贴边角点会被组件挡住无法拖 */}
      {selection?.kind === 'boundary' && selection.indexes.length === 1
        ? (() => {
            const i = selection.indexes[0]!
            const b = boundaries[i]
            if (!b) return null
            const layerLabels = new Set(layers.map((l) => l.label))
            if (layered && layerLabels.has(b.label)) return null
            const boxes = nodes.map((c, idx) => ({
              id: c.id,
              pos: ensurePos(c.pos, idx),
              size: ensureSize(c.size),
            }))
            const pads = resolveBoundaryPads(boundaries, boxes)
            const pad = pads[i]
            const r = boundaryRectFor(b, boxes, pad)
            if (!r || !pad) return null
            const explicitRect = b.pos && b.size ? { pos: b.pos, size: b.size } : undefined
            const startPadDrag = (e: ReactPointerEvent, h: Handle) => {
              e.preventDefault()
              e.stopPropagation()
              const svg = (e.target as Element).closest('svg')
              if (!svg) return
              const origin = clientToSvg(svg, e.clientX, e.clientY)
              dragRef.current = {
                kind: 'boundary-resize',
                index: i,
                handle: h,
                startPadLeft: pad.padLeft,
                startPadRight: pad.padRight,
                startPadTop: pad.padTop,
                startPadBottom: pad.padBottom,
                origin,
                rect: explicitRect,
              }
              ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
              onSelect(selectOnlyBoundary(i))
            }
            const IN = 8
            const OUT = 12
            const CORNER_GAP = 14
            const edgeHits: Array<{ h: Handle; x: number; y: number; w: number; hgt: number; cursor: string }> = [
              { h: 'e', x: r.x + r.w - IN, y: r.y + CORNER_GAP, w: IN + OUT, hgt: Math.max(0, r.h - CORNER_GAP * 2), cursor: 'ew-resize' },
              { h: 'w', x: r.x - OUT, y: r.y + CORNER_GAP, w: IN + OUT, hgt: Math.max(0, r.h - CORNER_GAP * 2), cursor: 'ew-resize' },
              { h: 's', x: r.x + CORNER_GAP, y: r.y + r.h - IN, w: Math.max(0, r.w - CORNER_GAP * 2), hgt: IN + OUT, cursor: 'ns-resize' },
              { h: 'n', x: r.x + CORNER_GAP, y: r.y - OUT, w: Math.max(0, r.w - CORNER_GAP * 2), hgt: IN + OUT, cursor: 'ns-resize' },
            ]
            const midHandles: Handle[] = ['n', 'e', 's', 'w']
            const cornerHandles: Handle[] = ['nw', 'ne', 'sw', 'se']
            return (
              <g key={`boundary-handles-${i}`} className="boundary-handles-overlay">
                {edgeHits.map((hit) =>
                  hit.w > 0 && hit.hgt > 0 ? (
                    <rect
                      key={`edge-${hit.h}`}
                      className="boundary-edge-hit"
                      x={hit.x}
                      y={hit.y}
                      width={hit.w}
                      height={hit.hgt}
                      fill="var(--accent)"
                      fillOpacity={0.12}
                      pointerEvents="all"
                      style={{ cursor: hit.cursor }}
                      onPointerDown={(e) => startPadDrag(e, hit.h)}
                    />
                  ) : null,
                )}
                {midHandles.map((h) => {
                  const [hx, hy] = handlePos([r.w, r.h], h)
                  const ox = h === 'e' ? OUT / 2 : h === 'w' ? -OUT / 2 : 0
                  const oy = h === 's' ? OUT / 2 : h === 'n' ? -OUT / 2 : 0
                  return (
                    <rect
                      key={`mid-${h}`}
                      className="handle"
                      x={r.x + hx - 5 + ox}
                      y={r.y + hy - 5 + oy}
                      width={10}
                      height={10}
                      pointerEvents="all"
                      style={{ cursor: handleCursor(h) }}
                      onPointerDown={(e) => startPadDrag(e, h)}
                    />
                  )
                })}
                {cornerHandles.map((h) => {
                  const [hx, hy] = handlePos([r.w, r.h], h)
                  const ox = h.includes('e') ? 4 : h.includes('w') ? -4 : 0
                  const oy = h.includes('s') ? 4 : h.includes('n') ? -4 : 0
                  return (
                    <rect
                      key={h}
                      className="handle"
                      x={r.x + hx - 5 + ox}
                      y={r.y + hy - 5 + oy}
                      width={10}
                      height={10}
                      pointerEvents="all"
                      style={{ cursor: handleCursor(h) }}
                      onPointerDown={(e) => startPadDrag(e, h)}
                    />
                  )
                })}
              </g>
            )
          })()
        : null}

      {/* 独立线端点 / 拐点手柄 */}
      {selection?.kind === 'line'
        ? (() => {
            const line = lines.find((l) => l.id === selection.id)
            if (!line) return null
            const pts = linePoints(line)
            return (
              <g className="line-handles-overlay">
                {pts.map((p, index) => (
                  <circle
                    key={`lp-${index}`}
                    className={`line-point-handle${index === 0 || index === pts.length - 1 ? ' endpoint' : ''}`}
                    cx={p[0]}
                    cy={p[1]}
                    r={6}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      dragRef.current = { kind: 'line-point', id: line.id, index, basePoints: pts }
                      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
                    }}
                  />
                ))}
              </g>
            )
          })()
        : null}

      {/* 折线手柄叠在节点之上，否则列内竖段中点会被节点挡住无法拖拽 */}
      {selection?.kind === 'edge'
        ? (() => {
            const edge = edges.find((ed) => ed.id === selection.id)
            if (!edge) return null
            const fi = nodes.findIndex((n) => n.id === edge.from)
            const ti = nodes.findIndex((n) => n.id === edge.to)
            if (fi < 0 || ti < 0) return null
            const a = nodeBox(edge.from, fi)!
            const b = nodeBox(edge.to, ti)!
            const fromSide = 'fromSide' in edge ? (edge.fromSide as string | undefined) : undefined
            const toSide = 'toSide' in edge ? (edge.toSide as string | undefined) : undefined
            const via = 'via' in edge && Array.isArray(edge.via) ? (edge.via as Point[]) : undefined
            const route = 'route' in edge ? edge.route : undefined
            if (route === 'straight' || route === 'curve') return null
            const { start, end } = edgeEndpoints(a.pos, a.size, b.pos, b.size, 2, fromSide, toSide)
            const geom = buildEdgeGeometry({
              route,
              kind: arch ? 'architecture' : 'flowchart',
              start,
              end,
              fromPos: a.pos,
              fromSize: a.size,
              toPos: b.pos,
              toSize: b.size,
              via,
              fromSide,
              toSide,
            })
            const bendPts = geom.points.length > 2 ? geom.points.slice(1, -1) : []
            const segHandles = listOrthoSegmentHandles(geom.points)
            return (
              <g key={`edge-handles-${edge.id}`} className="edge-handles-overlay">
                {segHandles.map((h) => (
                  <rect
                    key={`seg-${h.segIndex}`}
                    className={`edge-seg-handle axis-${h.axis}`}
                    x={h.mid[0] - 5}
                    y={h.mid[1] - 5}
                    width={10}
                    height={10}
                    rx={1.5}
                    onPointerDown={(e) => startViaSeg(e, edge.id, h.segIndex)}
                  />
                ))}
                {bendPts.map((p, bi) => (
                  <circle
                    key={`via-${bi}`}
                    className="edge-via-handle"
                    cx={p[0]}
                    cy={p[1]}
                    r={6}
                    onPointerDown={(e) => startVia(e, edge.id, bi)}
                  />
                ))}
              </g>
            )
          })()
        : null}

      {drawPreview
        ? drawPreview.kind === 'boundary'
          ? (() => {
              const r = normalizeRect(drawPreview.from[0], drawPreview.from[1], drawPreview.to[0], drawPreview.to[1])
              return (
                <rect
                  className="draw-preview"
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  rx={12}
                  fill="rgba(45, 212, 191, 0.1)"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              )
            })()
          : (() => {
              const d =
                drawPreview.route === 'ortho'
                  ? pointsToPath(orthoPoints(drawPreview.from, drawPreview.to))
                  : drawPreview.route === 'curve'
                    ? curvePath(drawPreview.from, drawPreview.to)
                    : pointsToPath([drawPreview.from, drawPreview.to])
              return (
                <path
                  className="draw-preview"
                  d={d}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  pointerEvents="none"
                />
              )
            })()
        : null}

      {linkPreview ? (
        <path
          className="link-preview"
          d={`M ${linkPreview.from[0]} ${linkPreview.from[1]} L ${linkPreview.to[0]} ${linkPreview.to[1]}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      ) : null}

      {alignGuides.map((g, i) =>
        g.axis === 'v' ? (
          <line
            key={`guide-v-${i}-${g.at}`}
            className="align-guide"
            x1={g.at}
            y1={CANVAS_WORLD.y}
            x2={g.at}
            y2={CANVAS_WORLD.y + CANVAS_WORLD.h}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ) : (
          <line
            key={`guide-h-${i}-${g.at}`}
            className="align-guide"
            x1={CANVAS_WORLD.x}
            y1={g.at}
            x2={CANVAS_WORLD.x + CANVAS_WORLD.w}
            y2={g.at}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ),
      )}

      {marquee && marquee.w + marquee.h > 0 ? (
        <rect
          className="selection-marquee"
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill="rgba(45, 212, 191, 0.12)"
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="4 3"
          pointerEvents="none"
        />
      ) : null}
    </svg>
        </div>
      </div>
    </div>
  )
}

function MultilineNodeLabel({
  label,
  extraSub,
  w,
  h,
  text,
  fontSize,
  subSize,
  textStyle,
  subStyle,
  textHAlign,
  textVAlign,
}: {
  label: string
  extraSub?: string
  w: number
  h: number
  text: string
  fontSize: number
  subSize: number
  textStyle: CSSProperties
  subStyle: CSSProperties
  textHAlign?: TextHAlign
  textVAlign?: TextVAlign
}) {
  // 标题与副标题各自按框宽自动折行，实现亿图式「长文字在框内换行」效果
  // 与 fitSizeToLabel 共用同一套行布局，保证「渲染」与「框高自适应」完全一致
  const { titleLines, subLines, titleLineHeight, subLineHeight, totalHeight } =
    nodeLabelLineLayout(label, extraSub, w, fontSize, subSize)
  const { x, textAnchor, top } = labelTextBlockPlacement(
    textHAlign,
    textVAlign,
    w,
    h,
    totalHeight,
  )
  const firstTitleY = top + fontSize
  const firstSubY = firstTitleY + (titleLines.length - 1) * titleLineHeight + subLineHeight
  return (
    <>
      {titleLines.map((line, index) => (
        <text
          key={`title-${index}-${line}`}
          className="title"
          x={x}
          y={firstTitleY + index * titleLineHeight}
          textAnchor={textAnchor}
          fill={text}
          style={textStyle}
        >
          {line}
        </text>
      ))}
      {subLines.map((line, index) => (
        <text
          key={`sub-${index}-${line}`}
          className="sub"
          x={x}
          y={firstSubY + index * subLineHeight}
          textAnchor={textAnchor}
          fill={text}
          opacity={0.7}
          style={subStyle}
        >
          {line}
        </text>
      ))}
    </>
  )
}

function NodeShape({
  flowchart,
  node,
  w,
  h,
  fill,
  stroke,
  strokeWidth,
  text,
  fontSize = 13,
  subFontSize,
  fontWeight,
  fontStyle,
  strokeDasharray,
  textHAlign,
  textVAlign,
  hideLabel = false,
}: {
  flowchart: boolean
  node: ArchifyComponent | FlowchartNode
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth: number
  text: string
  fontSize?: number
  subFontSize?: number
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  strokeDasharray?: string
  textHAlign?: TextHAlign
  textVAlign?: TextVAlign
  hideLabel?: boolean
}) {
  const subSize = resolveSubFontSize(fontSize, subFontSize)
  const textStyle: CSSProperties = {
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight === 'bold' ? 700 : fontWeight === 'normal' ? 400 : 600,
    fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
  }
  const subStyle: CSSProperties = {
    fontSize: `${subSize}px`,
    fontWeight: fontWeight === 'bold' ? 700 : fontWeight === 'normal' ? 400 : 600,
    fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
  }
  if (!flowchart) {
    const n = node as ArchifyComponent
    // tag（如「SSF 框架」）仅留在 IR / finalize HTML，编辑态画布不画角标
    if (n.shape) {
      return (
        <>
          <FlowShapeGeom
            shape={n.shape}
            w={w}
            h={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
          {!hideLabel ? (
            <MultilineNodeLabel
              label={n.label}
              extraSub={n.sublabel}
              w={w}
              h={h}
              text={text}
              fontSize={fontSize}
              subSize={subSize}
              textStyle={textStyle}
              subStyle={subStyle}
              textHAlign={textHAlign}
              textVAlign={textVAlign}
            />
          ) : null}
        </>
      )
    }
    return (
      <>
        <rect
          className="box"
          width={w}
          height={h}
          rx={10}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
        />
        {!hideLabel ? (
          <>
            <text
              className="title"
              x={textHAlign === 'right' ? w - 12 : textHAlign === 'left' ? 12 : w / 2}
              y={textVAlign === 'top' ? 8 + fontSize : textVAlign === 'bottom' ? h - 8 : h / 2 + fontSize / 3}
              textAnchor={textHAlign === 'left' ? 'start' : textHAlign === 'right' ? 'end' : 'middle'}
              fill={text}
              style={textStyle}
            >
              {n.label}
            </text>
            {n.sublabel ? (
              <text
                className="sub"
                x={textHAlign === 'right' ? w - 12 : textHAlign === 'left' ? 12 : w / 2}
                y={
                  textVAlign === 'top'
                    ? 12 + fontSize + subSize
                    : textVAlign === 'bottom'
                      ? h - 8 - subSize / 3
                      : h / 2 + fontSize / 3 + Math.max(subSize * 1.35, 12)
                }
                textAnchor={textHAlign === 'left' ? 'start' : textHAlign === 'right' ? 'end' : 'middle'}
                fill={text}
                opacity={0.7}
                style={subStyle}
              >
                {n.sublabel}
              </text>
            ) : null}
          </>
        ) : null}
      </>
    )
  }
  const n = node as FlowchartNode
  const label = hideLabel ? null : (
    <MultilineNodeLabel
      label={n.label}
      w={w}
      h={h}
      text={text}
      fontSize={fontSize}
      subSize={subSize}
      textStyle={textStyle}
      subStyle={subStyle}
      textHAlign={textHAlign}
      textVAlign={textVAlign}
    />
  )
  return (
    <>
      <FlowShapeGeom
        shape={n.shape}
        w={w}
        h={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
      {label}
    </>
  )
}
