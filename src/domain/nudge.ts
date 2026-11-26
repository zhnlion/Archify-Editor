import type { Point } from '../types'
import type { Selection } from '../ui/Canvas'
import { ensurePos } from './document'
import { boundaryIndexesOf, nodeIdsOf } from './selection'

/** 与鼠标整组拖一致：选中节点 ∪ 选中区域框 wraps（去重，保序）。 */
export function movableIdsForSelection(
  selection: Selection,
  boundaries: Array<{ wraps: string[] }> | undefined,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  }
  for (const id of nodeIdsOf(selection)) add(id)
  for (const bi of boundaryIndexesOf(selection)) {
    const wraps = boundaries?.[bi]?.wraps
    if (!wraps) continue
    for (const id of wraps) add(id)
  }
  return out
}

/**
 * 计算方向键微调位移。用 ensurePos 对齐画布展示坐标，避免缺 pos 的节点被跳过导致「只动一个」。
 */
export function nudgeMovesForIds(
  nodes: Array<{ id: string; pos?: Point }>,
  ids: string[],
  dx: number,
  dy: number,
): Array<{ id: string; pos: Point }> {
  if (!ids.length || (dx === 0 && dy === 0)) return []
  const indexById = new Map(nodes.map((n, i) => [n.id, i]))
  const moves: Array<{ id: string; pos: Point }> = []
  for (const id of ids) {
    const i = indexById.get(id)
    if (i == null) continue
    const n = nodes[i]!
    const [x, y] = ensurePos(n.pos, i)
    moves.push({ id, pos: [x + dx, y + dy] })
  }
  return moves
}

/**
 * 两端点以相同 delta 整组平移时，绝对 via 同步平移（整组拖动保持相对折点）。
 * 仅一端移动或 delta 不一致时不改 via，避免斜扯折线。
 */
export function translateViasForUniformMoves<T extends { from: string; to: string; via?: Point[] }>(
  edges: T[],
  oldPos: Map<string, Point>,
  newPos: Map<string, Point>,
): T[] {
  if (!edges.length || !newPos.size) return edges
  return edges.map((e) => {
    if (!e.via?.length) return e
    if (!newPos.has(e.from) || !newPos.has(e.to)) return e
    const of = oldPos.get(e.from)
    const ot = oldPos.get(e.to)
    const nf = newPos.get(e.from)!
    const nt = newPos.get(e.to)!
    if (!of || !ot) return e
    const dx = nf[0] - of[0]
    const dy = nf[1] - of[1]
    if (dx === 0 && dy === 0) return e
    if (nt[0] - ot[0] !== dx || nt[1] - ot[1] !== dy) return e
    return {
      ...e,
      via: e.via.map((p) => [p[0] + dx, p[1] + dy] as Point),
    }
  })
}
