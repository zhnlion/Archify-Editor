/**
 * 连线候选锚点（亿图式）：每条边均布 3 个候选点，共 12 个。
 * 拖线时高亮离光标最近的点，实现「框图光标位置有光点显示」的吸附提示。
 * 纯函数、不依赖 DOM，便于单测。
 */
import type { Point, Size } from '../types'
import type { Side } from './edgeRoute'

/** 每条边的候选点数量（亿图风格：每边多个点）。 */
export const ANCHORS_PER_SIDE = 3

export type AnchorPoint = {
  side: Side
  /** 该点在本边的序号（0..ANCHORS_PER_SIDE-1） */
  index: number
  point: Point
}

/** 计算一条边上均布的候选点（含两端内缩，避免落在角上）。 */
export function sideAnchorPoints(
  pos: Point,
  size: Size,
  side: Side,
  perSide = ANCHORS_PER_SIDE,
): AnchorPoint[] {
  const [x, y] = pos
  const [w, h] = size
  const n = Math.max(1, Math.floor(perSide))
  const out: AnchorPoint[] = []
  // 内缩比例：第 i 个点位于 (i+1)/(n+1) 处，角点不会被选中
  for (let i = 0; i < n; i += 1) {
    const t = (i + 1) / (n + 1)
    let point: Point
    if (side === 'n') point = [x + w * t, y]
    else if (side === 's') point = [x + w * t, y + h]
    else if (side === 'e') point = [x + w, y + h * t]
    else point = [x, y + h * t]
    out.push({ side, index: i, point })
  }
  return out
}

/** 计算一个框的全部候选点（顺序 n, e, s, w）。 */
export function boxAnchorPoints(pos: Point, size: Size, perSide = ANCHORS_PER_SIDE): AnchorPoint[] {
  return (['n', 'e', 's', 'w'] as Side[]).flatMap((side) =>
    sideAnchorPoints(pos, size, side, perSide),
  )
}

/** 离给定光标点最近的候选点；并列时返回先出现者。 */
export function nearestAnchor(anchors: AnchorPoint[], at: Point): AnchorPoint | null {
  let best: AnchorPoint | null = null
  let bestDist = Infinity
  for (const anchor of anchors) {
    const dx = anchor.point[0] - at[0]
    const dy = anchor.point[1] - at[1]
    const dist = dx * dx + dy * dy
    if (dist < bestDist) {
      bestDist = dist
      best = anchor
    }
  }
  return best
}

/** 光标落入框内时，按其相对中心的位置挑最近的一条边（用于 fromSide/toSide 兜底）。 */
export function nearestSide(pos: Point, size: Size, at: Point): Side {
  const cx = pos[0] + size[0] / 2
  const cy = pos[1] + size[1] / 2
  const dx = at[0] - cx
  const dy = at[1] - cy
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'e' : 'w'
  return dy >= 0 ? 's' : 'n'
}
