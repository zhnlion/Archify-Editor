import type { Point, Size } from '../types'

export type AlignAxis =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'

export type Box = { id: string; pos: Point; size: Size }

/**
 * 相对对齐。
 * - 传入 anchorId：以该框为基准（位置不变），其余对齐到它的左/右/顶/底/中线。
 * - 未传：相对所选包围盒对齐（旧行为）。
 * 少于 2 个框时不改动。
 */
export function alignNodes(
  boxes: Box[],
  axis: AlignAxis,
  anchorId?: string,
): Array<{ id: string; pos: Point }> {
  if (boxes.length < 2) return []
  const anchor = anchorId ? boxes.find((b) => b.id === anchorId) : undefined

  let minX = Math.min(...boxes.map((b) => b.pos[0]))
  let maxX = Math.max(...boxes.map((b) => b.pos[0] + b.size[0]))
  let minY = Math.min(...boxes.map((b) => b.pos[1]))
  let maxY = Math.max(...boxes.map((b) => b.pos[1] + b.size[1]))
  let midX = (minX + maxX) / 2
  let midY = (minY + maxY) / 2

  if (anchor) {
    minX = anchor.pos[0]
    maxX = anchor.pos[0] + anchor.size[0]
    minY = anchor.pos[1]
    maxY = anchor.pos[1] + anchor.size[1]
    midX = anchor.pos[0] + anchor.size[0] / 2
    midY = anchor.pos[1] + anchor.size[1] / 2
  }

  return boxes.map((b) => {
    if (anchor && b.id === anchor.id) {
      return { id: b.id, pos: [b.pos[0], b.pos[1]] as Point }
    }
    let x = b.pos[0]
    let y = b.pos[1]
    if (axis === 'left') x = minX
    if (axis === 'right') x = maxX - b.size[0]
    if (axis === 'center') x = midX - b.size[0] / 2
    if (axis === 'top') y = minY
    if (axis === 'bottom') y = maxY - b.size[1]
    if (axis === 'middle') y = midY - b.size[1] / 2
    return { id: b.id, pos: [Math.round(x), Math.round(y)] as Point }
  })
}

/** 水平/垂直等距分布（按中心排序，两端不动） */
export function distributeNodes(
  boxes: Box[],
  axis: 'horizontal' | 'vertical',
): Array<{ id: string; pos: Point }> {
  if (boxes.length < 3) return []
  const sorted = [...boxes].sort((a, b) =>
    axis === 'horizontal' ? a.pos[0] - b.pos[0] : a.pos[1] - b.pos[1],
  )
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  if (axis === 'horizontal') {
    const start = first.pos[0] + first.size[0] / 2
    const end = last.pos[0] + last.size[0] / 2
    const step = (end - start) / (sorted.length - 1)
    return sorted.map((b, i) => {
      if (i === 0 || i === sorted.length - 1) return { id: b.id, pos: b.pos }
      const cx = start + step * i
      return { id: b.id, pos: [Math.round(cx - b.size[0] / 2), b.pos[1]] as Point }
    })
  }
  const start = first.pos[1] + first.size[1] / 2
  const end = last.pos[1] + last.size[1] / 2
  const step = (end - start) / (sorted.length - 1)
  return sorted.map((b, i) => {
    if (i === 0 || i === sorted.length - 1) return { id: b.id, pos: b.pos }
    const cy = start + step * i
    return { id: b.id, pos: [b.pos[0], Math.round(cy - b.size[1] / 2)] as Point }
  })
}
