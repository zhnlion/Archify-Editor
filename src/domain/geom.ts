import type { Handle, Point, Size } from '../types'
import { MIN_SIZE } from '../types'

export function clampSize(size: Size, min: Size = MIN_SIZE): Size {
  return [Math.max(min[0], Math.round(size[0])), Math.max(min[1], Math.round(size[1]))]
}

const CORNER_HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se']

export function applyResize(
  pos: Point,
  size: Size,
  handle: Handle,
  dx: number,
  dy: number,
  min: Size = MIN_SIZE,
  options?: { lockAspect?: boolean },
): { pos: Point; size: Size } {
  const [sx, sy] = pos
  const [sw, sh] = size
  const right = sx + sw
  const bottom = sy + sh

  /** Shift + 四角：锁宽高比，对侧角固定 */
  if (options?.lockAspect && CORNER_HANDLES.includes(handle)) {
    const ratio = sw / Math.max(sh, 1e-6)
    let newW = sw + (handle.includes('e') ? dx : handle.includes('w') ? -dx : 0)
    let newH = sh + (handle.includes('s') ? dy : handle.includes('n') ? -dy : 0)
    const relW = Math.abs(newW - sw) / Math.max(sw, 1)
    const relH = Math.abs(newH - sh) / Math.max(sh, 1)
    if (relW >= relH) {
      newW = Math.max(min[0], newW)
      newH = Math.max(min[1], newW / ratio)
      newW = newH * ratio
    } else {
      newH = Math.max(min[1], newH)
      newW = Math.max(min[0], newH * ratio)
      newH = newW / ratio
    }
    let x = sx
    let y = sy
    if (handle.includes('w')) x = right - newW
    if (handle.includes('n')) y = bottom - newH
    return { pos: [Math.round(x), Math.round(y)], size: clampSize([newW, newH], min) }
  }

  let [x, y] = pos
  let [w, h] = size

  if (handle.includes('e')) w = w + dx
  if (handle.includes('s')) h = h + dy
  if (handle.includes('w')) {
    x = x + dx
    w = w - dx
  }
  if (handle.includes('n')) {
    y = y + dy
    h = h - dy
  }

  if (w < min[0]) {
    if (handle.includes('w')) x = right - min[0]
    w = min[0]
  }
  if (h < min[1]) {
    if (handle.includes('n')) y = bottom - min[1]
    h = min[1]
  }

  return { pos: [Math.round(x), Math.round(y)], size: clampSize([w, h], min) }
}

export function centerOf(pos: Point, size: Size): Point {
  return [pos[0] + size[0] / 2, pos[1] + size[1] / 2]
}

/** 从矩形中心沿方向落到边框上的交点（用于连线箭头不被节点遮挡） */
export function boxBorderPoint(pos: Point, size: Size, toward: Point): Point {
  const cx = pos[0] + size[0] / 2
  const cy = pos[1] + size[1] / 2
  const dx = toward[0] - cx
  const dy = toward[1] - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  const hw = size[0] / 2
  const hh = size[1] / 2
  const sx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Number.POSITIVE_INFINITY
  const sy = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Number.POSITIVE_INFINITY
  const t = Math.min(sx, sy)
  return [cx + dx * t, cy + dy * t]
}

export type AnchorSide = 'n' | 's' | 'e' | 'w'

/** 四边中点锚点（连接点） */
export function sideAnchor(pos: Point, size: Size, side: AnchorSide): Point {
  const [x, y] = pos
  const [w, h] = size
  if (side === 'n') return [x + w / 2, y]
  if (side === 's') return [x + w / 2, y + h]
  if (side === 'e') return [x + w, y + h / 2]
  return [x, y + h / 2]
}

/** 计算源/目标边框之间的连线端点；endInset 给箭头尖端留空 */
export function edgeEndpoints(
  fromPos: Point,
  fromSize: Size,
  toPos: Point,
  toSize: Size,
  endInset = 10,
  fromSide?: AnchorSide | string | null,
  toSide?: AnchorSide | string | null,
): { start: Point; end: Point } {
  const fromC = centerOf(fromPos, fromSize)
  const toC = centerOf(toPos, toSize)
  const fs = normalizeSide(fromSide)
  const ts = normalizeSide(toSide)
  let start = fs ? sideAnchor(fromPos, fromSize, fs) : boxBorderPoint(fromPos, fromSize, toC)
  let end = ts ? sideAnchor(toPos, toSize, ts) : boxBorderPoint(toPos, toSize, fromC)
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const len = Math.hypot(dx, dy)
  if (len > endInset + 1) {
    const ux = dx / len
    const uy = dy / len
    end = [end[0] - ux * endInset, end[1] - uy * endInset]
  }
  return {
    start: [Math.round(start[0] * 10) / 10, Math.round(start[1] * 10) / 10],
    end: [Math.round(end[0] * 10) / 10, Math.round(end[1] * 10) / 10],
  }
}

function normalizeSide(side?: string | null): AnchorSide | null {
  if (side === 'n' || side === 's' || side === 'e' || side === 'w') return side
  if (side === 'top') return 'n'
  if (side === 'bottom') return 's'
  if (side === 'left') return 'w'
  if (side === 'right') return 'e'
  return null
}

export function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return [clientX, clientY]
  const local = pt.matrixTransform(ctm.inverse())
  return [local.x, local.y]
}

export const BOUNDARY_PAD_MIN = 4
/** 单侧最大内边距；过小会导致左右「拉不动」的错觉（到顶后无反馈） */
export const BOUNDARY_PAD_MAX = 480
export const BOUNDARY_PAD_DEFAULT = 16
/** 外层相对内层额外留白，避免嵌套框视觉重合 */
export const BOUNDARY_NEST_GAP = 10
/** Archify HTML：左右与默认内边距 30；标题轨至少 18+4 */
export const ARCHIFY_BOUNDARY_PAD = 30
/**
 * 区域框上沿最小留白（标题轨）。
 * 原 22；曾加倍到 44，但密集排版（如 SP 兄弟框竖直间距 ~54）会交叉，取 28 折中。
 */
export const ARCHIFY_BOUNDARY_TOP_MIN = 28
/** Archify HTML：底边比其它三边再多 20，给标题和连线留出层次 */
export const ARCHIFY_BOUNDARY_EXTRA_BOTTOM = 20
/** Archify 网格：相邻组件之间的缝，不是包含关系 */
export const ARCHIFY_GAP_X = 30
export const ARCHIFY_GAP_Y = 40

export function boundaryContentBox(
  wraps: string[],
  boxes: Array<{ id: string; pos: Point; size: Size }>,
): { x: number; y: number; w: number; h: number } | null {
  const members = boxes.filter((b) => wraps.includes(b.id))
  if (!members.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const m of members) {
    minX = Math.min(minX, m.pos[0])
    minY = Math.min(minY, m.pos[1])
    maxX = Math.max(maxX, m.pos[0] + m.size[0])
    maxY = Math.max(maxY, m.pos[1] + m.size[1])
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export type BoundaryPadSides = {
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
}

export type BoundaryPadInput =
  | number
  | {
      pad?: number
      padX?: number
      padY?: number
      padLeft?: number
      padRight?: number
      padTop?: number
      padBottom?: number
    }

function clampPad(n: number): number {
  return Math.max(BOUNDARY_PAD_MIN, Math.min(BOUNDARY_PAD_MAX, Math.round(n)))
}

function finitePad(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

/**
 * 分侧内边距：左/右/上/下可独立。
 * 兼容旧 pad / padX / padY（对称展开）。
 */
export function resolvePadSides(input?: BoundaryPadInput): BoundaryPadSides {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const p = clampPad(input)
    return {
      padLeft: p,
      padRight: p,
      padTop: p,
      // 仅给统一 pad 时底边仍至少 EXTRA，对齐 Archify HTML
      padBottom: clampPad(Math.max(p, ARCHIFY_BOUNDARY_EXTRA_BOTTOM)),
    }
  }
  if (input && typeof input === 'object') {
    const base = finitePad(input.pad) ?? BOUNDARY_PAD_DEFAULT
    const padX = finitePad(input.padX) ?? base
    const padY = finitePad(input.padY) ?? base
    const padLeft = clampPad(finitePad(input.padLeft) ?? padX)
    const padRight = clampPad(finitePad(input.padRight) ?? padX)
    const padTop = clampPad(finitePad(input.padTop) ?? padY)
    // 未显式 padBottom 时保持原先固定 EXTRA 底边，避免 padY 把底边撑高导致兄弟框交叉
    const padBottom = clampPad(finitePad(input.padBottom) ?? ARCHIFY_BOUNDARY_EXTRA_BOTTOM)
    return { padLeft, padRight, padTop, padBottom }
  }
  const p = BOUNDARY_PAD_DEFAULT
  return {
    padLeft: p,
    padRight: p,
    padTop: p,
    padBottom: ARCHIFY_BOUNDARY_EXTRA_BOTTOM,
  }
}

/** @deprecated 用 resolvePadSides；保留给旧调用 */
export function resolvePadXY(input?: BoundaryPadInput): { padX: number; padY: number } {
  const s = resolvePadSides(input)
  return { padX: Math.max(s.padLeft, s.padRight), padY: Math.max(s.padTop, s.padBottom) }
}

export function boundaryRect(
  wraps: string[],
  boxes: Array<{ id: string; pos: Point; size: Size }>,
  pad: BoundaryPadInput = BOUNDARY_PAD_DEFAULT,
): { x: number; y: number; w: number; h: number } | null {
  const content = boundaryContentBox(wraps, boxes)
  if (!content) return null
  const { padLeft, padRight, padTop, padBottom } = resolvePadSides(pad)
  return {
    x: content.x - padLeft,
    y: content.y - padTop,
    w: content.w + padLeft + padRight,
    h: content.h + padTop + padBottom,
  }
}

/**
 * 区域框几何：手绘框（带 pos/size）用显式矩形；包裹框仍由 wraps + pad 推导。
 * 流程图的 wraps 引用 node id，架构图引用 component id，调用方传对应 boxes 即可。
 */
export function boundaryRectFor(
  boundary: { pos?: Point; size?: Size; wraps: string[] },
  boxes: Array<{ id: string; pos: Point; size: Size }>,
  pad: BoundaryPadInput = BOUNDARY_PAD_DEFAULT,
): { x: number; y: number; w: number; h: number } | null {
  if (boundary.pos && boundary.size) {
    return { x: boundary.pos[0], y: boundary.pos[1], w: boundary.size[0], h: boundary.size[1] }
  }
  return boundaryRect(boundary.wraps, boxes, pad)
}

/** wrapsA 是否严格包含 wrapsB（集合意义） */
export function wrapsStrictlyContains(outer: string[], inner: string[]): boolean {
  if (inner.length === 0 || outer.length <= inner.length) return false
  const set = new Set(outer)
  return inner.every((id) => set.has(id))
}

/**
 * 按嵌套深度解析有效 pad：显式 pad 优先；否则外层更大，避免与 HTML finalize 一样的内外框贴死。
 * nestDepth：被多少个其它 boundary 严格包含（0=最外层）。
 * 可选 boxes：wraps 集合不完全嵌套时，用几何外包框互含补深度（如 SP 分层图）。
 */
export type ResolvedBoundaryPad = BoundaryPadSides & {
  pad: number
  padX: number
  padY: number
  nestDepth: number
}

export function resolveBoundaryPads(
  boundaries: Array<{
    wraps: string[]
    pad?: number
    padX?: number
    padY?: number
    padLeft?: number
    padRight?: number
    padTop?: number
    padBottom?: number
  }>,
  boxes?: Array<{ id: string; pos: Point; size: Size }>,
): ResolvedBoundaryPad[] {
  const n = boundaries.length
  const wrapDepth = boundaries.map((b, i) => {
    let depth = 0
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      if (wrapsStrictlyContains(boundaries[j].wraps, b.wraps)) depth += 1
    }
    return depth
  })

  let geomDepth = wrapDepth
  if (boxes?.length) {
    const frames = boundaries.map((b) => boundaryRect(b.wraps, boxes, b))
    geomDepth = frames.map((frame, i) => {
      if (!frame) return wrapDepth[i]
      let depth = 0
      for (let j = 0; j < n; j++) {
        if (i === j || !frames[j]) continue
        if (frameContains(frames[j]!, frame)) depth += 1
      }
      return Math.max(wrapDepth[i], depth)
    })
  }

  const nestDepth = geomDepth
  const maxDepth = nestDepth.reduce((a, d) => Math.max(a, d), 0)
  return boundaries.map((b, i) => {
    const depth = nestDepth[i]
    const hasExplicit =
      typeof b.pad === 'number' ||
      typeof b.padX === 'number' ||
      typeof b.padY === 'number' ||
      typeof b.padLeft === 'number' ||
      typeof b.padRight === 'number' ||
      typeof b.padTop === 'number' ||
      typeof b.padBottom === 'number'
    if (hasExplicit) {
      const sides = resolvePadSides(b)
      const padX = Math.max(sides.padLeft, sides.padRight)
      const padY = Math.max(sides.padTop, sides.padBottom)
      return {
        ...sides,
        pad: clampPad(Math.max(padX, padY)),
        padX,
        padY,
        nestDepth: depth,
      }
    }
    const auto = clampPad(
      Math.max(BOUNDARY_PAD_DEFAULT, ARCHIFY_BOUNDARY_TOP_MIN) + (maxDepth - depth) * BOUNDARY_NEST_GAP,
    )
    return {
      pad: auto,
      padX: auto,
      padY: auto,
      padLeft: auto,
      padRight: auto,
      padTop: auto,
      padBottom: Math.max(auto, ARCHIFY_BOUNDARY_EXTRA_BOTTOM),
      nestDepth: depth,
    }
  })
}

/** outer 是否在几何上严格包住 inner（允许 2px 误差） */
export function frameContains(
  outer: { x: number; y: number; w: number; h: number },
  inner: { x: number; y: number; w: number; h: number },
  eps = 2,
): boolean {
  if (outer.w * outer.h <= inner.w * inner.h) return false
  return (
    outer.x <= inner.x + eps &&
    outer.y <= inner.y + eps &&
    outer.x + outer.w >= inner.x + inner.w - eps &&
    outer.y + outer.h >= inner.y + inner.h - eps
  )
}

function framesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** 统计兄弟框（非 wraps 包含、非几何包含）相交对数；导入后应恒为 0 */
export function countSiblingBoundaryCrosses(
  boundaries: Array<{ wraps: string[]; pad?: number; padX?: number; padY?: number }>,
  boxes: Array<{ id: string; pos: Point; size: Size }>,
): number {
  const frames = boundaries.map((b) => boundaryRect(b.wraps, boxes, b))
  let n = 0
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      const a = frames[i]
      const b = frames[j]
      if (!a || !b || !framesOverlap(a, b)) continue
      if (frameContains(a, b) || frameContains(b, a)) continue
      if (
        wrapsStrictlyContains(boundaries[i].wraps, boundaries[j].wraps) ||
        wrapsStrictlyContains(boundaries[j].wraps, boundaries[i].wraps)
      ) {
        continue
      }
      n += 1
    }
  }
  return n
}

/**
 * 兄弟框（非包含）相交时收缩 pad，避免导入后交叉（如业务插件 ↔ 基础设施底座）。
 * 竖直叠放收下方 padY；水平叠放收较大一侧 padX。
 */
export function shrinkSiblingBoundaryPads(
  boundaries: Array<{
    wraps: string[]
    padX: number
    padY: number
    padLeft: number
    padRight: number
    padTop: number
    padBottom: number
  }>,
  boxes: Array<{ id: string; pos: Point; size: Size }>,
): void {
  if (boundaries.length < 2 || !boxes.length) return
  let guard = 0
  let changed = true
  while (changed && guard < 64) {
    changed = false
    guard += 1
    const frames = boundaries.map((b) => boundaryRect(b.wraps, boxes, b))
    for (let i = 0; i < boundaries.length; i++) {
      for (let j = i + 1; j < boundaries.length; j++) {
        const a = frames[i]
        const b = frames[j]
        if (!a || !b || !framesOverlap(a, b)) continue
        if (frameContains(a, b) || frameContains(b, a)) continue
        if (
          wrapsStrictlyContains(boundaries[i].wraps, boundaries[j].wraps) ||
          wrapsStrictlyContains(boundaries[j].wraps, boundaries[i].wraps)
        ) {
          continue
        }
        const acy = a.y + a.h / 2
        const bcy = b.y + b.h / 2
        const acx = a.x + a.w / 2
        const bcx = b.x + b.w / 2
        if (Math.abs(acy - bcy) >= Math.abs(acx - bcx)) {
          const lower = acy < bcy ? j : i
          if (boundaries[lower].padTop > BOUNDARY_PAD_MIN) {
            boundaries[lower].padTop = Math.max(BOUNDARY_PAD_MIN, boundaries[lower].padTop - 4)
            boundaries[lower].padY = Math.max(boundaries[lower].padTop, boundaries[lower].padBottom)
            changed = true
          }
        } else {
          // 水平相交：收靠近对方的那一侧
          if (acx < bcx) {
            // i 在左，收 i 的右或 j 的左
            if (boundaries[i].padRight >= boundaries[j].padLeft && boundaries[i].padRight > BOUNDARY_PAD_MIN) {
              boundaries[i].padRight = Math.max(BOUNDARY_PAD_MIN, boundaries[i].padRight - 4)
              boundaries[i].padX = Math.max(boundaries[i].padLeft, boundaries[i].padRight)
              changed = true
            } else if (boundaries[j].padLeft > BOUNDARY_PAD_MIN) {
              boundaries[j].padLeft = Math.max(BOUNDARY_PAD_MIN, boundaries[j].padLeft - 4)
              boundaries[j].padX = Math.max(boundaries[j].padLeft, boundaries[j].padRight)
              changed = true
            }
          } else if (boundaries[j].padRight >= boundaries[i].padLeft && boundaries[j].padRight > BOUNDARY_PAD_MIN) {
            boundaries[j].padRight = Math.max(BOUNDARY_PAD_MIN, boundaries[j].padRight - 4)
            boundaries[j].padX = Math.max(boundaries[j].padLeft, boundaries[j].padRight)
            changed = true
          } else if (boundaries[i].padLeft > BOUNDARY_PAD_MIN) {
            boundaries[i].padLeft = Math.max(BOUNDARY_PAD_MIN, boundaries[i].padLeft - 4)
            boundaries[i].padX = Math.max(boundaries[i].padLeft, boundaries[i].padRight)
            changed = true
          }
        }
      }
    }
  }
}

/**
 * 拖动手柄调整区域框内边距（拖哪侧只动哪侧，对侧不动）。
 * E→padRight，W→padLeft，S→padBottom，N→padTop。
 */
export function applyBoundaryPadResize(
  start: BoundaryPadSides | { padX: number; padY: number } | number,
  handle: Handle,
  dx: number,
  dy: number,
): BoundaryPadSides & { padX: number; padY: number; pad: number } {
  const sides: BoundaryPadSides =
    typeof start === 'number'
      ? resolvePadSides(start)
      : 'padLeft' in start
        ? {
            padLeft: start.padLeft,
            padRight: start.padRight,
            padTop: start.padTop,
            padBottom: start.padBottom,
          }
        : resolvePadSides({ padX: start.padX, padY: start.padY })
  let { padLeft, padRight, padTop, padBottom } = sides
  if (handle.includes('e')) padRight += dx
  if (handle.includes('w')) padLeft -= dx
  if (handle.includes('s')) padBottom += dy
  if (handle.includes('n')) padTop -= dy
  padLeft = clampPad(padLeft)
  padRight = clampPad(padRight)
  padTop = clampPad(padTop)
  padBottom = clampPad(padBottom)
  const padX = Math.max(padLeft, padRight)
  const padY = Math.max(padTop, padBottom)
  return { padLeft, padRight, padTop, padBottom, padX, padY, pad: Math.max(padX, padY) }
}

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']

export function handlePos(size: Size, handle: Handle): Point {
  const [w, h] = size
  const x = handle.includes('w') ? 0 : handle.includes('e') ? w : w / 2
  const y = handle.includes('n') ? 0 : handle.includes('s') ? h : h / 2
  return [x, y]
}

export function handleCursor(handle: Handle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize'
    case 'e':
    case 'w':
      return 'ew-resize'
    case 'ne':
    case 'sw':
      return 'nesw-resize'
    default:
      return 'nwse-resize'
  }
}
