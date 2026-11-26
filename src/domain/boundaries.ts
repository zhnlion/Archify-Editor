import type { ArchifyBoundary, ArchifyDiagram, Point, Size } from '../types'
import { MIN_SIZE } from '../types'
import {
  BOUNDARY_NEST_GAP,
  BOUNDARY_PAD_DEFAULT,
  BOUNDARY_PAD_MAX,
  resolveBoundaryPads,
  resolvePadSides,
  shrinkSiblingBoundaryPads,
  wrapsStrictlyContains,
} from './geom'

/** 将 padTop/padBottom 等扩展字段折算为分侧 pad + padX/padY */
export function migrateBoundaryExtras(b: ArchifyBoundary & Record<string, unknown>): ArchifyBoundary {
  const base: ArchifyBoundary = {
    kind: b.kind,
    label: b.label,
    wraps: b.wraps,
  }
  const sides = resolvePadSides(b)
  return {
    ...base,
    padLeft: sides.padLeft,
    padRight: sides.padRight,
    padTop: sides.padTop,
    padBottom: sides.padBottom,
    padX: Math.max(sides.padLeft, sides.padRight),
    padY: Math.max(sides.padTop, sides.padBottom),
    pad: Math.max(sides.padLeft, sides.padRight, sides.padTop, sides.padBottom),
  }
}

/**
 * 导入后：折算非法 pad* 字段；嵌套框强制外层 pad ≥ 内层 + GAP；外层排前便于绘制。
 */
export function enrichArchitectureBoundaries(d: ArchifyDiagram): ArchifyDiagram {
  const raw = d.boundaries ?? []
  if (!raw.length) return d
  const migrated = raw.map((b) => migrateBoundaryExtras(b as ArchifyBoundary & Record<string, unknown>))
  const resolved = resolveBoundaryPads(migrated)
  const padLefts = resolved.map((r) => r.padLeft)
  const padRights = resolved.map((r) => r.padRight)
  const padTops = resolved.map((r) => r.padTop)
  const padBottoms = resolved.map((r) => r.padBottom)

  // 嵌套同 pad 时拉开；四侧分别保证外层 ≥ 内层 + GAP
  let changed = true
  let guard = 0
  while (changed && guard < migrated.length * migrated.length + 4) {
    changed = false
    guard += 1
    for (let i = 0; i < migrated.length; i++) {
      for (let j = 0; j < migrated.length; j++) {
        if (i === j) continue
        if (!wrapsStrictlyContains(migrated[i].wraps, migrated[j].wraps)) continue
        const bump = (arr: number[], need: number) => {
          const next = Math.min(BOUNDARY_PAD_MAX, need)
          if (arr[i] < next) {
            arr[i] = next
            changed = true
          }
        }
        bump(padLefts, padLefts[j] + BOUNDARY_NEST_GAP)
        bump(padRights, padRights[j] + BOUNDARY_NEST_GAP)
        bump(padTops, padTops[j] + BOUNDARY_NEST_GAP)
        bump(padBottoms, padBottoms[j] + BOUNDARY_NEST_GAP)
      }
    }
  }

  const boundaries = migrated.map((b, i) => {
    const padLeft = padLefts[i]
    const padRight = padRights[i]
    const padTop = padTops[i]
    const padBottom = padBottoms[i]
    const padX = Math.max(padLeft, padRight)
    const padY = Math.max(padTop, padBottom)
    return {
      ...b,
      padLeft,
      padRight,
      padTop,
      padBottom,
      padX,
      padY,
      pad: Math.max(padX, padY),
    }
  })

  const boxes: Array<{ id: string; pos: Point; size: Size }> = []
  for (const c of d.components) {
    if (!c.pos) continue
    const size = c.size ?? MIN_SIZE
    boxes.push({
      id: c.id,
      pos: c.pos,
      size: [Math.max(size[0], MIN_SIZE[0]), Math.max(size[1], MIN_SIZE[1])],
    })
  }
  if (boxes.length) {
    shrinkSiblingBoundaryPads(boundaries, boxes)
    for (const b of boundaries) {
      b.padX = Math.max(b.padLeft ?? 0, b.padRight ?? 0)
      b.padY = Math.max(b.padTop ?? 0, b.padBottom ?? 0)
      b.pad = Math.max(b.padX, b.padY)
    }
  }

  const order = boundaries
    .map((b, i) => ({ b, i, depth: resolved[i].nestDepth, n: b.wraps.length }))
    .sort((a, c) => c.n - a.n || a.depth - c.depth || a.i - c.i)
    .map((x) => x.b)
  return { ...d, boundaries: order }
}

export function defaultBoundaryPad(existing: ArchifyBoundary[]): number {
  if (!existing.length) return BOUNDARY_PAD_DEFAULT
  const resolved = resolveBoundaryPads(existing)
  const maxPad = Math.max(...resolved.map((r) => r.pad), BOUNDARY_PAD_DEFAULT)
  return Math.min(BOUNDARY_PAD_MAX, maxPad + BOUNDARY_NEST_GAP)
}
