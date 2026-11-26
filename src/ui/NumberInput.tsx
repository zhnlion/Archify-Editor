import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  min?: number
  max?: number
  step?: number
  /** 空值占位（如多选混合尺寸） */
  placeholder?: string
  /** 无有效数字时回退（如清空后 blur） */
  fallback?: number
  onCommit: (n: number) => void
}

function clamp(n: number, min?: number, max?: number): number {
  let x = n
  if (min != null) x = Math.max(min, x)
  if (max != null) x = Math.min(max, x)
  return x
}

/** 输入过程中尚未构成完整数字（允许继续手输） */
export function isIncompleteNumberDraft(raw: string): boolean {
  const t = raw.trim()
  return t === '' || t === '-' || t === '.' || t === '-.' || /[eE][+-]?$/.test(t)
}

/**
 * 检查器数字框：支持手输 / 步进器；完整数字 onChange 立即提交，
 * 未完成草稿在 onBlur / Enter 时再解析提交（对齐 ColorPicker 可打字习惯）。
 */
export function NumberInput({ value, min, max, step, placeholder, fallback, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(null)
  }, [value])

  const display = draft ?? (Number.isFinite(value) ? String(value) : '')

  const commitRaw = (raw: string, clearDraft: boolean) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      if (clearDraft) {
        setDraft(null)
        if (fallback != null && fallback !== value) onCommit(clamp(fallback, min, max))
      }
      return
    }
    const next = clamp(n, min, max)
    if (clearDraft) setDraft(null)
    if (next !== value) onCommit(next)
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={display}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (isIncompleteNumberDraft(raw)) return
        commitRaw(raw, false)
      }}
      onBlur={(e) => {
        focused.current = false
        commitRaw(e.target.value, true)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        commitRaw((e.target as HTMLInputElement).value, true)
        ;(e.target as HTMLInputElement).blur()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}
