import type { BoxStyle, ComponentType, FlowShape } from '../types'
import { SHAPE_DEFAULT, TYPE_COLOR } from '../types'

export type ThemeMode = 'dark' | 'light'

/** 常见「主题默认色」——切换昼夜时视为未定制，自动跟主题走（小写比较） */
const IMPLIED_DARK_FILL = new Set(['#1e2731', '#0f1419', '#111827', '#020617', '#0f172a'])
const IMPLIED_DARK_TEXT = new Set(['#e7eef6', '#ffffff', '#f5fbff', '#e2e8f0', '#f8fafc', '#f1f5f9'])
const IMPLIED_LIGHT_FILL = new Set(
  [
    '#f8fafc',
    '#f4f5f7',
    '#f7f8fa',
    '#f0f5ff',
    '#eef3f8',
    '#f2f3f5',
    '#f5f7fa',
    '#e8f3ff',
    ...Object.values(SHAPE_DEFAULT).map((s) => s.fill ?? ''),
  ].map((c) => c.toLowerCase()),
)
const IMPLIED_LIGHT_TEXT = new Set(
  [
    '#0f172a',
    '#111827',
    '#1a2330',
    '#1f2329',
    ...Object.values(SHAPE_DEFAULT).map((s) => s.text ?? ''),
  ].map((c) => c.toLowerCase()),
)

function normHex(v: string | undefined): string {
  return (v ?? '').trim().toLowerCase()
}

/** 去掉与当前主题冲突的「默认色」，保留用户刻意定制 */
export function stripImpliedThemeDefaults(style: BoxStyle | undefined, theme: ThemeMode): BoxStyle | undefined {
  if (!style) return undefined
  const next: BoxStyle = { ...style }
  const fill = normHex(style.fill)
  const text = normHex(style.text)
  if (theme === 'light') {
    if (IMPLIED_DARK_FILL.has(fill)) delete next.fill
    if (IMPLIED_DARK_TEXT.has(text)) delete next.text
  } else {
    if (IMPLIED_LIGHT_FILL.has(fill)) delete next.fill
    if (IMPLIED_LIGHT_TEXT.has(text)) delete next.text
  }
  return next
}

/** 对齐 Archify template：类型填充 / 描边随 data-theme 切换 */
export const ARCH_TYPE_THEME: Record<
  ThemeMode,
  Record<ComponentType, { fill: string; stroke: string; text: string }>
> = {
  dark: {
    external: { fill: 'rgba(30, 41, 59, 0.72)', stroke: '#94a3b8', text: '#f8fafc' },
    frontend: { fill: 'rgba(8, 51, 68, 0.55)', stroke: '#22d3ee', text: '#f8fafc' },
    backend: { fill: 'rgba(6, 78, 59, 0.55)', stroke: '#34d399', text: '#f8fafc' },
    database: { fill: 'rgba(76, 29, 149, 0.5)', stroke: '#a78bfa', text: '#f8fafc' },
    cloud: { fill: 'rgba(120, 53, 15, 0.45)', stroke: '#fbbf24', text: '#f8fafc' },
    security: { fill: 'rgba(136, 19, 55, 0.55)', stroke: '#fb7185', text: '#f8fafc' },
    messagebus: { fill: 'rgba(251, 146, 60, 0.28)', stroke: '#fb923c', text: '#f8fafc' },
  },
  /**
   * 白天：对齐阿里云产品页架构图——黑 / 白 / 灰 / 蓝，少彩、留白多。
   * 类型差异用蓝灰深浅区分，不用绿紫橙粉。
   */
  light: {
    external: { fill: '#FFFFFF', stroke: '#8A949E', text: '#1F2329' },
    frontend: { fill: '#F0F5FF', stroke: '#1677FF', text: '#1F2329' },
    backend: { fill: '#F7F8FA', stroke: '#4E5969', text: '#1F2329' },
    database: { fill: '#EEF3F8', stroke: '#3491FA', text: '#1F2329' },
    cloud: { fill: '#F2F3F5', stroke: '#86909C', text: '#1F2329' },
    security: { fill: '#F5F7FA', stroke: '#3C7EFF', text: '#1F2329' },
    messagebus: { fill: '#E8F3FF', stroke: '#0E42D2', text: '#1F2329' },
  },
}

/** 流程图：白天灰蓝简约；黑夜深底浅字 */
export function flowShapeThemeDefault(shape: FlowShape, theme: ThemeMode): BoxStyle {
  const base = SHAPE_DEFAULT[shape] ?? {
    fill: '#E8F1FF',
    stroke: TYPE_COLOR.frontend,
    text: '#0F172A',
  }
  if (theme === 'light') {
    // 统一压成白底 / 浅灰蓝描边，避免彩虹色块
    const lightStroke =
      shape === 'start' || shape === 'end'
        ? '#1677FF'
        : shape === 'decision'
          ? '#4E5969'
          : '#86909C'
    return {
      fill: shape === 'decision' ? '#F7F8FA' : '#FFFFFF',
      stroke: lightStroke,
      text: '#1F2329',
    }
  }
  return {
    fill: 'rgba(30, 41, 59, 0.85)',
    stroke: base.stroke,
    text: '#f1f5f9',
  }
}

export const BOUNDARY_THEME: Record<ThemeMode, BoxStyle> = {
  dark: {
    fill: 'rgba(45, 212, 191, 0.06)',
    stroke: '#2dd4bf88',
    text: '#94a3b8',
  },
  light: {
    fill: 'rgba(22, 119, 255, 0.04)',
    stroke: '#86909Caa',
    text: '#4E5969',
  },
}

export const EDGE_THEME: Record<ThemeMode, { stroke: string; emphasis: string }> = {
  dark: { stroke: '#64748b', emphasis: '#34d399' },
  light: { stroke: '#86909C', emphasis: '#1677FF' },
}

export const LANE_THEME: Record<ThemeMode, { fill: string; stroke: string; text: string }> = {
  dark: { fill: 'rgba(15, 23, 42, 0.35)', stroke: '#334155', text: '#94a3b8' },
  light: { fill: '#F7F8FA', stroke: '#E5E6EB', text: '#4E5969' },
}
