import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FormatItem } from '../io/formats'

type Props<Id extends string> = {
  label: string
  primary?: boolean
  items: FormatItem<Id>[]
  onPick: (id: Id) => void
  title?: string
}

type MenuPos = { top: number; left: number; minWidth: number }

/** 先选格式类型再执行（选文件 / 导出） */
export function FormatMenu<Id extends string>({ label, primary, items, onPick, title }: Props<Id>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<MenuPos | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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
      const width = Math.max(260, r.width)
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

  return (
    <div className={`format-menu ${open ? 'open' : ''}`} ref={triggerRef} title={title}>
      <button
        type="button"
        className={primary ? 'primary' : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
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
              <div className="format-dropdown-title">选择格式</div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  className="format-item"
                  disabled={!item.enabled}
                  title={item.enabled ? item.hint : item.disabledReason ?? item.hint}
                  onClick={() => {
                    if (!item.enabled) return
                    setOpen(false)
                    onPick(item.id)
                  }}
                >
                  <span className="format-item-label">{item.label}</span>
                  <span className="format-item-hint">
                    {item.enabled ? item.hint : item.disabledReason ?? '暂不可用'}
                  </span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
