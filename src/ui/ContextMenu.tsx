import { useEffect, useRef } from 'react'
import type { ArrowHead } from '../types'
import type { ContextTarget, Selection } from './Canvas'
import { ColorPicker } from './ColorPicker'

export type ThemeMode = 'dark' | 'light'

export type ContextMenuState = {
  x: number
  y: number
  target: ContextTarget
} | null

export type StyleSnapshot = {
  fill: string
  stroke: string
  text: string
  edgeStroke: string
}

type Props = {
  menu: ContextMenuState
  theme: ThemeMode
  /** 画布网格是否显示 */
  showGrid?: boolean
  snapToGrid?: boolean
  /** 当前选中节点数（≥2 显示对齐） */
  multiNodeCount?: number
  canPaste: boolean
  styles: StyleSnapshot
  onClose: () => void
  onAction: (action: ContextAction) => void
}

export type ContextAction =
  | { type: 'cut' }
  | { type: 'copy' }
  | { type: 'paste' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'bring-front' }
  | { type: 'send-back' }
  | { type: 'edit-label' }
  | { type: 'style'; patch: { fill?: string; stroke?: string; text?: string } }
  | { type: 'edge-style'; patch: { stroke?: string; arrow?: ArrowHead } }
  | { type: 'line-style'; patch: { stroke?: string } }
  | { type: 'boundary-style'; patch: { fill?: string; stroke?: string; text?: string } }
  | { type: 'theme'; theme: ThemeMode }
  | { type: 'toggle-grid' }
  | { type: 'toggle-snap' }
  | { type: 'align'; axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' }
  | { type: 'distribute'; axis: 'horizontal' | 'vertical' }
  | { type: 'add-boundary' }

export function ContextMenu({
  menu,
  theme,
  showGrid = true,
  snapToGrid = true,
  multiNodeCount = 0,
  canPaste,
  styles,
  onClose,
  onAction,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, onClose])

  if (!menu) return null

  const run = (action: ContextAction, close = true) => {
    onAction(action)
    if (close) onClose()
  }

  const { target } = menu
  const left = Math.min(menu.x, window.innerWidth - 280)
  const top = Math.min(menu.y, window.innerHeight - 420)

  return (
    <div ref={ref} className="ctx-menu" style={{ left, top }} role="menu">
      {target.kind === 'node' ? (
        <>
          <button type="button" onClick={() => run({ type: 'edit-label' })}>
            编辑文字
          </button>
          <div className="ctx-sep" />
          <button type="button" onClick={() => run({ type: 'cut' })}>
            剪切
          </button>
          <button type="button" onClick={() => run({ type: 'copy' })}>
            复制
          </button>
          <button type="button" onClick={() => run({ type: 'duplicate' })}>
            创建副本
          </button>
          <button type="button" className="danger" onClick={() => run({ type: 'delete' })}>
            删除
          </button>
          <div className="ctx-sep" />
          <button type="button" onClick={() => run({ type: 'bring-front' })}>
            置于顶层
          </button>
          <button type="button" onClick={() => run({ type: 'send-back' })}>
            置于底层
          </button>
          {multiNodeCount >= 2 ? (
            <>
              <div className="ctx-sep" />
              <div className="ctx-label">对齐（主选为基准）</div>
              <button type="button" onClick={() => run({ type: 'align', axis: 'left' })}>
                左对齐
              </button>
              <button type="button" onClick={() => run({ type: 'align', axis: 'right' })}>
                右对齐
              </button>
              <button type="button" onClick={() => run({ type: 'align', axis: 'center' })}>
                居中对齐
              </button>
              <button type="button" onClick={() => run({ type: 'align', axis: 'top' })}>
                顶对齐
              </button>
              <button type="button" onClick={() => run({ type: 'align', axis: 'bottom' })}>
                底对齐
              </button>
              <button type="button" onClick={() => run({ type: 'align', axis: 'middle' })}>
                垂直居中
              </button>
              {multiNodeCount >= 3 ? (
                <>
                  <button type="button" onClick={() => run({ type: 'distribute', axis: 'horizontal' })}>
                    水平等距分布
                  </button>
                  <button type="button" onClick={() => run({ type: 'distribute', axis: 'vertical' })}>
                    垂直等距分布
                  </button>
                </>
              ) : null}
            </>
          ) : null}
          <div className="ctx-sep" />
          <ColorPicker
            compact
            label="填充色"
            value={styles.fill}
            onChange={(fill) => run({ type: 'style', patch: { fill } }, false)}
          />
          <ColorPicker
            compact
            label="描边色"
            value={styles.stroke}
            onChange={(stroke) => run({ type: 'style', patch: { stroke } }, false)}
          />
          <ColorPicker
            compact
            label="文字色"
            value={styles.text}
            onChange={(text) => run({ type: 'style', patch: { text } }, false)}
          />
        </>
      ) : null}

      {target.kind === 'edge' ? (
        <>
          <button type="button" onClick={() => run({ type: 'edit-label' })}>
            编辑文字
          </button>
          <button type="button" className="danger" onClick={() => run({ type: 'delete' })}>
            删除连线
          </button>
          <div className="ctx-sep" />
          <div className="ctx-label">箭头</div>
          <button type="button" onClick={() => run({ type: 'edge-style', patch: { arrow: 'end' } })}>
            末端箭头 →
          </button>
          <button type="button" onClick={() => run({ type: 'edge-style', patch: { arrow: 'start' } })}>
            起点箭头 ←
          </button>
          <button type="button" onClick={() => run({ type: 'edge-style', patch: { arrow: 'both' } })}>
            双向箭头 ↔
          </button>
          <button type="button" onClick={() => run({ type: 'edge-style', patch: { arrow: 'none' } })}>
            无箭头
          </button>
          <div className="ctx-sep" />
          <ColorPicker
            compact
            label="连线颜色"
            value={styles.edgeStroke}
            onChange={(stroke) => run({ type: 'edge-style', patch: { stroke } }, false)}
          />
        </>
      ) : null}

      {target.kind === 'line' ? (
        <>
          <button type="button" className="danger" onClick={() => run({ type: 'delete' })}>
            删除独立线
          </button>
          <div className="ctx-sep" />
          <ColorPicker
            compact
            label="线颜色"
            value={styles.edgeStroke}
            onChange={(stroke) => run({ type: 'line-style', patch: { stroke } }, false)}
          />
        </>
      ) : null}

      {target.kind === 'boundary' ? (
        <>
          <button type="button" onClick={() => run({ type: 'edit-label' })}>
            重命名区域
          </button>
          <button type="button" className="danger" onClick={() => run({ type: 'delete' })}>
            删除区域框
          </button>
          <div className="ctx-sep" />
          <ColorPicker
            compact
            label="填充色"
            value={styles.fill}
            onChange={(fill) => run({ type: 'boundary-style', patch: { fill } }, false)}
          />
          <ColorPicker
            compact
            label="描边色"
            value={styles.stroke}
            onChange={(stroke) => run({ type: 'boundary-style', patch: { stroke } }, false)}
          />
          <ColorPicker
            compact
            label="文字色"
            value={styles.text}
            onChange={(text) => run({ type: 'boundary-style', patch: { text } }, false)}
          />
          <p className="ctx-hint">删除仅去掉外框，不删除内部组件。</p>
        </>
      ) : null}

      {target.kind === 'canvas' ? (
        <>
          <button type="button" disabled={!canPaste} onClick={() => run({ type: 'paste' })}>
            粘贴
          </button>
          <button type="button" onClick={() => run({ type: 'add-boundary' })}>
            新建区域框（选中节点）
          </button>
          <div className="ctx-sep" />
          <div className="ctx-label">网格</div>
          <button
            type="button"
            className={showGrid ? 'active' : ''}
            onClick={() => run({ type: 'toggle-grid' })}
          >
            {showGrid ? '去除网格' : '显示网格'}
          </button>
          <button
            type="button"
            className={snapToGrid ? 'active' : ''}
            onClick={() => run({ type: 'toggle-snap' })}
          >
            {snapToGrid ? '关闭吸附' : '吸附网格'}
          </button>
          <div className="ctx-sep" />
          <div className="ctx-label">画布主题 / 背景</div>
          <button
            type="button"
            className={theme === 'light' ? 'active' : ''}
            onClick={() => run({ type: 'theme', theme: 'light' })}
          >
            白天模式
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'active' : ''}
            onClick={() => run({ type: 'theme', theme: 'dark' })}
          >
            黑夜模式
          </button>
        </>
      ) : null}
    </div>
  )
}

export function selectionFromTarget(target: ContextTarget): Selection {
  if (target.kind === 'canvas') return null
  if (target.kind === 'boundary') return { kind: 'boundary', indexes: [target.index] }
  if (target.kind === 'line') return { kind: 'line', id: target.id }
  if (target.kind === 'edge') return { kind: 'edge', id: target.id }
  return { kind: 'nodes', ids: [target.id] }
}
