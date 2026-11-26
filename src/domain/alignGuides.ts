import type { Point, Size } from '../types'

export type AlignGuide = { axis: 'v' | 'h'; at: number }

export type BoxRef = { id: string; pos: Point; size: Size }

const DEFAULT_THRESHOLD = 6

function edgesOf(box: BoxRef) {
  const [x, y] = box.pos
  const [w, h] = box.size
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h,
    cx: x + w / 2,
    cy: y + h / 2,
  }
}

/**
 * 相对他形边/中心的智能对齐：在阈值内吸附，并返回临时参考线。
 * 与网格吸附可并存（调用方先 align 再决定是否再 snap 网格）。
 */
export function snapToAlignGuides(
  moving: BoxRef,
  others: BoxRef[],
  threshold = DEFAULT_THRESHOLD,
): { pos: Point; guides: AlignGuide[] } {
  const m0 = edgesOf(moving)
  let dx = 0
  let dy = 0
  let bestX = threshold + 1
  let bestY = threshold + 1
  let guideV: AlignGuide | null = null
  let guideH: AlignGuide | null = null

  for (const other of others) {
    if (other.id === moving.id) continue
    const o = edgesOf(other)
    const xPairs: Array<[number, number]> = [
      [m0.left, o.left],
      [m0.left, o.right],
      [m0.left, o.cx],
      [m0.right, o.left],
      [m0.right, o.right],
      [m0.right, o.cx],
      [m0.cx, o.left],
      [m0.cx, o.right],
      [m0.cx, o.cx],
    ]
    for (const [from, to] of xPairs) {
      const d = to - from
      const ad = Math.abs(d)
      if (ad <= threshold && ad < bestX) {
        bestX = ad
        dx = d
        guideV = { axis: 'v', at: to }
      }
    }
    const yPairs: Array<[number, number]> = [
      [m0.top, o.top],
      [m0.top, o.bottom],
      [m0.top, o.cy],
      [m0.bottom, o.top],
      [m0.bottom, o.bottom],
      [m0.bottom, o.cy],
      [m0.cy, o.top],
      [m0.cy, o.bottom],
      [m0.cy, o.cy],
    ]
    for (const [from, to] of yPairs) {
      const d = to - from
      const ad = Math.abs(d)
      if (ad <= threshold && ad < bestY) {
        bestY = ad
        dy = d
        guideH = { axis: 'h', at: to }
      }
    }
  }

  const guides: AlignGuide[] = []
  if (guideV && bestX <= threshold) guides.push(guideV)
  if (guideH && bestY <= threshold) guides.push(guideH)
  return {
    pos: [Math.round(moving.pos[0] + dx), Math.round(moving.pos[1] + dy)],
    guides,
  }
}
