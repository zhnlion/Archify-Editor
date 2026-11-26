import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AlignAxis } from '../domain/align'

export type AlignMenuAction =
  | { kind: 'align'; axis: AlignAxis }
  | { kind: 'distribute'; axis: 'horizontal' | 'vertical' }

type Item = {
  id: string
  label: string
  hint: string
  enabled: boolean
  action: AlignMenuAction
}

type Props = {
  canAlign: boolean
  canDistribute: boolean
  onAction: (action: AlignMenuAction) => void
}

type MenuPos = { top: number; left: number; minWidth: number }

/** 工具栏：对齐 / 等距分布合一菜单 */
export function AlignMenu({ canAlign, canDistribute, onAction }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const items: Item[] = [
    {
      id: 'left',
      label: '左对齐',
      hint: '以主选左缘为基准',
      enabled: canAlign,
      action: { kind: 'align', axis: 'left' },
    },
    {
      id: 'right',
      label: '右对齐',
      hint: '以主选右缘为基准',
      enabled: canAlign,
      action: { kind: 'align', axis: 'right' },
    },
    {
      id: 'center',
      label: '居中对齐',
      hint: '水平居中：对齐主选竖直中线',
      enabled: canAlign,
      action: { kind: 'align', axis: 'center' },
    },
    {
      id: 'top',
      label: '顶对齐',
      hint: '以主选顶边为基准',
      enabled: canAlign,
      action: { kind: 'align', axis: 'top' },
    },
    {
      id: 'bottom',
      label: '底对齐',
      hint: '以主选底边为基准',
      enabled: canAlign,
      action: { kind: 'align', axis: 'bottom' },
    },
    {
      id: 'middle',
      label: '垂直居中',
      hint: '对齐主选水平中线',
      enabled: canAlign,
      action: { kind: 'align', axis: 'middle' },
    },
    {
      id: 'dist-h',
      label: '水平等距分布',
      hint: '选中 ≥3 个图形，或泳道框体',
      enabled: canDistribute,
      action: { kind: 'distribute', axis: 'horizontal' },
    },
    {
      id: 'dist-v',
      label: '垂直等距分布',
      hint: '选中 ≥3 个图形，或泳道框体',
      enabled: canDistribute,
      action: { kind: 'distribute', axis: 'vertical' },
    },
  ]

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null)
      return
    }
    const place = () => {
      const btn = triggerRef.current?.querySelector('button')
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const pad = 8
      const width = Math.max(220, r.width)
      let left = r.left
      if (left + width > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - width - pad)
      setPos({ top: r.bottom + 6, left, minWidth: width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const anyEnabled = canAlign || canDistribute

  return (
    <div className={`format-menu ${open ? 'open' : ''}`} ref={triggerRef} title="对齐与等距分布">
      <button
        type="button"
        disabled={!anyEnabled}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        对齐
        <span className="format-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="format-dropdown format-dropdown--portal"
              role="menu"
              style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
            >
              <div className="format-dropdown-title">对齐</div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="format-item"
                  disabled={!item.enabled}
                  title={item.enabled ? item.hint : `${item.hint}（当前不可用）`}
                  onClick={() => {
                    if (!item.enabled) return
                    setOpen(false)
                    onAction(item.action)
                  }}
                >
                  <span className="format-item-label">{item.label}</span>
                  <span className="format-item-hint">{item.hint}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
