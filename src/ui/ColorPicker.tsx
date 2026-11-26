import { COLOR_RECOMMENDED, COLOR_STANDARD } from '../types'

/** 任意 CSS 颜色 → #RRGGBB（供 `<input type="color">`；丢弃 alpha） */
export function toColorInput(v: string): string {
  const t = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t
  if (/^#[0-9a-fA-F]{8}$/.test(t)) return `#${t.slice(1, 7)}`
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#[0-9a-fA-F]{4}$/.test(t)) {
    const r = t[1]!
    const g = t[2]!
    const b = t[3]!
    return `#${r}${r}${g}${g}${b}${b}`
  }
  const rgba = t.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i,
  )
  if (rgba) {
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return `#${hex(rgba[1]!)}${hex(rgba[2]!)}${hex(rgba[3]!)}`
  }
  return '#888888'
}

/** 比较用：归一化到 6 位大写 hex（忽略 alpha） */
export function normalizeHex(v: string): string {
  return toColorInput(v).toUpperCase()
}

type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  /** 紧凑模式用于右键菜单 */
  compact?: boolean
  /** 覆盖推荐色；标准色（黑白灰等）始终显示 */
  presets?: string[]
  /** 允许「无填充」→ 写入 none */
  allowNone?: boolean
}

function SwatchRow({
  colors,
  value,
  onChange,
}: {
  colors: string[]
  value: string
  onChange: (v: string) => void
}) {
  const current = normalizeHex(value)
  return (
    <div className="swatch-row">
      {colors.map((c) => {
        const hex = normalizeHex(c)
        const selected = current === hex
        const light = /^#(FFF|EEE|FEF|EFE|F1F|E8F|ECF|FFF4|E7F|FDE|F3E)/i.test(hex)
        return (
          <button
            key={c}
            type="button"
            className={`swatch-btn${selected ? ' selected' : ''}${light ? ' light' : ''}`}
            style={{ background: c }}
            title={c}
            aria-label={c}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )
      })}
    </div>
  )
}

/** 检查器 / 右键：取色器 + 标准色（黑白灰）+ 下方推荐色一键点选 */
export function ColorPicker({
  label,
  value,
  onChange,
  compact = false,
  presets = COLOR_RECOMMENDED,
  allowNone = false,
}: Props) {
  const none = /^(none|transparent)$/i.test(value.trim())
  const preview = none || !value.trim() ? 'transparent' : value.trim()
  return (
    <div className={compact ? 'color-picker compact' : 'color-picker'}>
      {compact ? <div className="ctx-label">{label}</div> : <label>{label}</label>}
      <div className="color-row">
        <span
          className={`color-current${none ? ' none-fill' : ''}`}
          style={{ background: none ? 'transparent' : preview }}
          title={none ? '无填充' : value || '（无）'}
          aria-label={`当前${label} ${none ? '无填充' : value || '无'}`}
        />
        <input
          type="color"
          value={toColorInput(none ? '#FFFFFF' : value)}
          title="更多颜色"
          onChange={(e) => onChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <input
          value={value}
          placeholder="#RRGGBB 或 none"
          onChange={(e) => onChange(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      {allowNone ? (
        <button
          type="button"
          className={`none-fill-btn${none ? ' active' : ''}`}
          title="透明 / 无填充"
          onClick={() => onChange('none')}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          无填充
        </button>
      ) : null}
      <div className={compact ? 'color-swatch-block compact' : 'color-swatch-block'}>
        <div className="swatch-caption">标准色</div>
        <SwatchRow colors={COLOR_STANDARD} value={value} onChange={onChange} />
        <div className="swatch-caption">推荐色</div>
        <SwatchRow colors={presets} value={value} onChange={onChange} />
      </div>
    </div>
  )
}
