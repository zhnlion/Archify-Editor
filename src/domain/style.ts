import type { AnyDiagram, BoxStyle, ComponentType, FlowShape, LineStyle } from '../types'
import { TYPE_COLOR } from '../types'
import { isArchitecture, isFlowchart } from './document'
import {
  ARCH_TYPE_THEME,
  EDGE_THEME,
  flowShapeThemeDefault,
  stripImpliedThemeDefaults,
  type ThemeMode,
} from './themePalette'

export const DEFAULT_NODE_FONT_SIZE = 13

/** 附标题缺省字号：显式 subFontSize 优先，否则约为主标题 85%（不少于 9） */
export function resolveSubFontSize(fontSize: number, subFontSize?: number): number {
  if (subFontSize != null && Number.isFinite(subFontSize)) {
    return Math.max(8, Math.min(48, Math.round(subFontSize)))
  }
  return Math.max(9, Math.round(fontSize * 0.85))
}

export type { ThemeMode }

/** 无填充：画布 / 快照用 fill="none" */
export function isNoneFill(value: string | undefined): boolean {
  const t = (value ?? '').trim().toLowerCase()
  return t === 'none' || t === 'transparent'
}

/**
 * SVG stroke-dasharray：空串/空白 → 省略属性（实线）；
 * 数据层仍可用 '' 表示「显式实线」，以覆盖区域框默认虚线。
 */
export function svgStrokeDasharray(value: string | undefined): string | undefined {
  if (value == null) return undefined
  const t = String(value).trim()
  return t || undefined
}

/** 格式刷：从节点样式抽出可复制字段（含字号/粗斜体/虚线边框） */
export function snapshotBoxStyle(style: BoxStyle | undefined, resolved?: BoxStyle): BoxStyle {
  const src = { ...resolved, ...style }
  const out: BoxStyle = {}
  if (src.fill != null) out.fill = src.fill
  if (src.stroke != null) out.stroke = src.stroke
  if (src.text != null) out.text = src.text
  if (src.strokeWidth != null) out.strokeWidth = src.strokeWidth
  if (src.fontSize != null) out.fontSize = src.fontSize
  if (src.subFontSize != null) out.subFontSize = src.subFontSize
  if (src.fontWeight != null) out.fontWeight = src.fontWeight
  if (src.fontStyle != null) out.fontStyle = src.fontStyle
  if (src.strokeDasharray != null) out.strokeDasharray = src.strokeDasharray
  if (src.textHAlign != null) out.textHAlign = src.textHAlign
  if (src.textVAlign != null) out.textVAlign = src.textVAlign
  return out
}

export function resolveNodeStyle(
  kind: 'architecture' | 'flowchart',
  key: ComponentType | FlowShape,
  style?: BoxStyle,
  theme: ThemeMode = 'dark',
): Required<Pick<BoxStyle, 'fill' | 'stroke' | 'text' | 'strokeWidth' | 'fontSize'>> &
  Pick<
    BoxStyle,
    'subFontSize' | 'fontWeight' | 'fontStyle' | 'strokeDasharray' | 'textHAlign' | 'textVAlign'
  > {
  const effective = stripImpliedThemeDefaults(style, theme)
  const fallback =
    kind === 'architecture'
      ? (() => {
          const t = ARCH_TYPE_THEME[theme][key as ComponentType] ?? {
            fill: theme === 'light' ? '#FFFFFF' : '#1e2731',
            stroke: TYPE_COLOR[key as ComponentType] ?? '#94a3b8',
            text: theme === 'light' ? '#1F2329' : '#e7eef6',
          }
          return { ...t, strokeWidth: 1.6, fontSize: DEFAULT_NODE_FONT_SIZE }
        })()
      : (() => {
          const t = flowShapeThemeDefault(key as FlowShape, theme)
          return {
            fill: t.fill ?? '#E8F1FF',
            stroke: t.stroke ?? '#3D9CF0',
            text: t.text ?? '#0F172A',
            strokeWidth: 1.6,
            fontSize: DEFAULT_NODE_FONT_SIZE,
          }
        })()
  const fillRaw = effective?.fill
  return {
    fill: isNoneFill(fillRaw) ? 'none' : (fillRaw ?? fallback.fill),
    stroke: effective?.stroke ?? fallback.stroke,
    text: effective?.text ?? fallback.text,
    strokeWidth: effective?.strokeWidth ?? fallback.strokeWidth,
    fontSize: effective?.fontSize ?? fallback.fontSize,
    subFontSize: effective?.subFontSize,
    fontWeight: effective?.fontWeight,
    fontStyle: effective?.fontStyle,
    strokeDasharray: effective?.strokeDasharray,
    textHAlign: effective?.textHAlign,
    textVAlign: effective?.textVAlign,
  }
}

export function resolveLineStyle(
  style?: LineStyle,
  emphasis = false,
  theme: ThemeMode = 'dark',
): Required<Pick<LineStyle, 'stroke' | 'strokeWidth' | 'arrow'>> &
  Pick<LineStyle, 'strokeDasharray' | 'labelFill'> {
  const edge = EDGE_THEME[theme]
  return {
    stroke: style?.stroke ?? (emphasis ? edge.emphasis : edge.stroke),
    strokeWidth: style?.strokeWidth ?? (emphasis ? 2 : 1.6),
    arrow: style?.arrow ?? 'end',
    strokeDasharray: style?.strokeDasharray,
    /** 缺省无底；仅显式色值才有填充 */
    labelFill: style?.labelFill,
  }
}

/** 格式刷：从边样式抽出可复制字段（线色/宽/箭头/虚实/标签底） */
export function snapshotLineStyle(style: LineStyle | undefined, resolved?: LineStyle): LineStyle {
  const src = { ...resolved, ...style }
  const out: LineStyle = {}
  if (src.stroke != null) out.stroke = src.stroke
  if (src.strokeWidth != null) out.strokeWidth = src.strokeWidth
  if (src.arrow != null) out.arrow = src.arrow
  if (src.strokeDasharray != null) out.strokeDasharray = src.strokeDasharray
  // 源无底时刷成 none，保证目标外观一致
  out.labelFill = style?.labelFill != null && String(style.labelFill).trim() ? style.labelFill : 'none'
  return out
}

/** 批量写入边 style（flowchart.edges / architecture.connections） */
export function paintEdges(diagram: AnyDiagram, ids: string[], patch: LineStyle): AnyDiagram {
  const idset = new Set(ids)
  if (isFlowchart(diagram)) {
    return {
      ...diagram,
      edges: diagram.edges.map((e) =>
        idset.has(e.id) ? { ...e, style: mergeStyle(e.style, patch) } : e,
      ),
    }
  }
  if (isArchitecture(diagram)) {
    return {
      ...diagram,
      connections: (diagram.connections ?? []).map((e) =>
        idset.has(e.id) ? { ...e, style: mergeStyle(e.style, patch) } : e,
      ),
    }
  }
  return diagram
}

export function mergeStyle<T extends BoxStyle | LineStyle>(prev: T | undefined, patch: Partial<T>): T {
  return { ...(prev ?? ({} as T)), ...patch }
}
