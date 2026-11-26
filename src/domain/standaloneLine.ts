import type { Point, StandaloneLine } from '../types'

/** 独立线段的点序列（防御性读取历史 JSON） */
export function linePoints(line: StandaloneLine): Point[] {
  return Array.isArray(line.points) && line.points.length >= 2 ? line.points : []
}

/** 整线平移：节点移动、方向键微调共用 */
export function translateLinePoints(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => [p[0] + dx, p[1] + dy] as Point)
}

/** 拖动单个端点/拐点 */
export function moveLinePoint(points: Point[], index: number, to: Point): Point[] {
  if (index < 0 || index >= points.length) return points
  const next = points.map((p) => [...p] as Point)
  next[index] = [Math.round(to[0]), Math.round(to[1])]
  return next
}

/** 导出裁切 / 视图适配用包围盒 */
export function lineBounds(points: Point[]): { x: number; y: number; w: number; h: number } | null {
  if (points.length < 2) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}
