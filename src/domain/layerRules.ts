import type { ArchifyConnection, ArchifyDiagram, EditorLayer } from '../types'
import { architectureMode, componentLayerIndex, sortedLayers } from './document'

/** free=不校验；downward=仅允许上层→下层（含同层） */
export type LayerEdgeRule = 'free' | 'downward'

export function resolveLayerEdgeRule(d: ArchifyDiagram): LayerEdgeRule {
  return d.meta.editor?.layerEdgeRule === 'downward' ? 'downward' : 'free'
}

export function setLayerEdgeRule(d: ArchifyDiagram, rule: LayerEdgeRule): ArchifyDiagram {
  if (architectureMode(d) !== 'layered') return d
  return {
    ...d,
    meta: {
      ...d.meta,
      editor: { ...d.meta.editor, mode: 'layered', layerEdgeRule: rule },
    },
  }
}

/** 组件所属层 order；无层归属时视为 0 */
export function componentLayerOrder(d: ArchifyDiagram, id: string, layers?: EditorLayer[]): number {
  const ls = layers ?? sortedLayers(d)
  if (!ls.length) return 0
  const idx = componentLayerIndex(d, id)
  return ls[Math.min(Math.max(0, idx), ls.length - 1)]?.order ?? idx
}

/**
 * 跨层规则：downward 时禁止下层指向上层（order 更大 → order 更小）。
 * 同层与自上而下均合法；free 永不违规。
 */
export function isLayerEdgeViolation(
  d: ArchifyDiagram,
  edge: Pick<ArchifyConnection, 'from' | 'to'>,
  rule: LayerEdgeRule = resolveLayerEdgeRule(d),
): boolean {
  if (rule !== 'downward' || architectureMode(d) !== 'layered') return false
  const layers = sortedLayers(d)
  if (layers.length < 2) return false
  const fromOrder = componentLayerOrder(d, edge.from, layers)
  const toOrder = componentLayerOrder(d, edge.to, layers)
  return fromOrder > toOrder
}

export function layerEdgeViolations(d: ArchifyDiagram): ArchifyConnection[] {
  if (resolveLayerEdgeRule(d) !== 'downward' || architectureMode(d) !== 'layered') return []
  return (d.connections ?? []).filter((c) => isLayerEdgeViolation(d, c, 'downward'))
}
