import type { AnyDiagram, BoxStyle } from '../types'
import { BOUNDARY_THEME, type ThemeMode } from './themePalette'

export const DEFAULT_BOUNDARY_FONT_SIZE = 12

export function getBoundaryStyle(
  d: AnyDiagram,
  label: string,
  theme: ThemeMode = 'dark',
): BoxStyle {
  // boundaryStyles 只存用户显式覆盖；白色等浅色不能按主题默认值剔除。
  const custom = d.meta.editor?.boundaryStyles?.[label]
  const fallback = BOUNDARY_THEME[theme]
  const out: BoxStyle = {
    fill: custom?.fill ?? fallback.fill,
    stroke: custom?.stroke ?? fallback.stroke,
    text: custom?.text ?? fallback.text,
    strokeWidth: custom?.strokeWidth ?? 1.5,
    fontSize: custom?.fontSize ?? DEFAULT_BOUNDARY_FONT_SIZE,
  }
  // 粗体/斜体/线型须透出，否则 Ctrl+A 批改写入 boundaryStyles 后画布读不到
  if (custom?.fontWeight != null) out.fontWeight = custom.fontWeight
  if (custom?.fontStyle != null) out.fontStyle = custom.fontStyle
  // 保留显式 ''（实线）；缺省键表示未定制，画布可回退到默认虚线
  if (custom && Object.prototype.hasOwnProperty.call(custom, 'strokeDasharray')) {
    out.strokeDasharray = custom.strokeDasharray
  }
  return out
}

export function setBoundaryStyle(
  d: AnyDiagram,
  label: string,
  patch: Partial<BoxStyle>,
): AnyDiagram {
  const prev = d.meta.editor?.boundaryStyles?.[label] ?? {}
  const nextStyle: BoxStyle = { ...prev, ...patch }
  return {
    ...d,
    meta: {
      ...d.meta,
      editor: {
        ...d.meta.editor,
        boundaryStyles: {
          ...d.meta.editor?.boundaryStyles,
          [label]: nextStyle,
        },
      },
    },
  }
}

/**
 * Ctrl+A / 多选改节点样式时，同步到选中区域框 / 泳道的字段：
 * 填充、字号、文字色、描边色、描边宽度、粗斜体、线型。
 */
export function boundaryPatchFromNodeStyle(patch: BoxStyle): BoxStyle {
  const local: BoxStyle = {}
  if (patch.fill !== undefined) local.fill = patch.fill
  if (patch.fontSize != null) local.fontSize = patch.fontSize
  if (patch.text != null) local.text = patch.text
  if (patch.stroke != null) local.stroke = patch.stroke
  if (patch.strokeWidth != null) local.strokeWidth = patch.strokeWidth
  if (patch.fontWeight != null) local.fontWeight = patch.fontWeight
  if (patch.fontStyle != null) local.fontStyle = patch.fontStyle
  if (patch.strokeDasharray !== undefined) local.strokeDasharray = patch.strokeDasharray
  return local
}

/** 将样式补丁应用到选中泳道 / 层带（meta.editor.layers[].style） */
export function paintLanes(d: AnyDiagram, laneIds: string[], patch: BoxStyle): AnyDiagram {
  const local = boundaryPatchFromNodeStyle(patch)
  const idset = new Set(laneIds)
  const layers = d.meta.editor?.layers
  if (!Object.keys(local).length || !idset.size || !layers?.length) return d
  return {
    ...d,
    meta: {
      ...d.meta,
      editor: {
        ...d.meta.editor,
        layers: layers.map((l) =>
          idset.has(l.id) ? { ...l, style: { ...l.style, ...local } } : l,
        ),
      },
    },
  }
}

/** 将样式补丁应用到指定索引的区域框（按 label 写入 meta.editor.boundaryStyles） */
export function paintBoundaries(
  d: AnyDiagram,
  indexes: number[],
  patch: BoxStyle,
): AnyDiagram {
  const local = boundaryPatchFromNodeStyle(patch)
  if (!Object.keys(local).length || !indexes.length) return d
  let next = d
  for (const i of indexes) {
    const b = next.boundaries?.[i]
    if (!b) continue
    next = setBoundaryStyle(next, b.label, local)
  }
  return next
}

/** 区域框重命名时迁移样式键 */
export function renameBoundaryStyle(d: AnyDiagram, from: string, to: string): AnyDiagram {
  if (from === to) return d
  const styles = { ...d.meta.editor?.boundaryStyles }
  if (!styles || !(from in styles)) return d
  styles[to] = styles[from]
  delete styles[from]
  return {
    ...d,
    meta: {
      ...d.meta,
      editor: { ...d.meta.editor, boundaryStyles: styles },
    },
  }
}
