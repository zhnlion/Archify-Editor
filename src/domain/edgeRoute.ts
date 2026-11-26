import type { Point, Size } from '../types'

/** 流程图 IR 路由（直线 / 折线 / 曲线） */
export type FlowEdgeRoute = 'straight' | 'ortho' | 'curve'

/** 架构图 Archify 合法路由 + 编辑器曲线 */
export type ArchEdgeRoute = 'auto' | 'straight' | 'orthogonal-h' | 'orthogonal-v' | 'curve'

export type AnyEdgeRoute = FlowEdgeRoute | ArchEdgeRoute | string

export type Side = 'n' | 's' | 'e' | 'w'

export function inferSide(pt: Point, pos: Point, size: Size): Side {
  const [x, y] = pt
  const left = pos[0]
  const right = pos[0] + size[0]
  const top = pos[1]
  const bottom = pos[1] + size[1]
  const dl = Math.abs(x - left)
  const dr = Math.abs(x - right)
  const dt = Math.abs(y - top)
  const db = Math.abs(y - bottom)
  const m = Math.min(dl, dr, dt, db)
  if (m === dl) return 'w'
  if (m === dr) return 'e'
  if (m === dt) return 'n'
  return 's'
}

function sideUnit(side: Side): Point {
  if (side === 'e') return [1, 0]
  if (side === 'w') return [-1, 0]
  if (side === 's') return [0, 1]
  return [0, -1]
}

function almostEqual(a: number, b: number, eps = 1.5) {
  return Math.abs(a - b) < eps
}

/** 正交折线：优先与 Archify HTML 正交箭头观感一致（HVH / VHV） */
export function orthoPoints(
  start: Point,
  end: Point,
  prefer: 'h' | 'v' | 'auto' = 'auto',
  fromSide?: Side,
): Point[] {
  const [x0, y0] = start
  const [x1, y1] = end
  if (almostEqual(x0, x1) || almostEqual(y0, y1)) return [start, end]

  let mode: 'h' | 'v' = prefer === 'auto' ? 'h' : prefer
  if (prefer === 'auto') {
    if (fromSide === 'n' || fromSide === 's') mode = 'v'
    else if (fromSide === 'e' || fromSide === 'w') mode = 'h'
    else mode = Math.abs(x1 - x0) >= Math.abs(y1 - y0) ? 'h' : 'v'
  }

  if (mode === 'h') {
    const mx = Math.round((x0 + x1) / 2)
    return [start, [mx, y0], [mx, y1], end]
  }
  const my = Math.round((y0 + y1) / 2)
  return [start, [x0, my], [x1, my], end]
}

export function pointsToPath(points: Point[]): string {
  if (!points.length) return ''
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
    .join(' ')
}

export function curvePath(start: Point, end: Point, fromSide?: Side, toSide?: Side): string {
  const dist = Math.hypot(end[0] - start[0], end[1] - start[1])
  const pull = Math.max(40, Math.min(160, dist * 0.45))
  const out = sideUnit(fromSide ?? (end[0] >= start[0] ? 'e' : 'w'))
  const inn = sideUnit(toSide ?? (start[0] >= end[0] ? 'e' : 'w'))
  const cp1: Point = [Math.round(start[0] + out[0] * pull), Math.round(start[1] + out[1] * pull)]
  const cp2: Point = [Math.round(end[0] + inn[0] * pull), Math.round(end[1] + inn[1] * pull)]
  return `M ${start[0]} ${start[1]} C ${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${end[0]} ${end[1]}`
}

export function midpointOfPoints(points: Point[]): Point {
  if (points.length < 2) return points[0] ?? [0, 0]
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1])
    segs.push(len)
    total += len
  }
  let remain = total / 2
  for (let i = 1; i < points.length; i++) {
    const len = segs[i - 1]!
    if (remain <= len) {
      const t = len === 0 ? 0 : remain / len
      const a = points[i - 1]!
      const b = points[i]!
      return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t) - 12]
    }
    remain -= len
  }
  const last = points[points.length - 1]!
  return [last[0], last[1] - 12]
}

export function resolveFlowRoute(route?: string | null): FlowEdgeRoute {
  if (route === 'straight' || route === 'curve') return route
  return 'ortho'
}

/** Archify workflow 边 route → 流程图 IR */
export function mapWorkflowRouteToFlow(route?: string | null): FlowEdgeRoute {
  if (route === 'straight') return 'straight'
  return 'ortho'
}

/** 架构图：缺省 / auto 按 Archify HTML 正交默认 */
export function resolveArchRoute(route?: string | null): 'straight' | 'orthogonal-h' | 'orthogonal-v' | 'curve' {
  if (route === 'straight' || route === 'orthogonal-h' || route === 'orthogonal-v' || route === 'curve') {
    return route
  }
  return 'orthogonal-h'
}

export function buildEdgeGeometry(opts: {
  route?: string | null
  kind: 'flowchart' | 'architecture'
  start: Point
  end: Point
  fromPos: Point
  fromSize: Size
  toPos: Point
  toSize: Size
  /** 用户拖拽的中间拐点 */
  via?: Point[] | null
  fromSide?: Side | string | null
  toSide?: Side | string | null
}): { d: string; labelAt: Point; points: Point[] } {
  const fromSide =
    (opts.fromSide as Side | undefined) || inferSide(opts.start, opts.fromPos, opts.fromSize)
  const toSide = (opts.toSide as Side | undefined) || inferSide(opts.end, opts.toPos, opts.toSize)
  const via = (opts.via ?? []).filter((p) => Array.isArray(p) && p.length >= 2) as Point[]

  if (via.length) {
    // 保证与端点正交衔接（避免 round 端点导致微斜，进而丢掉竖段手柄）
    const points = ensureOrthoPolyline([opts.start, ...via, opts.end])
    return { d: pointsToPath(points), labelAt: midpointOfPoints(points), points }
  }

  if (opts.kind === 'flowchart') {
    const r = resolveFlowRoute(opts.route)
    if (r === 'straight') {
      const points = [opts.start, opts.end]
      return { d: pointsToPath(points), labelAt: midpointOfPoints(points), points }
    }
    if (r === 'curve') {
      const d = curvePath(opts.start, opts.end, fromSide, toSide)
      const mid: Point = [
        Math.round((opts.start[0] + opts.end[0]) / 2),
        Math.round((opts.start[1] + opts.end[1]) / 2) - 12,
      ]
      return { d, labelAt: mid, points: [opts.start, opts.end] }
    }
    const points = orthoPoints(opts.start, opts.end, 'auto', fromSide)
    return { d: pointsToPath(points), labelAt: midpointOfPoints(points), points }
  }

  const r = resolveArchRoute(opts.route)
  if (r === 'straight') {
    const points = [opts.start, opts.end]
    return { d: pointsToPath(points), labelAt: midpointOfPoints(points), points }
  }
  if (r === 'curve') {
    const d = curvePath(opts.start, opts.end, fromSide, toSide)
    const mid: Point = [
      Math.round((opts.start[0] + opts.end[0]) / 2),
      Math.round((opts.start[1] + opts.end[1]) / 2) - 12,
    ]
    return { d, labelAt: mid, points: [opts.start, opts.end] }
  }
  const prefer = r === 'orthogonal-v' ? 'v' : 'h'
  const points = orthoPoints(opts.start, opts.end, prefer, fromSide)
  return { d: pointsToPath(points), labelAt: midpointOfPoints(points), points }
}

/** finalize 前：曲线非 Archify 枚举，映射为 auto */
export function sanitizeArchRouteForFinalize(route?: string): string | undefined {
  if (!route || route === 'curve') return undefined
  if (route === 'auto' || route === 'straight' || route === 'orthogonal-h' || route === 'orthogonal-v') {
    return route
  }
  return undefined
}

export function defaultNewFlowRoute(): FlowEdgeRoute {
  // 与 Archify HTML 默认正交折线一致
  return 'ortho'
}

/** 中段拖动手柄（拖整段，保持正交） */
export type OrthoSegHandle = {
  segIndex: number
  mid: Point
  /** 该段走向：h=水平（拖动改 Y），v=竖直（拖动改 X） */
  axis: 'h' | 'v'
}

/** 与 edgeEndpoints 一致保留 0.1px，避免 589.5→590 造成微斜丢手柄 */
function quantize(n: number): number {
  return Math.round(n * 10) / 10
}

function clonePts(points: Point[]): Point[] {
  return points.map((p) => [quantize(p[0]), quantize(p[1])] as Point)
}

function snapViaToAnchors(points: Point[], start: Point, end: Point): Point[] {
  if (points.length < 2) return points
  const out = clonePts(points)
  out[0] = [start[0], start[1]]
  out[out.length - 1] = [end[0], end[1]]
  for (let i = 1; i < out.length - 1; i++) {
    const p = out[i]!
    if (almostEqual(p[0], start[0])) p[0] = start[0]
    if (almostEqual(p[1], start[1])) p[1] = start[1]
    if (almostEqual(p[0], end[0])) p[0] = end[0]
    if (almostEqual(p[1], end[1])) p[1] = end[1]
  }
  return out
}

/** 去掉重合点与共线中间点，保持首尾 */
export function collapseOrthoPoints(points: Point[]): Point[] {
  if (points.length <= 2) return clonePts(points)
  const out: Point[] = []
  for (const p of points) {
    const cur: Point = [quantize(p[0]), quantize(p[1])]
    const prev = out[out.length - 1]
    if (prev && almostEqual(prev[0], cur[0]) && almostEqual(prev[1], cur[1])) continue
    out.push(cur)
  }
  let i = 1
  while (i < out.length - 1) {
    const a = out[i - 1]!
    const b = out[i]!
    const c = out[i + 1]!
    const colinearH = almostEqual(a[1], b[1]) && almostEqual(b[1], c[1])
    const colinearV = almostEqual(a[0], b[0]) && almostEqual(b[0], c[0])
    if (colinearH || colinearV) {
      out.splice(i, 1)
      continue
    }
    i++
  }
  return out
}

/** 列出正交折线各段中点手柄；过短或非正交段跳过 */
export function listOrthoSegmentHandles(points: Point[], minLen = 12): OrthoSegHandle[] {
  const handles: OrthoSegHandle[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < minLen) continue
    const horizontal = almostEqual(a[1], b[1])
    const vertical = almostEqual(a[0], b[0])
    if (!horizontal && !vertical) continue
    handles.push({
      segIndex: i,
      mid: [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)],
      axis: horizontal ? 'h' : 'v',
    })
  }
  return handles
}

/**
 * 拖动正交折线第 segIndex 段，使该段经过 pointer（沿法向平移）。
 * 端点锚点（首尾）固定；必要时在端点旁插入 stub，以保持从节点引出的正交约束。
 * @returns 新的 via（不含首尾锚点）
 */
export function moveOrthoSegment(points: Point[], segIndex: number, pointer: Point): Point[] {
  if (points.length < 2) return []
  const start = points[0]!
  const end = points[points.length - 1]!
  let pts = clonePts(points)

  // 仅两端且共线：先展开成可拖的折线骨架
  if (pts.length === 2) {
    const expanded = orthoPoints(pts[0]!, pts[1]!, 'auto')
    if (expanded.length > 2) {
      pts = clonePts(expanded)
    } else {
      const a = pts[0]!
      const b = pts[1]!
      if (almostEqual(a[1], b[1])) {
        const y = Math.round(pointer[1])
        pts = [a, [a[0], y], [b[0], y], b]
      } else {
        const x = Math.round(pointer[0])
        pts = [a, [x, a[1]], [x, b[1]], b]
      }
      pts[0] = [start[0], start[1]]
      pts[pts.length - 1] = [end[0], end[1]]
      return collapseOrthoPoints(pts).slice(1, -1)
    }
  }

  if (segIndex < 0 || segIndex >= pts.length - 1) {
    return collapseOrthoPoints(pts).slice(1, -1)
  }

  const a = pts[segIndex]!
  const b = pts[segIndex + 1]!
  let horizontal = almostEqual(a[1], b[1])
  let vertical = almostEqual(a[0], b[0])
  if (!horizontal && !vertical) {
    horizontal = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])
    vertical = !horizontal
  }

  const isFirst = segIndex === 0
  const isLast = segIndex === pts.length - 2

  if (horizontal) {
    const newY = Math.round(pointer[1])
    if (isFirst && isLast) {
      pts = [pts[0]!, [pts[0]![0], newY], [pts[1]![0], newY], pts[1]!]
    } else if (isFirst) {
      const oldA = pts[1]!
      pts[1] = [oldA[0], newY]
      pts.splice(1, 0, [pts[0]![0], newY])
    } else if (isLast) {
      const zIdx = pts.length - 2
      const oldZ = pts[zIdx]!
      pts[zIdx] = [oldZ[0], newY]
      pts.splice(pts.length - 1, 0, [pts[pts.length - 1]![0], newY])
    } else {
      pts[segIndex] = [a[0], newY]
      pts[segIndex + 1] = [b[0], newY]
    }
  } else {
    const newX = Math.round(pointer[0])
    if (isFirst && isLast) {
      pts = [pts[0]!, [newX, pts[0]![1]], [newX, pts[1]![1]], pts[1]!]
    } else if (isFirst) {
      const oldA = pts[1]!
      pts[1] = [newX, oldA[1]]
      pts.splice(1, 0, [newX, pts[0]![1]])
    } else if (isLast) {
      const zIdx = pts.length - 2
      const oldZ = pts[zIdx]!
      pts[zIdx] = [newX, oldZ[1]]
      pts.splice(pts.length - 1, 0, [newX, pts[pts.length - 1]![1]])
    } else {
      pts[segIndex] = [newX, a[1]]
      pts[segIndex + 1] = [newX, b[1]]
    }
  }

  pts[0] = [start[0], start[1]]
  pts[pts.length - 1] = [end[0], end[1]]
  return snapViaToAnchors(collapseOrthoPoints(pts), start, end).slice(1, -1)
}

/** 相邻点若成斜线，插入 L 拐角，保证全路径正交 */
export function ensureOrthoPolyline(points: Point[]): Point[] {
  if (points.length < 2) return clonePts(points)
  const out: Point[] = [[quantize(points[0]![0]), quantize(points[0]![1])]]
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]!
    const cur: Point = [quantize(points[i]![0]), quantize(points[i]![1])]
    if (almostEqual(prev[0], cur[0]) && almostEqual(prev[1], cur[1])) continue
    if (almostEqual(prev[0], cur[0]) || almostEqual(prev[1], cur[1])) {
      out.push(cur)
      continue
    }
    // 斜线 → HV 拐角（优先水平先行）
    out.push([cur[0], prev[1]])
    out.push(cur)
  }
  return collapseOrthoPoints(out)
}

/**
 * 拖动拐点（via 下标）；写回后保证折线正交（斜连处自动补 L）。
 * @param points 含首尾的完整折线
 * @param viaIndex via 数组下标（对应 points[viaIndex+1]）
 */
export function moveOrthoCorner(points: Point[], viaIndex: number, pointer: Point): Point[] {
  if (points.length < 3) return []
  const abs = viaIndex + 1
  if (abs <= 0 || abs >= points.length - 1) {
    return collapseOrthoPoints(points).slice(1, -1)
  }
  const pts = clonePts(points)
  const start = pts[0]!
  const end = pts[pts.length - 1]!
  pts[abs] = [Math.round(pointer[0]), Math.round(pointer[1])]
  pts[0] = [start[0], start[1]]
  pts[pts.length - 1] = [end[0], end[1]]
  return ensureOrthoPolyline(pts).slice(1, -1)
}
