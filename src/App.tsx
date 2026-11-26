import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnyDiagram,
  ArchifyComponent,
  ArchifyConnection,
  ArchifyDiagram,
  ArchifyBoundary,
  ComponentType,
  FlowShape,
  FlowchartEdge,
  BoxStyle,
  FlowchartNode,
  LaneOrientation,
  LineStyle,
  Point,
  Size,
  StandaloneLine,
} from './types'
import {
  getBoundaryStyle,
  paintBoundaries,
  paintLanes,
  renameBoundaryStyle,
  setBoundaryStyle,
} from './domain/boundaryStyle'
import {
  architectureMode,
  assignComponentLayer,
  defaultArchNode,
  defaultArchShapeNode,
  defaultFlowNode,
  emptyArchitecture,
  emptyFlowchart,
  ensurePos,
  batchResizeNodes,
  ensureSize,
  filenameFor,
  isArchitecture,
  isFlowchart,
  layerBand,
  nextId,
  resolveLaneOrientation,
  resolveLaneWidth,
  sortedLayers,
  stripForFinalize,
  syncBoundaries,
} from './domain/document'
import { alignNodes, distributeNodes, type AlignAxis } from './domain/align'
import { AlignMenu } from './ui/AlignMenu'
import { bindColorTag, colorTagsOf, createColorTag, paintNodes, upsertColorTag } from './domain/colorTags'
import { labelForNewDecisionEdge } from './domain/decisionEdge'
import { hasOwnGeometry, layoutMissingPositions, mergeImportedGeometry, pinnedPositionIds } from './domain/layout'
import { beautifyImported, beautifyDiagram } from './domain/beautify'
import {
  movableIdsForSelection,
  nudgeMovesForIds,
  translateViasForUniformMoves,
} from './domain/nudge'
import {
  boundaryIndexesOf,
  laneIdsOf,
  nodeIdsOf,
  primaryBoundaryIndex,
  primaryNodeId,
  selectAllOnCanvas,
  selectNodes,
  selectOnlyNode,
} from './domain/selection'
import { importDrawioDocument } from './import/drawio'
import { openTypedDocument } from './import/openTyped'
import { clampSize } from './domain/geom'
import { fitSizeToLabel } from './domain/textWrap'
import {
  DEFAULT_NODE_FONT_SIZE,
  mergeStyle,
  paintEdges,
  resolveLineStyle,
  resolveNodeStyle,
  resolveSubFontSize,
  snapshotBoxStyle,
  snapshotLineStyle,
} from './domain/style'
import { addCard, removeCard, updateCard } from './domain/cards'
import { translateLinePoints } from './domain/standaloneLine'
import { orthoPoints } from './domain/edgeRoute'
import {
  layerEdgeViolations,
  resolveLayerEdgeRule,
  setLayerEdgeRule,
} from './domain/layerRules'
import { defaultVerticalLane, reorientFlowchartSwimlanes } from './domain/verticalSwimlane'
import { sampleArchitecture, sampleFlowchart, sampleLayered } from './samples'
import { exportCanvasImage, exportCanvasSvg, type RasterFormat } from './export/canvasSnapshot'
import { finalizeCommandTemplate, finalizeHtml } from './export/download'
import { SaveAsDialog, type SaveAsRequest } from './ui/SaveAsDialog'
import { diagramToDrawio } from './import/drawio'
import { diagramToMermaid } from './export/mermaid'
import { prepareWorkflowFinalizePayload } from './export/workflowFinalize'
import { IMPORT_FORMATS, exportFormatsFor, type ExportFormatId, type ImportFormatId } from './io/formats'
import { Canvas, type ContextTarget, type Selection } from './ui/Canvas'
import {
  ContextMenu,
  selectionFromTarget,
  type ContextAction,
  type ContextMenuState,
  type StyleSnapshot,
  type ThemeMode,
} from './ui/ContextMenu'
import { ArchCards } from './ui/ArchCards'
import { FormatMenu } from './ui/FormatMenu'
import { Inspector } from './ui/Inspector'
import { Palette } from './ui/Palette'

type ClipboardPayload =
  | { kind: 'nodes'; flowchart: true; nodes: FlowchartNode[] }
  | { kind: 'nodes'; flowchart: false; nodes: ArchifyComponent[] }

function readTheme(): ThemeMode {
  const saved = localStorage.getItem('archify-editor-theme')
  return saved === 'light' ? 'light' : 'dark'
}

function readShowGrid(): boolean {
  const saved = localStorage.getItem('archify-editor-show-grid')
  return saved !== '0'
}

function readSnapToGrid(): boolean {
  const saved = localStorage.getItem('archify-editor-snap-grid')
  return saved !== '0'
}

export default function App() {
  const [diagram, setDiagram] = useState<AnyDiagram>(() => structuredClone(sampleArchitecture))
  const [selection, setSelection] = useState<Selection>(null)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  // 新建连线的默认类型（对标亿图 / draw.io 的线条样式：直线 / 折线 / 曲线）
  const [defaultEdgeRoute, setDefaultEdgeRoute] = useState<'straight' | 'ortho' | 'curve'>('ortho')
  /**
   * 画布绘制工具：null=选择；straight/ortho/curve=在空白处拖拽直接放独立线；
   * boundary=拖拽画区域框。对标 draw.io / 亿图的「先选工具再画」。
   */
  const [drawTool, setDrawTool] = useState<
    'straight' | 'ortho' | 'curve' | 'boundary' | null
  >(null)
  const [undo, setUndo] = useState<AnyDiagram[]>([])
  const [redo, setRedo] = useState<AnyDiagram[]>([])
  const [status, setStatus] = useState('就绪')
  /** 另存为面板的待保存内容（导出时设置，保存后清空） */
  const [saveAsRequest, setSaveAsRequest] = useState<SaveAsRequest | null>(null)
  const [cliOk, setCliOk] = useState<boolean | null>(null)
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme())
  const [showGrid, setShowGrid] = useState(() => readShowGrid())
  const [snapToGrid, setSnapToGrid] = useState(() => readSnapToGrid())
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null)
  const [clipboard, setClipboard] = useState<ClipboardPayload | null>(null)
  /** 格式刷：节点 BoxStyle 或边 LineStyle */
  const [styleBrush, setStyleBrush] = useState<
    | { kind: 'node'; style: BoxStyle }
    | { kind: 'edge'; style: LineStyle }
    | null
  >(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [paletteW, setPaletteW] = useState(200)
  const [inspectorW, setInspectorW] = useState(280)
  const [statusH, setStatusH] = useState(28)
  const [fitEpoch, setFitEpoch] = useState(0)
  const [cardIndex, setCardIndex] = useState<number | null>(null)
  const layoutDrag = useRef<null | { kind: 'left' | 'right' | 'bottom'; start: number; size: number }>(null)

  useEffect(() => {
    void fetch('/api/finalize/status')
      .then((r) => r.json())
      .then((j: { available?: boolean }) => setCliOk(Boolean(j.available)))
      .catch(() => setCliOk(false))
  }, [])

  useEffect(() => {
    localStorage.setItem('archify-editor-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    localStorage.setItem('archify-editor-show-grid', showGrid ? '1' : '0')
  }, [showGrid])

  useEffect(() => {
    localStorage.setItem('archify-editor-snap-grid', snapToGrid ? '1' : '0')
  }, [snapToGrid])

  const pushUndo = useCallback(() => {
    setUndo((u) => [...u.slice(-29), structuredClone(diagram)])
    setRedo([])
  }, [diagram])

  const undoOnce = useCallback(() => {
    setUndo((u) => {
      const last = u[u.length - 1]
      if (!last) return u
      setRedo((r) => [...r.slice(-29), structuredClone(diagram)])
      setDiagram(last)
      setSelection(null)
      setStatus('已撤销')
      return u.slice(0, -1)
    })
  }, [diagram])

  const redoOnce = useCallback(() => {
    setRedo((r) => {
      const last = r[r.length - 1]
      if (!last) return r
      setUndo((u) => [...u.slice(-29), structuredClone(diagram)])
      setDiagram(last)
      setSelection(null)
      setStatus('已重做')
      return r.slice(0, -1)
    })
  }, [diagram])

  const selectedNodeIds = useMemo(() => nodeIdsOf(selection), [selection])
  const selectedLaneIds = useMemo(() => laneIdsOf(selection), [selection])

  const selectedNode = useMemo(() => {
    const id = primaryNodeId(selection)
    if (!id) return null
    if (isFlowchart(diagram)) return diagram.nodes.find((n) => n.id === id) ?? null
    return diagram.components.find((n) => n.id === id) ?? null
  }, [selection, diagram])

  const selectedEdge = useMemo(() => {
    if (selection?.kind !== 'edge') return null
    if (isFlowchart(diagram)) return diagram.edges.find((n) => n.id === selection.id) ?? null
    return (diagram.connections ?? []).find((n) => n.id === selection.id) ?? null
  }, [selection, diagram])

  const selectedBoundary = useMemo(() => {
    const bi = primaryBoundaryIndex(selection)
    if (bi == null) return null
    return (diagram.boundaries ?? [])[bi] ?? null
  }, [selection, diagram])

  const selectedLine = useMemo(() => {
    if (selection?.kind !== 'line') return null
    return (diagram.lines ?? []).find((l) => l.id === selection.id) ?? null
  }, [selection, diagram])

  const load = (next: AnyDiagram) => {
    pushUndo()
    setDiagram(next)
    setSelection(null)
    setLinkFrom(null)
    setCardIndex(null)
    setFitEpoch((n) => n + 1)
  }

  const switchType = (type: 'flowchart' | 'architecture' | 'layered') => {
    const current =
      isFlowchart(diagram) ? 'flowchart' : architectureMode(diagram) === 'layered' ? 'layered' : 'architecture'
    if (current === type) return
    if (!confirm('切换类型将加载对应空白/示例模板，当前图会进入一步撤销。继续？')) return
    if (type === 'flowchart') load(structuredClone(sampleFlowchart))
    else if (type === 'layered') load(structuredClone(sampleLayered))
    else load(structuredClone(sampleArchitecture))
  }

  const patchNode = (id: string, patch: Record<string, unknown>) => {
    setDiagram((d) => {
      const explicitSize = patch.size as Size | undefined
      // 改文字且未手动指定尺寸时，让框高随折行后的行数自动增高（亿图式换行）
      const touchesText =
        typeof patch.label === 'string' || typeof patch.sublabel === 'string'
      const fit = (node: FlowchartNode | ArchifyComponent): Size | undefined => {
        if (explicitSize) return clampSize(explicitSize)
        if (!touchesText || !node.size) return node.size
        const style = node.style
        const fontSize = Number(style?.fontSize) || DEFAULT_NODE_FONT_SIZE
        const subFontSize = resolveSubFontSize(fontSize, style?.subFontSize as number | undefined)
        const label = typeof patch.label === 'string' ? patch.label : node.label
        const sublabel =
          typeof patch.sublabel === 'string'
            ? patch.sublabel
            : 'sublabel' in node
              ? node.sublabel
              : undefined
        return fitSizeToLabel(node.size, label, sublabel, fontSize, subFontSize, node.size[1])
      }
      if (isFlowchart(d)) {
        return {
          ...d,
          nodes: d.nodes.map((n) =>
            n.id === id ? ({ ...n, ...patch, size: fit(n) } as FlowchartNode) : n,
          ),
        }
      }
      return {
        ...d,
        components: d.components.map((c) =>
          c.id === id ? ({ ...c, ...patch, size: fit(c) } as ArchifyComponent) : c,
        ),
      }
    })
  }

  const patchEdge = (id: string, patch: Record<string, unknown>) => {
    setDiagram((d) => {
      if (isFlowchart(d)) {
        return { ...d, edges: d.edges.map((e) => (e.id === id ? ({ ...e, ...patch } as FlowchartEdge) : e)) }
      }
      return {
        ...d,
        connections: (d.connections ?? []).map((e) => (e.id === id ? ({ ...e, ...patch } as ArchifyConnection) : e)),
      }
    })
  }

  const patchLine = (id: string, patch: Partial<StandaloneLine>) => {
    setDiagram((d) => ({
      ...d,
      lines: (d.lines ?? []).map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }

  /** 空白处拖拽直接放置独立直线 / 折线 / 曲线（不接节点） */
  const onAddLine = (route: 'straight' | 'ortho' | 'curve', from: Point, to: Point) => {
    pushUndo()
    const points = route === 'ortho' ? orthoPoints(from, to) : [from, to]
    const line: StandaloneLine = {
      id: nextId('line'),
      points,
      route,
      style: { arrow: 'end' },
    }
    setDiagram((d) => ({ ...d, lines: [...(d.lines ?? []), line] }))
    setSelection({ kind: 'line', id: line.id })
    setDrawTool(null)
    setStatus(
      route === 'ortho' ? '已放置独立折线' : route === 'curve' ? '已放置独立曲线' : '已放置独立直线',
    )
  }

  /** 拖拽画区域框：不包裹节点，显式 pos/size */
  const onAddBoundaryRect = (pos: Point, size: Size) => {
    pushUndo()
    const maxPad = Math.max(
      16,
      ...(diagram.boundaries ?? []).map((b) => b.pad ?? 16),
    )
    const b: ArchifyBoundary = {
      kind: 'region',
      label: `区域框 ${(diagram.boundaries ?? []).length + 1}`,
      wraps: [],
      pos,
      size,
      pad: maxPad,
      padX: maxPad,
      padY: maxPad,
      padLeft: maxPad,
      padRight: maxPad,
      padTop: maxPad,
      padBottom: maxPad,
    }
    setDiagram((d) => ({ ...d, boundaries: [...(d.boundaries ?? []), b] }))
    setSelection({ kind: 'boundary', indexes: [(diagram.boundaries ?? []).length] })
    setDrawTool(null)
    setStatus('已放置区域框（可在属性面板重命名或勾选包含节点）')
  }

  const patchBoundary = (index: number, patch: Partial<ArchifyBoundary>) => {
    setDiagram((d) => {
      const prev = d.boundaries?.[index]
      let next: AnyDiagram = {
        ...d,
        boundaries: (d.boundaries ?? []).map((b, i) => (i === index ? { ...b, ...patch } : b)),
      }
      if (prev && typeof patch.label === 'string' && patch.label !== prev.label) {
        next = renameBoundaryStyle(next, prev.label, patch.label)
      }
      return next
    })
  }

  const onMove = (id: string, pos: Point, layerIndex?: number) => {
    setDiagram((d) => {
      if (isFlowchart(d)) {
        return { ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, pos } : n)) }
      }
      let next: ArchifyDiagram = {
        ...d,
        components: d.components.map((c) => (c.id === id ? { ...c, pos } : c)),
      }
      if (architectureMode(next) === 'layered' && layerIndex != null) {
        next = assignComponentLayer(next, id, layerIndex)
      }
      return next
    })
  }

  const onMoveGroup = (moves: Array<{ id: string; pos: Point }>) => {
    if (!moves.length) return
    const map = new Map(moves.map((m) => [m.id, m.pos]))
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const oldPos = new Map(
          d.nodes.map((n, i) => [n.id, ensurePos(n.pos, i)] as const).filter(([id]) => map.has(id)),
        )
        return {
          ...d,
          nodes: d.nodes.map((n) => (map.has(n.id) ? { ...n, pos: map.get(n.id)! } : n)),
          edges: translateViasForUniformMoves(d.edges, oldPos, map),
        }
      }
      const oldPos = new Map(
        d.components
          .map((c, i) => [c.id, ensurePos(c.pos, i)] as const)
          .filter(([id]) => map.has(id)),
      )
      return {
        ...d,
        components: d.components.map((c) => (map.has(c.id) ? { ...c, pos: map.get(c.id)! } : c)),
        connections: translateViasForUniformMoves(d.connections ?? [], oldPos, map),
      }
    })
  }

  const patchNodes = (ids: string[], patch: Record<string, unknown>) => {
    if (!ids.length) return
    const size = patch.size as Size | undefined
    const stylePatch = patch.style as BoxStyle | undefined
    const rest: Record<string, unknown> = { ...patch }
    delete rest.style
    setDiagram((d) => {
      const next: AnyDiagram = stylePatch ? paintNodes(d, ids, stylePatch) : d
      if (!Object.keys(rest).length) return next
      if (isFlowchart(next)) {
        return {
          ...next,
          nodes: next.nodes.map((n) =>
            ids.includes(n.id) ? ({ ...n, ...rest, size: size ? clampSize(size) : n.size } as FlowchartNode) : n,
          ),
        }
      }
      if (!isArchitecture(next)) return next
      return {
        ...next,
        components: next.components.map((c) =>
          ids.includes(c.id) ? ({ ...c, ...rest, size: size ? clampSize(size) : c.size } as ArchifyComponent) : c,
        ),
      }
    })
  }

  const onResize = (id: string, pos: Point, size: Size) => {
    patchNode(id, { pos, size: clampSize(size) })
  }

  const onConnect = (from: string, to: string, meta?: { fromSide?: string; toSide?: string }) => {
    pushUndo()
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const source = d.nodes.find((n) => n.id === from)
        const outgoing = d.edges.filter((e) => e.from === from).length
        const edge: FlowchartEdge = {
          id: nextId('edge'),
          from,
          to,
          label: source?.shape === 'decision' ? labelForNewDecisionEdge(outgoing) : '',
          route: defaultEdgeRoute,
          ...(meta?.fromSide ? { fromSide: meta.fromSide as FlowchartEdge['fromSide'] } : {}),
          ...(meta?.toSide ? { toSide: meta.toSide as FlowchartEdge['toSide'] } : {}),
          style: { arrow: 'end' },
        }
        return { ...d, edges: [...d.edges, edge] }
      }
      const edge: ArchifyConnection = {
        id: nextId('edge'),
        from,
        to,
        label: '',
        route: 'auto',
        ...(meta?.fromSide ? { fromSide: meta.fromSide } : {}),
        ...(meta?.toSide ? { toSide: meta.toSide } : {}),
        style: { arrow: 'end' },
      }
      return { ...d, connections: [...(d.connections ?? []), edge] }
    })
    setLinkFrom(null)
  }

  const oppositeSide = (side?: string): string | undefined => {
    if (side === 'n') return 's'
    if (side === 's') return 'n'
    if (side === 'e') return 'w'
    if (side === 'w') return 'e'
    return undefined
  }

  /** 边柄拖到空白：默认落过程形 / 后端组件并连线 */
  const onConnectToEmpty = (from: string, at: Point, meta?: { fromSide?: string }) => {
    const toSide = oppositeSide(meta?.fromSide)
    const side = meta?.fromSide
    const placeAt = (size: Size): Point => {
      const pos: Point =
        side === 'e'
          ? [at[0], at[1] - size[1] / 2]
          : side === 'w'
            ? [at[0] - size[0], at[1] - size[1] / 2]
            : side === 's'
              ? [at[0] - size[0] / 2, at[1]]
              : side === 'n'
                ? [at[0] - size[0] / 2, at[1] - size[1]]
                : [at[0] - size[0] / 2, at[1] - size[1] / 2]
      return [Math.round(pos[0]), Math.round(pos[1])]
    }
    pushUndo()
    if (isFlowchart(diagram)) {
      const node = defaultFlowNode('process', placeAt([150, 56]))
      const source = diagram.nodes.find((n) => n.id === from)
      const outgoing = diagram.edges.filter((e) => e.from === from).length
      const edge: FlowchartEdge = {
        id: nextId('edge'),
        from,
        to: node.id,
        label: source?.shape === 'decision' ? labelForNewDecisionEdge(outgoing) : '',
        route: defaultEdgeRoute,
        ...(meta?.fromSide ? { fromSide: meta.fromSide as FlowchartEdge['fromSide'] } : {}),
        ...(toSide ? { toSide: toSide as FlowchartEdge['toSide'] } : {}),
        style: { arrow: 'end' },
      }
      setDiagram((d) =>
        isFlowchart(d) ? { ...d, nodes: [...d.nodes, node], edges: [...d.edges, edge] } : d,
      )
      setSelection(selectOnlyNode(node.id))
    } else if (isArchitecture(diagram)) {
      const node = defaultArchNode('backend', placeAt([160, 64]))
      node.label = 'backend'
      const edge: ArchifyConnection = {
        id: nextId('edge'),
        from,
        to: node.id,
        label: '',
        route: 'auto',
        ...(meta?.fromSide ? { fromSide: meta.fromSide } : {}),
        ...(toSide ? { toSide } : {}),
        style: { arrow: 'end' },
      }
      setDiagram((d) =>
        isArchitecture(d)
          ? { ...d, components: [...d.components, node], connections: [...(d.connections ?? []), edge] }
          : d,
      )
      setSelection(selectOnlyNode(node.id))
    }
    setLinkFrom(null)
    setStatus('已续形：新建节点并连线（Esc 可取消拖线）')
  }

  const applyNodeMoves = (moves: Array<{ id: string; pos: Point }>) => {
    if (!moves.length) return
    pushUndo()
    onMoveGroup(moves)
  }

  const alignSelected = (axis: AlignAxis) => {
    const ids = nodeIdsOf(selection)
    if (ids.length < 2) {
      setStatus('请至少选中 2 个图形再对齐（主选作为基准保持不动）')
      return
    }
    const list = isFlowchart(diagram) ? diagram.nodes : diagram.components
    const boxes = ids
      .map((id, i) => {
        const n = list.find((x) => x.id === id)
        if (!n) return null
        return { id, pos: ensurePos(n.pos, i), size: ensureSize(n.size) }
      })
      .filter((x): x is { id: string; pos: Point; size: Size } => Boolean(x))
    // 主选（最后点选）为基准，多选对齐时该框位置不变
    const anchorId = primaryNodeId(selection) ?? ids[ids.length - 1]
    applyNodeMoves(alignNodes(boxes, axis, anchorId ?? undefined))
    const labels: Record<AlignAxis, string> = {
      left: '左对齐',
      right: '右对齐',
      center: '居中对齐',
      top: '顶对齐',
      bottom: '底对齐',
      middle: '垂直居中',
    }
    setStatus(`已${labels[axis]}（基准：${anchorId}）`)
  }

  const distributeSelected = (axis: 'horizontal' | 'vertical') => {
    const ids = nodeIdsOf(selection)
    const laneIds = laneIdsOf(selection)
    const list = isFlowchart(diagram) ? diagram.nodes : diagram.components

    // 选中泳道框体：对该列/带内节点做等距分布（框内等距）；优先于全局多选
    if (laneIds.length) {
      const layers = [...(diagram.meta.editor?.layers ?? [])].sort((a, b) => a.order - b.order)
      const laneW = resolveLaneWidth(diagram)
      const orient = resolveLaneOrientation(diagram)
      const moves: Array<{ id: string; pos: Point }> = []
      for (const laneId of laneIds) {
        const li = layers.findIndex((l) => l.id === laneId)
        if (li < 0) continue
        const band = layerBand(layers, li, laneW, orient)
        const inLane = list
          .map((n, i) => {
            const pos = ensurePos(n.pos, i)
            const size = ensureSize(n.size)
            const cx = pos[0] + size[0] / 2
            const cy = pos[1] + size[1] / 2
            const inside =
              orient === 'vertical'
                ? cx >= band.x && cx <= band.x + band.w
                : cy >= band.y && cy <= band.y + band.h
            return inside ? { id: n.id, pos, size } : null
          })
          .filter((x): x is { id: string; pos: Point; size: Size } => Boolean(x))
        if (inLane.length < 3) continue
        moves.push(
          ...distributeNodes(inLane, orient === 'vertical' ? 'vertical' : axis),
        )
      }
      if (!moves.length) {
        setStatus('泳道内节点不足 3 个，无法等距分布')
        return
      }
      applyNodeMoves(moves)
      setStatus(orient === 'vertical' ? '已垂直等距分布（泳道内）' : '已等距分布（泳道内）')
      return
    }

    if (ids.length < 3) {
      setStatus('请至少选中 3 个图形，或选中含 ≥3 节点的泳道框体')
      return
    }
    const boxes = ids
      .map((id, i) => {
        const n = list.find((x) => x.id === id)
        if (!n) return null
        return { id, pos: ensurePos(n.pos, i), size: ensureSize(n.size) }
      })
      .filter((x): x is { id: string; pos: Point; size: Size } => Boolean(x))
    applyNodeMoves(distributeNodes(boxes, axis))
    setStatus(axis === 'horizontal' ? '已水平分布' : '已垂直分布')
  }

  const addFlow = (shape: FlowShape, at?: Point) => {
    pushUndo()
    const place = at ?? [120, 80]
    const node = defaultFlowNode(shape, place)
    setDiagram((d) => {
      if (isFlowchart(d)) return { ...d, nodes: [...d.nodes, node] }
      if (!isArchitecture(d)) return d
      const archNode = { ...defaultArchShapeNode(shape, place), id: node.id }
      let next: ArchifyDiagram = { ...d, components: [...d.components, archNode] }
      if (architectureMode(next) === 'layered') {
        const layers = sortedLayers(next)
        const laneW = next.meta.editor?.laneWidth
        const y = place[1] + (archNode.size?.[1] ?? 56) / 2
        let idx = 0
        for (let i = 0; i < layers.length; i++) {
          const band = layerBand(layers, i, typeof laneW === 'number' ? laneW : undefined)
          if (y >= band.y && y <= band.y + band.h) {
            idx = i
            break
          }
          idx = i
        }
        next = assignComponentLayer(next, archNode.id, idx)
      }
      return next
    })
    setSelection(selectOnlyNode(node.id))
    setStatus(`已插入 ${shape}`)
  }

  const addArch = (type: ComponentType, at?: Point) => {
    pushUndo()
    const node = defaultArchNode(type, at ?? [140, 100])
    if (type) node.label = type
    setDiagram((d) => {
      if (!isArchitecture(d)) return d
      let next: ArchifyDiagram = { ...d, components: [...d.components, node] }
      if (architectureMode(next) === 'layered') {
        const layers = sortedLayers(next)
        const laneW = next.meta.editor?.laneWidth
        const y = (at?.[1] ?? 100) + (node.size?.[1] ?? 56) / 2
        let idx = 0
        for (let i = 0; i < layers.length; i++) {
          const band = layerBand(layers, i, typeof laneW === 'number' ? laneW : undefined)
          if (y >= band.y && y <= band.y + band.h) {
            idx = i
            break
          }
          idx = i
        }
        next = assignComponentLayer(next, node.id, idx)
      }
      return next
    })
    setSelection(selectOnlyNode(node.id))
    setStatus(`已插入 ${type}`)
  }

  const removeSelected = () => {
    if (!selection) return
    pushUndo()
    setDiagram((d) => {
      const dropLineIds = selection.kind === 'line' ? new Set([selection.id]) : new Set<string>()
      if (dropLineIds.size) {
        return { ...d, lines: (d.lines ?? []).filter((l) => !dropLineIds.has(l.id)) }
      }
      if (selection.kind === 'nodes') {
        const ids = new Set(selection.ids)
        return {
          ...d,
          ...(isFlowchart(d)
            ? {
                nodes: d.nodes.filter((n) => !ids.has(n.id)),
                edges: d.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)),
              }
            : {
                components: d.components.filter((n) => !ids.has(n.id)),
                connections: (d.connections ?? []).filter((e) => !ids.has(e.from) && !ids.has(e.to)),
              }),
          boundaries: (d.boundaries ?? []).map((b) => ({
            ...b,
            wraps: b.wraps.filter((w) => !ids.has(w)),
          })),
        }
      }
      if (selection.kind === 'boundary' || selection.kind === 'all') {
        const drop = new Set(boundaryIndexesOf(selection))
        let next = d
        if (selection.kind === 'all' && selection.nodeIds.length) {
          const ids = new Set(selection.nodeIds)
          next = {
            ...next,
            ...(isFlowchart(next)
              ? {
                  nodes: next.nodes.filter((n) => !ids.has(n.id)),
                  edges: next.edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)),
                }
              : {
                  components: next.components.filter((n) => !ids.has(n.id)),
                  connections: (next.connections ?? []).filter(
                    (e) => !ids.has(e.from) && !ids.has(e.to),
                  ),
                }),
            boundaries: (next.boundaries ?? []).map((b) => ({
              ...b,
              wraps: b.wraps.filter((w) => !ids.has(w)),
            })),
          }
        }
        return {
          ...next,
          boundaries: (next.boundaries ?? []).filter((_, i) => !drop.has(i)),
        }
      }
      if (selection.kind === 'edge') {
        return isFlowchart(d)
          ? { ...d, edges: d.edges.filter((e) => e.id !== selection.id) }
          : { ...d, connections: (d.connections ?? []).filter((e) => e.id !== selection.id) }
      }
      return d
    })
    setSelection(null)
  }

  const importFileRef = useRef<HTMLInputElement>(null)
  const pendingImportFormat = useRef<ImportFormatId>('auto')

  const applyImported = (data: AnyDiagram, sourceName: string, extra = '') => {
    const sameType = data.diagram_type === diagram.diagram_type
    if (!sameType) {
      if (!confirm(`文件类型为 ${data.diagram_type}，将切换当前编辑器。继续？`)) return
    }
    const pinned = sameType ? pinnedPositionIds(diagram) : new Set<string>()
    const merged = sameType ? mergeImportedGeometry(diagram, data) : data
    // 文件带 pos（历史编辑器导出）时，坐标逐点保持文件原值：不美化、不重排；
    // 只有 Mermaid / 无坐标来源才走自动排版。
    const preserveFileGeometry = hasOwnGeometry(data)
    load(beautifyImported(layoutMissingPositions(merged, pinned), pinned, preserveFileGeometry))
    setStatus(`已导入 ${sourceName}${extra}`)
  }

  const importFromText = (text: string, format: ImportFormatId, sourceName: string) => {
    try {
      const result = openTypedDocument(text, format)
      if (!result.ok) {
        setStatus(result.error.message)
        return
      }
      let diagramIn = result.diagram
      let dropped = result.lossy?.dropped ?? []
      if (result.format_hints.source === 'drawio') {
        const suggested = diagramIn.diagram_type
        const answer = window.prompt('导入 draw.io 子集。输入 flowchart 或 architecture', suggested)
        if (answer == null) {
          setStatus('已取消导入')
          return
        }
        const chosen = answer.trim()
        if (chosen !== 'flowchart' && chosen !== 'architecture') {
          setStatus('请输入 flowchart 或 architecture')
          return
        }
        if (chosen !== suggested) {
          const again = importDrawioDocument(text, chosen)
          if (!again.ok) {
            setStatus(again.error.message)
            return
          }
          diagramIn = again.diagram
          dropped = again.lossy?.dropped ?? []
        }
      }
      const lossy = dropped.length ? `（有损：${dropped.join(', ')}）` : ''
      const converted =
        result.format_hints.source === 'archify' && diagramIn.diagram_type === 'flowchart'
          ? '（已从 Archify workflow 转换）'
          : result.format_hints.source === 'mermaid'
            ? '（已从 Mermaid 转换）'
            : result.format_hints.source === 'drawio'
              ? '（已从 draw.io 子集转换）'
              : ''
      applyImported(diagramIn, sourceName, `${converted}${lossy}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '导入失败')
    }
  }

  const onImportFormat = (id: ImportFormatId) => {
    const item = IMPORT_FORMATS.find((f) => f.id === id)
    if (!item?.enabled) return
    if (id === 'paste-json' || id === 'paste-mermaid') {
      const sample =
        id === 'paste-mermaid'
          ? '粘贴 Mermaid（flowchart / C4 / architecture-beta）'
          : '粘贴 JSON（architecture / flowchart / workflow）'
      const text = window.prompt(sample, '')
      if (text == null || !text.trim()) return
      importFromText(text, id, '剪贴板')
      return
    }
    pendingImportFormat.current = id
    const input = importFileRef.current
    if (!input) return
    input.accept = item.accept ?? '.json'
    input.value = ''
    input.click()
  }

  const onImportFileChange = async (file: File | undefined) => {
    if (!file) return
    importFromText(await file.text(), pendingImportFormat.current, file.name)
  }

  const exportEditorJson = () => {
    const payload =
      isArchitecture(diagram) && architectureMode(diagram) === 'layered' ? syncBoundaries(diagram) : diagram
    setSaveAsRequest({
      suggestedName: filenameFor(payload),
      content: JSON.stringify(payload, null, 2),
      mime: 'application/json',
      description: '本编辑器 JSON',
    })
  }

  const exportArchifyJson = () => {
    if (isArchitecture(diagram)) {
      const payload = stripForFinalize(diagram)
      const name = filenameFor(payload).replace(/\.architecture\.json$/, '.archify.architecture.json')
      setSaveAsRequest({
        suggestedName: name,
        content: JSON.stringify(payload, null, 2),
        mime: 'application/json',
        description: 'Archify architecture JSON（已剥离私有字段）',
      })
      return
    }
    if (isFlowchart(diagram)) {
      const prepared = prepareWorkflowFinalizePayload(diagram)
      const base = filenameFor(diagram).replace(/\.flowchart\.json$/, '').replace(/\.json$/, '')
      setSaveAsRequest({
        suggestedName: `${base}.workflow.json`,
        content: JSON.stringify(prepared.diagram, null, 2),
        mime: 'application/json',
        description: prepared.fromSource ? 'Archify workflow JSON（合并源文档）' : 'Archify workflow JSON（由 flowchart 合成）',
      })
      return
    }
    setStatus('无法导出 Archify JSON')
  }

  const exportHtml = async () => {
    setStatus('正在 Finalize…')
    let payload: unknown
    let kind: 'architecture' | 'workflow'
    if (isArchitecture(diagram)) {
      payload = stripForFinalize(diagram)
      kind = 'architecture'
    } else if (isFlowchart(diagram)) {
      const prepared = prepareWorkflowFinalizePayload(diagram)
      payload = prepared.diagram
      kind = 'workflow'
      setStatus(
        prepared.fromSource
          ? `正在 Finalize workflow（${prepared.quality}）…`
          : `正在 Finalize（合成 workflow · ${prepared.quality}）…`,
      )
    } else {
      setStatus('无法导出 HTML')
      return
    }
    const quality =
      payload && typeof payload === 'object' && (payload as { meta?: { quality_profile?: string } }).meta
        ?.quality_profile === 'standard'
        ? 'standard'
        : 'showcase'
    const result = await finalizeHtml(payload, { quality: kind === 'workflow' ? quality : 'showcase' })
    if (result.html) {
      const base = filenameFor(diagram).replace(/\.json$/, '').replace(/\.flowchart$/, '').replace(/\.architecture$/, '')
      const desc =
        result.soft
          ? 'HTML（browser-check 视口溢出已忽略，产物可用）'
          : kind === 'workflow'
            ? 'HTML（Archify finalize workflow）'
            : 'HTML（Archify finalize architecture）'
      setSaveAsRequest({
        suggestedName: `${base}.${kind}.html`,
        content: result.html,
        mime: 'text/html',
        description: desc,
      })
      return
    }
    setStatus(result.error ?? 'Finalize 失败（可点「复制 CLI」兜底）')
  }

  const onExportFormat = async (id: ExportFormatId) => {
    const base = filenameFor(diagram).replace(/\.json$/, '').replace(/\.flowchart$/, '').replace(/\.architecture$/, '')
    try {
      switch (id) {
        case 'editor-json':
          exportEditorJson()
          return
        case 'archify-json':
          exportArchifyJson()
          return
        case 'html':
          await exportHtml()
          return
        case 'mermaid': {
          const { text, lossy } = diagramToMermaid(diagram)
          setSaveAsRequest({
            suggestedName: `${base}.mmd`,
            content: text,
            mime: 'text/plain',
            description: lossy ? 'Mermaid（architecture 有损降级）' : 'Mermaid',
          })
          return
        }
        case 'drawio': {
          const { text, lossy } = diagramToDrawio(diagram)
          setSaveAsRequest({
            suggestedName: `${base}.drawio`,
            content: text,
            mime: 'application/xml',
            description: lossy?.dropped?.length ? `draw.io（${lossy.dropped[0]} 等已改成矩形）` : 'draw.io',
          })
          return
        }
        case 'svg': {
          const svg = exportCanvasSvg()
          setSaveAsRequest({
            suggestedName: `${base}.svg`,
            content: svg,
            mime: 'image/svg+xml',
            description: 'SVG',
          })
          return
        }
        case 'png':
        case 'jpeg':
        case 'webp': {
          const fmt = id as RasterFormat
          const blob = await exportCanvasImage(fmt, 2)
          setSaveAsRequest({
            suggestedName: `${base}.${fmt === 'jpeg' ? 'jpg' : fmt}`,
            content: blob,
            mime: `image/${fmt === 'jpeg' ? 'jpeg' : fmt}`,
            description: `${fmt.toUpperCase()}（按内容裁切）`,
          })
          return
        }
        default:
          setStatus('该导出格式暂未开放')
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '导出失败')
    }
  }

  const copyCmd = async () => {
    const kind = isFlowchart(diagram) ? 'workflow' : 'architecture'
    await navigator.clipboard.writeText(finalizeCommandTemplate(kind))
    setStatus(`已复制 Finalize ${kind} CLI 命令`)
  }

  const addLayer = () => {
    pushUndo()
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const layers = [...(d.meta.editor?.layers ?? [])]
        const order = layers.length
        const vertical = resolveLaneOrientation(d) === 'vertical'
        const layer = vertical
          ? defaultVerticalLane(order, nextId('lane'), `泳道 ${order + 1}`)
          : { id: nextId('lane'), label: `泳道 ${order + 1}`, order, height: 140 }
        layers.push(layer)
        return {
          ...d,
          meta: {
            ...d.meta,
            editor: {
              ...d.meta.editor,
              mode: 'swimlane',
              laneOrientation: vertical ? 'vertical' : d.meta.editor?.laneOrientation ?? 'horizontal',
              layers,
            },
          },
        }
      }
      if (!isArchitecture(d)) return d
      const layers = [...(d.meta.editor?.layers ?? [])]
      const order = layers.length
      const layer = { id: nextId('layer'), label: `层 ${order + 1}`, order, height: 140 }
      layers.push(layer)
      return {
        ...d,
        meta: { ...d.meta, editor: { ...d.meta.editor, mode: 'layered', layers } },
        boundaries: [...(d.boundaries ?? []), { kind: 'region', label: layer.label, wraps: [] }],
      }
    })
    setStatus(isFlowchart(diagram) ? '已新增泳道' : '已新增层')
  }

  const setLaneOrientation = (orientation: LaneOrientation) => {
    if (!isFlowchart(diagram)) return
    if (resolveLaneOrientation(diagram) === orientation && (diagram.meta.editor?.layers?.length ?? 0) > 0) {
      setStatus(orientation === 'vertical' ? '已是纵向泳道' : '已是横向泳道')
      return
    }
    pushUndo()
    setDiagram((d) => (isFlowchart(d) ? reorientFlowchartSwimlanes(d, orientation) : d))
    setStatus(orientation === 'vertical' ? '已切换为纵向泳道' : '已切换为横向泳道')
  }

  const renameLayer = (id: string, label: string) => {
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const layers = (d.meta.editor?.layers ?? []).map((l) => (l.id === id ? { ...l, label } : l))
        return { ...d, meta: { ...d.meta, editor: { ...d.meta.editor, mode: 'swimlane', layers } } }
      }
      if (!isArchitecture(d)) return d
      const layers = (d.meta.editor?.layers ?? []).map((l) => (l.id === id ? { ...l, label } : l))
      const old = d.meta.editor?.layers?.find((l) => l.id === id)
      const boundaries = (d.boundaries ?? []).map((b) => (old && b.label === old.label ? { ...b, label } : b))
      return { ...d, boundaries, meta: { ...d.meta, editor: { ...d.meta.editor, layers } } }
    })
  }

  const removeLayer = (id: string) => {
    pushUndo()
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const layers = (d.meta.editor?.layers ?? []).filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i }))
        return {
          ...d,
          meta: {
            ...d.meta,
            editor: {
              ...d.meta.editor,
              mode: layers.length ? 'swimlane' : 'free',
              layers,
            },
          },
        }
      }
      if (!isArchitecture(d)) return d
      const victim = d.meta.editor?.layers?.find((l) => l.id === id)
      const layers = (d.meta.editor?.layers ?? []).filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i }))
      const boundaries = (d.boundaries ?? []).filter((b) => b.label !== victim?.label)
      return { ...d, boundaries, meta: { ...d.meta, editor: { ...d.meta.editor, mode: 'layered', layers } } }
    })
  }

  const duplicateSelectedNode = useCallback(() => {
    const ids = nodeIdsOf(selection)
    if (!ids.length) return
    pushUndo()
    if (isFlowchart(diagram)) {
      const copies: FlowchartNode[] = []
      for (const id of ids) {
        const src = diagram.nodes.find((n) => n.id === id)
        if (!src) continue
        copies.push({
          ...structuredClone(src),
          id: nextId(src.shape),
          pos: [(src.pos?.[0] ?? 120) + 24, (src.pos?.[1] ?? 80) + 24],
        })
      }
      if (!copies.length) return
      setDiagram((d) => (isFlowchart(d) ? { ...d, nodes: [...d.nodes, ...copies] } : d))
      setSelection(selectNodes(copies.map((n) => n.id)))
    } else {
      const copies: ArchifyComponent[] = []
      for (const id of ids) {
        const src = diagram.components.find((n) => n.id === id)
        if (!src) continue
        copies.push({
          ...structuredClone(src),
          id: nextId(src.type),
          pos: [(src.pos?.[0] ?? 140) + 24, (src.pos?.[1] ?? 100) + 24],
        })
      }
      if (!copies.length) return
      setDiagram((d) => (isArchitecture(d) ? { ...d, components: [...d.components, ...copies] } : d))
      setSelection(selectNodes(copies.map((n) => n.id)))
    }
    setStatus(ids.length > 1 ? `已创建 ${ids.length} 个副本` : '已创建副本')
  }, [selection, diagram, pushUndo])

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (selection?.kind === 'line') {
        const line = (diagram.lines ?? []).find((l) => l.id === selection.id)
        if (line) patchLine(line.id, { points: translateLinePoints(line.points, dx, dy) })
        return
      }
      if (selection?.kind === 'boundary') {
        const index = boundaryIndexesOf(selection)[0]
        const b = index == null ? undefined : diagram.boundaries?.[index]
        if (b?.pos) {
          patchBoundary(index!, { pos: [b.pos[0] + dx, b.pos[1] + dy] })
          return
        }
      }
      const bounds = diagram.boundaries
      const ids = movableIdsForSelection(selection, bounds)
      if (!ids.length) return
      const list = isFlowchart(diagram) ? diagram.nodes : diagram.components
      const moves = nudgeMovesForIds(list, ids, dx, dy)
      if (!moves.length) return
      // 单选也走 onMoveGroup：与鼠标整组拖同一路径，且可同步平移两端 via
      onMoveGroup(moves)
    },
    [selection, diagram],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
      const mod = e.ctrlKey || e.metaKey

      if (!typing && e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false)
          return
        }
        if (styleBrush) {
          setStyleBrush(null)
          setStatus('已退出格式刷')
          return
        }
        if (linkFrom) {
          setLinkFrom(null)
          setStatus('已取消连线')
          return
        }
        if (drawTool) {
          setDrawTool(null)
          setStatus('已退出绘制工具')
          return
        }
      }

      if (!typing && (e.key === '?' || (e.key === '/' && e.shiftKey))) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }
      if (!typing && (e.key === 'F1' || (mod && e.key.toLowerCase() === '/'))) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }

      if (!typing && (e.key === 'Delete' || e.key === 'Backspace')) {
        removeSelected()
        return
      }

      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoOnce()
        return
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        redoOnce()
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        copySelectedNode()
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        copySelectedNode()
        removeSelected()
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        pasteClipboard()
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelectedNode()
        return
      }
      if (mod && !typing && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        if (isFlowchart(diagram)) {
          const ids = diagram.nodes.map((n) => n.id)
          const laneIds = (diagram.meta.editor?.layers ?? []).map((l) => l.id)
          const boundaryIndexes = (diagram.boundaries ?? []).map((_, i) => i)
          const lineIds = (diagram.lines ?? []).map((l) => l.id)
          if (laneIds.length || boundaryIndexes.length || lineIds.length) {
            setSelection({
              kind: 'all',
              nodeIds: ids,
              boundaryIndexes,
              laneIds,
              lineIds,
            })
            const parts = [
              ids.length ? `${ids.length} 个图形` : null,
              boundaryIndexes.length ? `${boundaryIndexes.length} 个区域框` : null,
              lineIds.length ? `${lineIds.length} 条独立线` : null,
              laneIds.length ? `${laneIds.length} 个泳道框体` : null,
            ].filter(Boolean)
            setStatus(`已全选 ${parts.join('、')}`)
          } else {
            setSelection(selectNodes(ids))
            setStatus(ids.length ? `已全选 ${ids.length} 个图形` : '画布上没有图形')
          }
        } else {
          const nodeIds = diagram.components.map((n) => n.id)
          const boundaryIndexes = (diagram.boundaries ?? []).map((_, i) => i)
          const laneIds = (diagram.meta.editor?.layers ?? []).map((l) => l.id)
          setSelection(selectAllOnCanvas(nodeIds, boundaryIndexes, laneIds))
          const parts: string[] = []
          if (nodeIds.length) parts.push(`${nodeIds.length} 个组件`)
          if (boundaryIndexes.length) parts.push(`${boundaryIndexes.length} 个区域框`)
          if (laneIds.length) parts.push(`${laneIds.length} 个层带`)
          setStatus(parts.length ? `已全选 ${parts.join('、')}（含父子框）` : '画布上没有图形')
        }
        return
      }

      // 节点或多选区域框均可微调（区域框语义=平移 wraps，对齐鼠标拖 boundary）
      const canNudge =
        selectedNodeIds.length > 0 ||
        boundaryIndexesOf(selection).length > 0 ||
        selection?.kind === 'line'
      if (!typing && canNudge && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowUp') nudgeSelected(0, -step)
        if (e.key === 'ArrowDown') nudgeSelected(0, step)
        if (e.key === 'ArrowLeft') nudgeSelected(-step, 0)
        if (e.key === 'ArrowRight') nudgeSelected(step, 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const modeLabel = isFlowchart(diagram)
    ? 'flowchart'
    : `architecture / ${architectureMode(diagram)}`

  const layerEdgeRule = isArchitecture(diagram) ? resolveLayerEdgeRule(diagram) : 'free'
  const layerViolations = useMemo(
    () => (isArchitecture(diagram) ? layerEdgeViolations(diagram) : []),
    [diagram],
  )
  const layerEdgeViolationIds = useMemo(
    () => new Set(layerViolations.map((c) => c.id)),
    [layerViolations],
  )

  const ctxStyles: StyleSnapshot = useMemo(() => {
    if (selection?.kind === 'nodes' && selectedNode) {
      const key = 'type' in selectedNode ? selectedNode.type : selectedNode.shape
      const st = resolveNodeStyle(
        'type' in selectedNode ? 'architecture' : 'flowchart',
        key,
        selectedNode.style,
        theme,
      )
      return { fill: st.fill, stroke: st.stroke, text: st.text, edgeStroke: st.stroke }
    }
    if (selection?.kind === 'edge' && selectedEdge) {
      const st = resolveLineStyle(
        selectedEdge.style,
        'variant' in selectedEdge && selectedEdge.variant === 'emphasis',
        theme,
      )
      const nodeFallback = resolveNodeStyle('architecture', 'frontend', undefined, theme)
      return {
        fill: nodeFallback.fill,
        stroke: st.stroke,
        text: nodeFallback.text,
        edgeStroke: st.stroke,
      }
    }
    if (selection?.kind === 'boundary' && selectedBoundary && isArchitecture(diagram)) {
      const st = getBoundaryStyle(diagram, selectedBoundary.label, theme)
      return {
        fill: st.fill ?? '',
        stroke: st.stroke ?? '',
        text: st.text ?? '',
        edgeStroke: st.stroke ?? '',
      }
    }
    const fallback = resolveNodeStyle('architecture', 'frontend', undefined, theme)
    return {
      fill: fallback.fill,
      stroke: fallback.stroke,
      text: fallback.text,
      edgeStroke: fallback.stroke,
    }
  }, [selection, selectedNode, selectedEdge, selectedBoundary, diagram, theme])

  const openContextMenu = (e: React.MouseEvent, target: ContextTarget) => {
    // 右键空白处保留已选节点：菜单里的「新建区域框（选中节点）」依赖当前选择
    setSelection(target.kind === 'canvas' ? selection : selectionFromTarget(target))
    setCtxMenu({ x: e.clientX, y: e.clientY, target })
  }

  const copySelectedNode = () => {
    const ids = nodeIdsOf(selection)
    if (!ids.length) return
    if (isFlowchart(diagram)) {
      const nodes = diagram.nodes.filter((n) => ids.includes(n.id)).map((n) => structuredClone(n))
      if (!nodes.length) return
      setClipboard({ kind: 'nodes', flowchart: true, nodes })
    } else {
      const nodes = diagram.components.filter((n) => ids.includes(n.id)).map((n) => structuredClone(n))
      if (!nodes.length) return
      setClipboard({ kind: 'nodes', flowchart: false, nodes })
    }
    setStatus(ids.length > 1 ? `已复制 ${ids.length} 个图形` : '已复制')
  }

  const pasteClipboard = () => {
    if (!clipboard) return
    pushUndo()
    if (clipboard.flowchart && isFlowchart(diagram)) {
      const nodes: FlowchartNode[] = clipboard.nodes.map((n) => ({
        ...structuredClone(n),
        id: nextId(n.shape),
        pos: [(n.pos?.[0] ?? 120) + 24, (n.pos?.[1] ?? 80) + 24],
      }))
      setDiagram((d) => (isFlowchart(d) ? { ...d, nodes: [...d.nodes, ...nodes] } : d))
      setSelection(selectNodes(nodes.map((n) => n.id)))
      setStatus(nodes.length > 1 ? `已粘贴 ${nodes.length} 个图形` : '已粘贴')
      return
    }
    if (!clipboard.flowchart && isArchitecture(diagram)) {
      const nodes: ArchifyComponent[] = clipboard.nodes.map((n) => ({
        ...structuredClone(n),
        id: nextId(n.type),
        pos: [(n.pos?.[0] ?? 140) + 24, (n.pos?.[1] ?? 100) + 24],
      }))
      setDiagram((d) => (isArchitecture(d) ? { ...d, components: [...d.components, ...nodes] } : d))
      setSelection(selectNodes(nodes.map((n) => n.id)))
      setStatus(nodes.length > 1 ? `已粘贴 ${nodes.length} 个图形` : '已粘贴')
    } else {
      setStatus('剪贴板与当前图类型不匹配')
    }
  }

  const reorderNode = (id: string, where: 'front' | 'back') => {
    pushUndo()
    setDiagram((d) => {
      if (isFlowchart(d)) {
        const idx = d.nodes.findIndex((n) => n.id === id)
        if (idx < 0) return d
        const nodes = d.nodes.slice()
        const [item] = nodes.splice(idx, 1)
        if (where === 'front') nodes.push(item)
        else nodes.unshift(item)
        return { ...d, nodes }
      }
      const idx = d.components.findIndex((n) => n.id === id)
      if (idx < 0) return d
      const components = d.components.slice()
      const [item] = components.splice(idx, 1)
      if (where === 'front') components.push(item)
      else components.unshift(item)
      return { ...d, components }
    })
  }

  const handleContextAction = (action: ContextAction) => {
    const target = ctxMenu?.target
    if (!target) return
    switch (action.type) {
      case 'theme':
        setTheme(action.theme)
        setStatus(action.theme === 'light' ? '已切换白天模式' : '已切换黑夜模式')
        break
      case 'toggle-grid':
        setShowGrid((v) => {
          const next = !v
          setStatus(next ? '已显示网格' : '已去除网格')
          return next
        })
        break
      case 'toggle-snap':
        setSnapToGrid((v) => {
          const next = !v
          setStatus(next ? '已开启网格吸附' : '已关闭网格吸附')
          return next
        })
        break
      case 'align':
        alignSelected(action.axis)
        break
      case 'distribute':
        distributeSelected(action.axis)
        break
      case 'cut':
        copySelectedNode()
        removeSelected()
        break
      case 'copy':
        copySelectedNode()
        break
      case 'paste':
        pasteClipboard()
        break
      case 'duplicate':
        duplicateSelectedNode()
        break
      case 'delete':
        removeSelected()
        break
      case 'bring-front':
        if (target.kind === 'node') reorderNode(target.id, 'front')
        break
      case 'send-back':
        if (target.kind === 'node') reorderNode(target.id, 'back')
        break
      case 'edit-label':
        if (target.kind === 'node' || target.kind === 'edge' || target.kind === 'boundary') {
          setSelection(selectionFromTarget(target))
          setStatus(target.kind === 'node' ? '可双击节点直接改字，或用右侧属性' : '请在右侧属性编辑文字')
        }
        break
      case 'style':
        if (target.kind === 'node') {
          const selectedIds = nodeIdsOf(selection)
          const ids =
            selectedIds.includes(target.id) && selectedIds.length > 1 ? selectedIds : [target.id]
          pushUndo()
          patchNodes(ids, { style: action.patch })
          const boundIdx = boundaryIndexesOf(selection)
          if (ids.length > 1 && boundIdx.length && isArchitecture(diagram)) {
            setDiagram((d) =>
              isArchitecture(d) ? paintBoundaries(d, boundIdx, action.patch as BoxStyle) : d,
            )
            setStatus(`已统一修改 ${ids.length} 个图形、${boundIdx.length} 个区域框`)
          } else if (ids.length > 1) {
            setStatus(`已统一修改 ${ids.length} 个图形颜色`)
          }
        }
        break
      case 'edge-style':
        if (target.kind === 'edge') {
          const edge = isFlowchart(diagram)
            ? diagram.edges.find((e) => e.id === target.id)
            : (diagram.connections ?? []).find((e) => e.id === target.id)
          const style = mergeStyle(edge?.style as LineStyle | undefined, action.patch)
          patchEdge(target.id, { style })
        }
        break
      case 'line-style':
        if (target.kind === 'line') {
          const line = diagram.lines?.find((l) => l.id === target.id)
          if (line) patchLine(line.id, { style: { ...line.style, ...action.patch } })
        }
        break
      case 'boundary-style':
        if (target.kind === 'boundary') {
          const b = diagram.boundaries?.[target.index]
          if (b) {
            setDiagram((d) => setBoundaryStyle(d, b.label, action.patch))
          }
        }
        break
      case 'add-boundary':
        if (selection?.kind !== 'nodes' || !selection.ids.length) {
          setStatus('请先选中节点，再右键空白处创建区域框')
          break
        }
        pushUndo()
        setDiagram((d) => {
          const existing = d.boundaries ?? []
          const pads = existing.map((b) => Math.max(b.padX ?? b.pad ?? 16, b.padY ?? b.pad ?? 16))
          const pad = Math.min(120, Math.max(16, ...pads, 16) + 8)
          return {
            ...d,
            boundaries: [
              ...existing,
              {
                kind: 'region',
                label: '新区域',
                wraps: [...selection.ids],
                pad,
                padX: pad,
                padY: pad,
                padLeft: pad,
                padRight: pad,
                padTop: pad,
                padBottom: pad,
              },
            ],
          }
        })
        setStatus(selection.ids.length > 1 ? `已用 ${selection.ids.length} 个节点创建区域框` : '已创建区域框')
        break
      default:
        break
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = layoutDrag.current
      if (!drag) return
      if (drag.kind === 'left') {
        setPaletteW(Math.max(140, Math.min(420, drag.size + (e.clientX - drag.start))))
      } else if (drag.kind === 'right') {
        setInspectorW(Math.max(200, Math.min(480, drag.size - (e.clientX - drag.start))))
      } else {
        setStatusH(Math.max(24, Math.min(160, drag.size - (e.clientY - drag.start))))
      }
    }
    const onUp = () => {
      layoutDrag.current = null
      document.body.classList.remove('resizing-layout')
      delete document.body.dataset.resizeKind
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const startLayoutDrag = (kind: 'left' | 'right' | 'bottom', e: React.PointerEvent, size: number) => {
    e.preventDefault()
    e.stopPropagation()
    layoutDrag.current = {
      kind,
      start: kind === 'bottom' ? e.clientY : e.clientX,
      size,
    }
    document.body.classList.add('resizing-layout')
    document.body.dataset.resizeKind = kind
  }

  return (
    <div
      className="app"
      data-theme={theme}
      style={{ gridTemplateRows: `52px 1fr ${statusH}px` }}
    >
      <header className="topbar">
        <div className="brand">
          Archify <span>Editor</span>
        </div>
        <select
          className="type-select"
          value={isFlowchart(diagram) ? 'flowchart' : architectureMode(diagram) === 'layered' ? 'layered' : 'architecture'}
          onChange={(e) => switchType(e.target.value as 'flowchart' | 'architecture' | 'layered')}
        >
          <option value="flowchart">Flowchart</option>
          <option value="architecture">Architecture</option>
          <option value="layered">Architecture · Layered</option>
        </select>
        <button type="button" onClick={() => load(emptyFlowchart())}>
          新建流程
        </button>
        <button type="button" onClick={() => load(emptyArchitecture('free'))}>
          新建架构
        </button>
        <input
          ref={importFileRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            void onImportFileChange(f)
            e.target.value = ''
          }}
        />
        <FormatMenu
          label="导入"
          title="先选择格式，再选择文件（或粘贴）"
          items={IMPORT_FORMATS}
          onPick={onImportFormat}
        />
        <FormatMenu
          label="导出"
          primary
          title="先选择导出格式"
          items={exportFormatsFor(diagram.diagram_type)}
          onPick={(id) => void onExportFormat(id)}
        />
        <button
          type="button"
          className="primary"
          disabled={(isFlowchart(diagram) ? diagram.nodes.length : diagram.components.length) < 2}
          title="按 Archify HTML 重排：包含关系外层更大，没有包含关系的框之间留出缝"
          onClick={() => {
            pushUndo()
            setDiagram((current) => beautifyDiagram(current))
            setStatus('已美化：外层框包住内层，其余框之间留出缝')
          }}
        >
          美化
        </button>
        {isFlowchart(diagram) ? (
          <div className="line-style" role="group" aria-label="连线样式">
            <span className="line-style-label">连线</span>
            {(
              [
                { route: 'straight', label: '直线', d: 'M 3 12 L 21 2' },
                { route: 'ortho', label: '折线', d: 'M 3 12 L 11 12 L 11 2 L 21 2' },
                { route: 'curve', label: '曲线', d: 'M 3 12 C 10 12 12 2 21 2' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.route}
                type="button"
                className={defaultEdgeRoute === opt.route ? 'active' : ''}
                aria-pressed={defaultEdgeRoute === opt.route}
                aria-label={opt.label}
                title={`${opt.label}连接${
                  selection?.kind === 'edge' ? '（点击立即应用到所选连线）' : '（新建连线默认样式）'
                }`}
                onClick={() => {
                  setDefaultEdgeRoute(opt.route)
                  if (selection?.kind === 'edge' && selectedEdge) {
                    pushUndo()
                    patchEdge(selectedEdge.id, { route: opt.route })
                    setStatus(`已将所选连线改为${opt.label}`)
                  } else {
                    setStatus(`新连线默认使用${opt.label}`)
                  }
                }}
              >
                <svg width="24" height="14" viewBox="0 0 24 14" aria-hidden>
                  <path
                    d={opt.d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{opt.label}</span>
              </button>
            ))}
            {drawTool ? <span className="draw-hint">在画布拖拽绘制 · Esc 退出</span> : null}
          </div>
        ) : null}
        {!isFlowchart(diagram) && drawTool ? (
          <span className="draw-hint">在画布拖拽绘制 · Esc 退出</span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setDrawTool(null)
            setLinkFrom((v) => (v ? null : selectedNode?.id ?? 'pick'))
          }}
        >
          {linkFrom ? '取消连线' : '连线模式'}
        </button>
        <button
          type="button"
          className={`format-brush${styleBrush ? ' active' : ''}`}
          title="格式刷：先选中图形或连线，再点此按钮，然后点击其它同类对象复制样式（Esc 退出）"
          onClick={() => {
            if (styleBrush) {
              setStyleBrush(null)
              setStatus('已退出格式刷')
              return
            }
            if (selection?.kind === 'edge' && selectedEdge) {
              const resolved = resolveLineStyle(
                selectedEdge.style,
                'variant' in selectedEdge && selectedEdge.variant === 'emphasis',
                theme,
              )
              setStyleBrush({
                kind: 'edge',
                style: snapshotLineStyle(selectedEdge.style, resolved),
              })
              setLinkFrom(null)
              setStatus('格式刷：点击其它连线应用线色/宽/虚实/标签底（Esc 退出）')
              return
            }
            const id = primaryNodeId(selection)
            if (!id || !selectedNode) {
              setStatus('请先选中一个图形或连线再点格式刷')
              return
            }
            const key = 'type' in selectedNode ? selectedNode.type : selectedNode.shape
            const resolved = resolveNodeStyle(
              'type' in selectedNode ? 'architecture' : 'flowchart',
              key,
              selectedNode.style,
              theme,
            )
            setStyleBrush({ kind: 'node', style: snapshotBoxStyle(selectedNode.style, resolved) })
            setLinkFrom(null)
            setStatus('格式刷：点击其它图形应用样式（Esc 退出）')
          }}
        >
          格式刷
        </button>
        <button
          type="button"
          title="快捷键一览（? / F1）"
          aria-expanded={showShortcuts}
          onClick={() => setShowShortcuts((v) => !v)}
        >
          快捷键
        </button>
        <button type="button" disabled={!undo.length} onClick={() => undoOnce()} title="Ctrl+Z">
          撤销
        </button>
        <button type="button" disabled={!redo.length} onClick={() => redoOnce()} title="Ctrl+Y">
          重做
        </button>
        <button type="button" className="danger" disabled={!selection} onClick={removeSelected}>
          删除
        </button>
        <AlignMenu
          canAlign={selectedNodeIds.length >= 2}
          canDistribute={selectedNodeIds.length >= 3 || selectedLaneIds.length >= 1}
          onAction={(action) => {
            if (action.kind === 'align') alignSelected(action.axis)
            else distributeSelected(action.axis)
          }}
        />
        <div className="spacer" />
        <select
          className="type-select"
          value={theme}
          title="画布主题"
          onChange={(e) => setTheme(e.target.value as ThemeMode)}
        >
          <option value="dark">黑夜</option>
          <option value="light">白天</option>
        </select>
        <button type="button" onClick={() => void copyCmd()}>
          复制 Finalize 命令
        </button>
      </header>

      <div
        className="workspace"
        style={{ gridTemplateColumns: `${paletteW}px 6px 1fr 6px ${inspectorW}px` }}
      >
        <aside className="palette">
          <Palette
            diagram={diagram}
            onAddFlow={addFlow}
            onAddBoundary={() => {
              setLinkFrom(null)
              setDrawTool((v) => (v === 'boundary' ? null : 'boundary'))
              setStatus('区域框：在画布拖拽绘制（也可选中节点后右键新建）')
            }}
            onDrawLine={(route) => {
              setDefaultEdgeRoute(route)
              setLinkFrom(null)
              setDrawTool((v) => (v === route ? null : route))
              setStatus(
                `${
                  route === 'ortho' ? '折线' : route === 'curve' ? '曲线' : '直线'
                }：在画布空白处拖拽放置独立线`,
              )
            }}
            onAddLayer={addLayer}
            onRenameLayer={renameLayer}
            onRemoveLayer={removeLayer}
            onSetLaneOrientation={setLaneOrientation}
            layerEdgeRule={layerEdgeRule}
            layerEdgeViolationCount={layerViolations.length}
            onSetLayerEdgeRule={(rule) => {
              if (!isArchitecture(diagram)) return
              pushUndo()
              setDiagram((d) => (isArchitecture(d) ? setLayerEdgeRule(d, rule) : d))
              setStatus(
                rule === 'downward'
                  ? '已开启：仅允许上层→下层（违规边高亮）'
                  : '已关闭跨层连线校验',
              )
            }}
          />
        </aside>
        <div
          className="layout-split layout-split-v"
          title="拖拽调整左侧宽度"
          onPointerDown={(e) => startLayoutDrag('left', e, paletteW)}
        />
        <div className="canvas-wrap">
          {colorTagsOf(diagram).length ? (
            <div className="color-legend" aria-label="色标图例">
              {colorTagsOf(diagram).map((tag) => (
                <span key={tag.id} className="color-legend-item">
                  <i style={{ background: tag.fill, borderColor: tag.stroke }} />
                  {tag.label}
                </span>
              ))}
            </div>
          ) : null}
          <div
            className="layout-split layout-split-h"
            title="拖拽调整下侧高度"
            onPointerDown={(e) => startLayoutDrag('bottom', e, statusH)}
          />
          <Canvas
            diagram={diagram}
            selection={selection}
            linkFrom={linkFrom}
            theme={theme}
            showGrid={showGrid}
            snapToGrid={snapToGrid}
            fitEpoch={fitEpoch}
            onSelect={setSelection}
            onMove={onMove}
            onMoveGroup={onMoveGroup}
            onResize={onResize}
            drawTool={drawTool}
            onAddLine={onAddLine}
            onAddBoundaryRect={onAddBoundaryRect}
            onLinePoints={(id, points) => patchLine(id, { points })}
            onBoundaryPad={(index, next, rect) => {
              setDiagram((d) => ({
                ...d,
                boundaries: (d.boundaries ?? []).map((b, i) =>
                  i === index
                    ? {
                        ...b,
                        ...(rect ? { pos: rect.pos, size: rect.size } : {}),
                        ...(next.padLeft === undefined ? {} : { padLeft: next.padLeft }),
                        ...(next.padRight === undefined ? {} : { padRight: next.padRight }),
                        ...(next.padTop === undefined ? {} : { padTop: next.padTop }),
                        ...(next.padBottom === undefined ? {} : { padBottom: next.padBottom }),
                        ...(next.padX === undefined ? {} : { padX: next.padX }),
                        ...(next.padY === undefined ? {} : { padY: next.padY }),
                        ...(next.pad === undefined ? {} : { pad: next.pad }),
                      }
                    : b,
                ),
              }))
            }}
            onConnect={onConnect}
            onConnectToEmpty={onConnectToEmpty}
            onLinkPick={(id) => setLinkFrom(id)}
            onEdgeLabel={(id, label) => patchEdge(id, { label })}
            onNodeLabel={(id, label) => patchNode(id, { label })}
            onEdgeVia={(id, via) =>
              patchEdge(id, { via, route: isFlowchart(diagram) ? 'ortho' : 'orthogonal-h' })
            }
            onEdgeLabelOffset={(id, labelOffset) => patchEdge(id, { labelOffset })}
            styleBrushActive={Boolean(styleBrush)}
            styleBrushKind={styleBrush?.kind ?? null}
            onStyleBrushApply={(id) => {
              if (!styleBrush || styleBrush.kind !== 'node') return
              pushUndo()
              setDiagram((d) => paintNodes(d, [id], styleBrush.style))
              setSelection(selectOnlyNode(id))
              setStatus('已应用格式刷样式')
            }}
            onStyleBrushApplyEdge={(id) => {
              if (!styleBrush || styleBrush.kind !== 'edge') return
              pushUndo()
              setDiagram((d) => paintEdges(d, [id], styleBrush.style))
              setSelection({ kind: 'edge', id })
              setStatus('已应用连线格式刷')
            }}
            onDropPalette={(payload, pos) => {
              if (payload.kind === 'flow') addFlow(payload.shape, pos)
              else if (payload.kind === 'arch') addArch(payload.type, pos)
              else if (payload.kind === 'boundary') {
                const size: Size = [320, 200]
                onAddBoundaryRect([pos[0] - size[0] / 2, pos[1] - size[1] / 2], size)
              } else {
                onAddLine(payload.route, [pos[0] - 70, pos[1]], [pos[0] + 70, pos[1]])
              }
            }}
            onLaneGeometry={({ layerId, height, width, laneWidth }) => {
              setDiagram((d) => {
                const layers = d.meta.editor?.layers
                if (!layers?.length) return d
                return {
                  ...d,
                  meta: {
                    ...d.meta,
                    editor: {
                      ...d.meta.editor,
                      ...(typeof laneWidth === 'number' ? { laneWidth } : {}),
                      layers: layers.map((l) =>
                        l.id === layerId
                          ? {
                              ...l,
                              ...(typeof height === 'number' ? { height } : {}),
                              ...(typeof width === 'number' ? { width } : {}),
                              ...(typeof laneWidth === 'number' ? { width: laneWidth } : {}),
                            }
                          : typeof laneWidth === 'number'
                            ? { ...l, width: laneWidth }
                            : l,
                      ),
                    },
                  },
                }
              })
            }}
            onContextMenu={openContextMenu}
            layerEdgeViolationIds={layerEdgeViolationIds}
          />
          {isArchitecture(diagram) ? (
            <ArchCards
              cards={diagram.cards ?? []}
              selectedIndex={cardIndex}
              onSelect={setCardIndex}
              onAdd={() => {
                pushUndo()
                setDiagram((d) => (isArchitecture(d) ? addCard(d) : d))
                setCardIndex((diagram.cards ?? []).length)
                setStatus('已新增摘要卡')
              }}
              onRemove={(index) => {
                pushUndo()
                setDiagram((d) => (isArchitecture(d) ? removeCard(d, index) : d))
                setCardIndex(null)
                setStatus('已删除摘要卡')
              }}
              onPatch={(index, patch) => {
                setDiagram((d) => (isArchitecture(d) ? updateCard(d, index, patch) : d))
              }}
            />
          ) : null}
        </div>
        <div
          className="layout-split layout-split-v"
          title="拖拽调整右侧宽度"
          onPointerDown={(e) => startLayoutDrag('right', e, inspectorW)}
        />
        <aside className="inspector">
          <p className="panel-title">属性</p>
          <Inspector
            diagram={diagram}
            theme={theme}
            selectedNode={selectedNode}
            selectedCount={selectedNodeIds.length}
            selectedIds={selectedNodeIds}
            selectedBoundaryCount={boundaryIndexesOf(selection).length}
            selectedLaneCount={laneIdsOf(selection).length}
            selectedEdge={selectedEdge}
            selectedLine={selectedLine}
            selectedBoundary={selectedBoundary}
            selectedBoundaryIndex={primaryBoundaryIndex(selection)}
            onMeta={(patch) => setDiagram((d) => ({ ...d, meta: { ...d.meta, ...patch } }))}
            onNode={(id, patch) => {
              const ids = nodeIdsOf(selection)
              const boundIdx = boundaryIndexesOf(selection)
              const laneIds = laneIdsOf(selection)
              // 多选统一宽/高（只改图形节点，不含泳道）
              if (
                ids.length > 1 &&
                (typeof patch.width === 'number' || typeof patch.height === 'number')
              ) {
                pushUndo()
                setDiagram((d) =>
                  batchResizeNodes(d, ids, {
                    width: typeof patch.width === 'number' ? patch.width : undefined,
                    height: typeof patch.height === 'number' ? patch.height : undefined,
                  }),
                )
                setStatus(`已统一修改 ${ids.length} 个图形尺寸`)
                return
              }
              // 多选节点，或 Ctrl+A（节点+区域框/泳道）：统一样式/形状
              const batchStyle =
                (ids.length > 1 || boundIdx.length > 0 || laneIds.length > 0) &&
                ids.length >= 1 &&
                (patch.style != null || patch.shape != null || patch.type != null)
              if (batchStyle) {
                pushUndo()
                const stylePatch = patch.style as BoxStyle | undefined
                setDiagram((d) => {
                  let next: AnyDiagram = stylePatch ? paintNodes(d, ids, stylePatch) : d
                  const rest: Record<string, unknown> = { ...patch }
                  delete rest.style
                  if (Object.keys(rest).length) {
                    if (isFlowchart(next)) {
                      next = {
                        ...next,
                        nodes: next.nodes.map((n) =>
                          ids.includes(n.id) ? ({ ...n, ...rest } as FlowchartNode) : n,
                        ),
                      }
                    } else if (isArchitecture(next)) {
                      next = {
                        ...next,
                        components: next.components.map((c) =>
                          ids.includes(c.id) ? ({ ...c, ...rest } as ArchifyComponent) : c,
                        ),
                      }
                    }
                  }
                  // Ctrl+A / 全选：填充、线型、字号、描边等同步到选中区域框与泳道
                  if (stylePatch && boundIdx.length) {
                    next = paintBoundaries(next, boundIdx, stylePatch)
                  }
                  if (stylePatch && laneIds.length) {
                    next = paintLanes(next, laneIds, stylePatch)
                  }
                  return next
                })
                const sp = patch.style as BoxStyle | undefined
                const syncBoxes =
                  !!sp &&
                  (sp.fill !== undefined ||
                    sp.fontSize != null ||
                    sp.subFontSize != null ||
                    sp.text != null ||
                    sp.stroke != null ||
                    sp.strokeWidth != null ||
                    sp.fontWeight != null ||
                    sp.fontStyle != null ||
                    sp.strokeDasharray !== undefined)
                const parts = [`${ids.length} 个图形`]
                if (boundIdx.length && syncBoxes) parts.push(`${boundIdx.length} 个区域框`)
                if (laneIds.length && syncBoxes) parts.push(`${laneIds.length} 个泳道框体`)
                setStatus(`已统一修改 ${parts.join('、')}`)
                return
              }
              if (patch.style) {
                const style = (
                  selectedNode && 'style' in selectedNode
                    ? mergeStyle(selectedNode.style, patch.style as object)
                    : patch.style
                ) as BoxStyle
                const rest = { ...patch }
                delete rest.style
                setDiagram((d) => {
                  const painted = paintNodes(d, [id], style)
                  if (!Object.keys(rest).length) return painted
                  if (isFlowchart(painted)) {
                    return {
                      ...painted,
                      nodes: painted.nodes.map((n) => (n.id === id ? ({ ...n, ...rest } as FlowchartNode) : n)),
                    }
                  }
                  if (!isArchitecture(painted)) return painted
                  return {
                    ...painted,
                    components: painted.components.map((c) =>
                      c.id === id ? ({ ...c, ...rest } as ArchifyComponent) : c,
                    ),
                  }
                })
                return
              }
              patchNode(id, patch)
            }}
            onBindTag={(ids, tagId) => {
              pushUndo()
              setDiagram((d) => bindColorTag(d, ids, tagId))
            }}
            onCreateTag={(ids) => {
              const sampleId = ids[0]
              const node = isFlowchart(diagram)
                ? diagram.nodes.find((n) => n.id === sampleId)
                : isArchitecture(diagram)
                  ? diagram.components.find((n) => n.id === sampleId)
                  : undefined
              const label = window.prompt('色标名称', '待审核')
              if (!label?.trim()) return
              const flowShape = node && 'shape' in node ? node.shape : undefined
              const archType = node && 'type' in node ? node.type : undefined
              const style = flowShape
                ? resolveNodeStyle('flowchart', flowShape, node?.style, theme)
                : archType
                  ? resolveNodeStyle('architecture', archType, node?.style, theme)
                  : undefined
              const tag = createColorTag(nextId('tag'), label, style)
              pushUndo()
              setDiagram((d) => bindColorTag(upsertColorTag(d, tag), ids, tag.id))
              setStatus(`已创建色标「${label.trim()}」`)
            }}
            onRenameTag={(tagId, label) => {
              setDiagram((d) => {
                const tag = colorTagsOf(d).find((item) => item.id === tagId)
                if (!tag) return d
                return upsertColorTag(d, { ...tag, label })
              })
            }}
            onEdge={(id, patch) => {
              const next = { ...patch }
              if (next.style && selectedEdge && 'style' in selectedEdge) {
                next.style = mergeStyle(selectedEdge.style, next.style as object)
              }
              patchEdge(id, next)
            }}
            onLine={(id, patch) => patchLine(id, patch)}
            onBoundary={(index, patch) => patchBoundary(index, patch)}
            onBoundaryStyle={(index, patch) => {
              setDiagram((d) => {
                const b = d.boundaries?.[index]
                if (!b) return d
                return setBoundaryStyle(d, b.label, patch)
              })
            }}
            onAssignLayer={(id, index) => {
              if (!isArchitecture(diagram)) return
              pushUndo()
              setDiagram((d) => (isArchitecture(d) ? assignComponentLayer(d, id, index) : d))
            }}
          />
        </aside>
      </div>

      <ContextMenu
        menu={ctxMenu}
        theme={theme}
        showGrid={showGrid}
        snapToGrid={snapToGrid}
        multiNodeCount={selectedNodeIds.length}
        canPaste={Boolean(clipboard)}
        styles={ctxStyles}
        onClose={() => setCtxMenu(null)}
        onAction={handleContextAction}
      />

      {showShortcuts ? (
        <div
          className="shortcuts-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="快捷键一览"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-head">
              <strong>快捷键</strong>
              <button type="button" onClick={() => setShowShortcuts(false)}>
                关闭
              </button>
            </div>
            <ul className="shortcuts-list">
              <li>
                <kbd>Delete</kbd> / <kbd>Backspace</kbd>
                <span>删除选中</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>Z</kbd>
                <span>撤销</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>Y</kbd>
                <span>重做</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd> / <kbd>D</kbd>
                <span>复制 / 剪切 / 粘贴 / 副本</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>A</kbd>
                <span>全选</span>
              </li>
              <li>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <kbd>←</kbd>
                <kbd>→</kbd>
                <span>微调（Shift = 10px）</span>
              </li>
              <li>
                <kbd>Esc</kbd>
                <span>退出格式刷 / 取消连线 / 退出绘制工具 / 关闭本面板</span>
              </li>
              <li>
                <kbd>空格</kbd>+拖
                <span>平移画布</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+滚轮 / <kbd>+</kbd>
                <kbd>-</kbd>
                <kbd>0</kbd>
                <span>缩放 / 复位</span>
              </li>
              <li>
                <kbd>Shift</kbd>+缩放柄
                <span>等比缩放</span>
              </li>
              <li>
                <kbd>Alt</kbd>+拖
                <span>临时关闭网格/对齐吸附</span>
              </li>
              <li>
                <kbd>双击节点</kbd>
                <span>编辑文字（Enter 换行）</span>
              </li>
              <li>
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
                <span>文字编辑结束</span>
              </li>
              <li>
                <kbd>?</kbd> / <kbd>F1</kbd>
                <span>打开 / 关闭本面板</span>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <SaveAsDialog
        request={saveAsRequest}
        onClose={() => setSaveAsRequest(null)}
        onSaved={(message) => {
          setStatus(message)
          setSaveAsRequest(null)
        }}
      />

      <footer className="status">
        <span>{modeLabel}</span>
        <span>
          {isFlowchart(diagram)
            ? `nodes ${diagram.nodes.length} / edges ${diagram.edges.length}`
            : `nodes ${diagram.components.length} / edges ${(diagram.connections ?? []).length}`}
        </span>
        <span>{linkFrom ? `连线中: ${linkFrom === 'pick' ? '先点源节点' : linkFrom}` : status}</span>
        <span style={{ marginLeft: 'auto' }}>
          Finalize CLI {cliOk == null ? '…' : cliOk ? '可用' : '不可用（可用复制命令）'}
        </span>
      </footer>
    </div>
  )
}
