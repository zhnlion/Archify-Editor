import type { Point, Size } from '../types'

/** 与画布 CSS grid background-size 一致 */
export const GRID_SIZE = 24

export function snapValue(v: number, grid = GRID_SIZE): number {
  return Math.round(v / grid) * grid
}

export function snapPoint(pos: Point, grid = GRID_SIZE): Point {
  return [snapValue(pos[0], grid), snapValue(pos[1], grid)]
}

/** 缩放时：位置与对边吸附，返回新 pos/size */
export function snapResize(
  pos: Point,
  size: Size,
  handle: string,
  grid = GRID_SIZE,
): { pos: Point; size: Size } {
  let [x, y] = pos
  let [w, h] = size
  const right = x + w
  const bottom = y + h
  if (handle.includes('e')) {
    const nr = snapValue(right, grid)
    w = Math.max(grid, nr - x)
  }
  if (handle.includes('s')) {
    const nb = snapValue(bottom, grid)
    h = Math.max(grid, nb - y)
  }
  if (handle.includes('w')) {
    const nx = snapValue(x, grid)
    w = Math.max(grid, right - nx)
    x = right - w
  }
  if (handle.includes('n')) {
    const ny = snapValue(y, grid)
    h = Math.max(grid, bottom - ny)
    y = bottom - h
  }
  return { pos: [Math.round(x), Math.round(y)], size: [Math.round(w), Math.round(h)] }
}
