import {
  COMPONENT_TYPES,
  FLOW_SHAPES,
  type ArrowHead,
  type BoxStyle,
  type ColorTag,
  type FlowShape,
  type LineStyle,
  type StandaloneLine,
} from '../types'
import { colorTagsOf } from '../domain/colorTags'
import { getBoundaryStyle } from '../domain/boundaryStyle'
import { BOUNDARY_PAD_MAX, BOUNDARY_PAD_MIN } from '../domain/geom'
import { architectureMode, ensurePos, ensureSize, isArchitecture, isFlowchart, sortedLayers } from '../domain/document'
import type { ThemeMode } from '../domain/style'
import type {
  AnyDiagram,
  ArchifyBoundary,
  ArchifyComponent,
  ArchifyConnection,
  FlowchartEdge,
  FlowchartNode,
} from '../types'
import { ColorPicker } from './ColorPicker'
import { NumberInput } from './NumberInput'
import type { TextHAlign, TextVAlign } from '../domain/textWrap'

const HALIGN_OPTIONS: Array<{ value: TextHAlign; label: string }> = [
  { value: 'left', label: '左' },
  { value: 'center', label: '中' },
  { value: 'right', label: '右' },
]
const VALIGN_OPTIONS: Array<{ value: TextVAlign; label: string }> = [
  { value: 'top', label: '上' },
  { value: 'middle', label: '中' },
  { value: 'bottom', label: '下' },
]

function FontBorderControls({
  style,
  onPatch,
  fillAllowNone = true,
  fontSizeFallback = 13,
  strokeWidthFallback = 1.6,
  showSubFontSize = true,
}: {
  style: BoxStyle
  onPatch: (patch: BoxStyle) => void
  fillAllowNone?: boolean
  fontSizeFallback?: number
  strokeWidthFallback?: number
  /** 节点有附标题/第二行；区域框无 */
  showSubFontSize?: boolean
}) {
  const dashed = Boolean(style.strokeDasharray && String(style.strokeDasharray).trim())
  const subFallback = Math.max(9, Math.round((style.fontSize ?? fontSizeFallback) * 0.85))
  return (
    <>
      <ColorPicker
        label="填充"
        value={style.fill ?? ''}
        allowNone={fillAllowNone}
        onChange={(fill) => onPatch({ fill })}
      />
      <ColorPicker label="描边" value={style.stroke ?? ''} onChange={(stroke) => onPatch({ stroke })} />
      <ColorPicker label="文字" value={style.text ?? ''} onChange={(text) => onPatch({ text })} />
      <label>标题字号</label>
      <NumberInput
        min={8}
        max={48}
        step={1}
        value={style.fontSize ?? fontSizeFallback}
        fallback={fontSizeFallback}
        onCommit={(fontSize) => onPatch({ fontSize })}
      />
      {showSubFontSize ? (
        <>
          <label>附标题字号</label>
          <NumberInput
            min={8}
            max={48}
            step={1}
            value={style.subFontSize ?? subFallback}
            fallback={subFallback}
            onCommit={(subFontSize) => onPatch({ subFontSize })}
          />
        </>
      ) : null}
      <label>字体风格</label>
      <div className="row">
        <button
          type="button"
          className={style.fontWeight === 'bold' ? 'active' : ''}
          title="加粗"
          onClick={() =>
            onPatch({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })
          }
        >
          B
        </button>
        <button
          type="button"
          className={style.fontStyle === 'italic' ? 'active' : ''}
          title="斜体"
          onClick={() =>
            onPatch({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })
          }
        >
          I
        </button>
      </div>
      <label>文字位置</label>
      <div className="align-grid" role="group" aria-label="文字位置">
        {VALIGN_OPTIONS.map((v) =>
          HALIGN_OPTIONS.map((h) => {
            const active = (style.textHAlign ?? 'center') === h.value && (style.textVAlign ?? 'middle') === v.value
            return (
              <button
                key={`${v.value}-${h.value}`}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                title={`${v.label}${h.value === 'center' ? '中' : h.label}`}
                onClick={() => onPatch({ textHAlign: h.value, textVAlign: v.value })}
              >
                {v.label === '中' && h.value === 'center' ? '◇' : `${v.label}${h.label}`}
              </button>
            )
          }),
        )}
      </div>
      <label>描边宽度</label>
      <NumberInput
        min={0.5}
        step={0.1}
        value={style.strokeWidth ?? strokeWidthFallback}
        fallback={strokeWidthFallback}
        onCommit={(strokeWidth) => onPatch({ strokeWidth })}
      />
      <label>边框线型</label>
      <select
        value={dashed ? 'dash' : 'solid'}
        onChange={(e) =>
          onPatch({ strokeDasharray: e.target.value === 'dash' ? '6 4' : '' })
        }
      >
        <option value="solid">实线</option>
        <option value="dash">虚线</option>
      </select>
    </>
  )
}

function TagField({
  tags,
  tagId,
  onBind,
  onCreate,
  onRename,
}: {
  tags: ColorTag[]
  tagId?: string
  onBind?: (tagId: string | null) => void
  onCreate?: () => void
  onRename?: (label: string) => void
}) {
  const current = tags.find((tag) => tag.id === tagId)
  return (
    <>
      <label>色标</label>
      <select value={tagId ?? ''} onChange={(e) => onBind?.(e.target.value || null)}>
        <option value="">不使用色标</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.label}
          </option>
        ))}
      </select>
      {current ? (
        <>
          <label>色标名称</label>
          <input value={current.label} onChange={(e) => onRename?.(e.target.value)} />
        </>
      ) : null}
      <button type="button" onClick={onCreate}>
        新建色标
      </button>
      <p className="hint">改色标后，引用它的框一起变。架构图导出仍按组件类型着色。</p>
    </>
  )
}

type Props = {
  diagram: AnyDiagram
  theme?: ThemeMode
  selectedNode: ArchifyComponent | FlowchartNode | null
  /** 多选时 > 1：检查器进入批量改色/形状/尺寸模式 */
  selectedCount?: number
  selectedIds?: string[]
  selectedBoundaryCount?: number
  selectedLaneCount?: number
  selectedEdge: ArchifyConnection | FlowchartEdge | null
  selectedLine?: StandaloneLine | null
  selectedBoundary?: ArchifyBoundary | null
  selectedBoundaryIndex?: number | null
  onMeta: (patch: { title?: string; subtitle?: string }) => void
  onNode: (id: string, patch: Record<string, unknown>) => void
  onEdge: (id: string, patch: Record<string, unknown>) => void
  onLine?: (id: string, patch: Partial<StandaloneLine>) => void
  onBoundary?: (index: number, patch: Partial<ArchifyBoundary>) => void
  onBoundaryStyle?: (index: number, patch: Partial<BoxStyle>) => void
  onAssignLayer?: (id: string, index: number) => void
  onBindTag?: (ids: string[], tagId: string | null) => void
  onCreateTag?: (ids: string[]) => void
  onRenameTag?: (tagId: string, label: string) => void
}

export function Inspector({
  diagram,
  theme = 'dark',
  selectedNode,
  selectedCount = 0,
  selectedIds = [],
  selectedBoundaryCount = 0,
  selectedLaneCount = 0,
  selectedEdge,
  selectedLine = null,
  selectedBoundary = null,
  selectedBoundaryIndex = null,
  onMeta,
  onNode,
  onEdge,
  onLine,
  onBoundary,
  onBoundaryStyle,
  onAssignLayer,
  onBindTag,
  onCreateTag,
  onRenameTag,
}: Props) {
  const layers = isArchitecture(diagram) ? sortedLayers(diagram) : []
  const multi =
    Boolean(selectedNode) &&
    (selectedCount > 1 || selectedBoundaryCount > 0 || selectedLaneCount > 0)
  const selectionSummary = [
    `${selectedCount} 个图形`,
    selectedBoundaryCount ? `${selectedBoundaryCount} 个区域框` : null,
    selectedLaneCount ? `${selectedLaneCount} 个泳道` : null,
  ]
    .filter(Boolean)
    .join('、')

  if (selectedBoundary && selectedBoundaryIndex != null) {
    const base = selectedBoundary.pad ?? 16
    const padLeft = selectedBoundary.padLeft ?? selectedBoundary.padX ?? base
    const padRight = selectedBoundary.padRight ?? selectedBoundary.padX ?? base
    const padTop = selectedBoundary.padTop ?? selectedBoundary.padY ?? base
    const padBottom = selectedBoundary.padBottom ?? selectedBoundary.padY ?? base
    const clamp = (n: number) =>
      Math.max(BOUNDARY_PAD_MIN, Math.min(BOUNDARY_PAD_MAX, n || BOUNDARY_PAD_MIN))
    const patchPads = (next: {
      padLeft: number
      padRight: number
      padTop: number
      padBottom: number
    }) => {
      const padX = Math.max(next.padLeft, next.padRight)
      const padY = Math.max(next.padTop, next.padBottom)
      onBoundary?.(selectedBoundaryIndex, {
        ...next,
        padX,
        padY,
        pad: Math.max(padX, padY),
      })
    }
    const bst = getBoundaryStyle(diagram, selectedBoundary.label, theme)
    return (
      <>
        <label>类型</label>
        <input value="区域框（boundary）" readOnly />
        <label>名称</label>
        <input
          autoFocus
          value={selectedBoundary.label}
          onChange={(e) => onBoundary?.(selectedBoundaryIndex, { label: e.target.value })}
        />
        {selectedBoundary.pos && selectedBoundary.size ? (
          <p className="hint">手绘区域框使用固定矩形；拖动边框 / 角点调整大小。</p>
        ) : (
<>        <label>左内边距（拖左边）</label>
        <input
          type="number"
          min={BOUNDARY_PAD_MIN}
          max={BOUNDARY_PAD_MAX}
          value={padLeft}
          onChange={(e) =>
            patchPads({
              padLeft: clamp(Number(e.target.value)),
              padRight,
              padTop,
              padBottom,
            })
          }
        />
        <label>右内边距（拖右边）</label>
        <input
          type="number"
          min={BOUNDARY_PAD_MIN}
          max={BOUNDARY_PAD_MAX}
          value={padRight}
          onChange={(e) =>
            patchPads({
              padLeft,
              padRight: clamp(Number(e.target.value)),
              padTop,
              padBottom,
            })
          }
        />
        <label>上内边距（拖上边）</label>
        <input
          type="number"
          min={BOUNDARY_PAD_MIN}
          max={BOUNDARY_PAD_MAX}
          value={padTop}
          onChange={(e) =>
            patchPads({
              padLeft,
              padRight,
              padTop: clamp(Number(e.target.value)),
              padBottom,
            })
          }
        />
        <label>下内边距（拖下边）</label>
        <input
          type="number"
          min={BOUNDARY_PAD_MIN}
          max={BOUNDARY_PAD_MAX}
          value={padBottom}
          onChange={(e) =>
            patchPads({
              padLeft,
              padRight,
              padTop,
              padBottom: clamp(Number(e.target.value)),
            })
          }
        />
</>
        )}
        <FontBorderControls
          style={{ ...bst, fontSize: bst.fontSize ?? 12 }}
          fillAllowNone
          fontSizeFallback={12}
          strokeWidthFallback={1.5}
          showSubFontSize={false}
          onPatch={(patch) => onBoundaryStyle?.(selectedBoundaryIndex, patch)}
        />
        <label>包含组件</label>
        <div className="wraps-list">
          {(isArchitecture(diagram) ? diagram.components : diagram.nodes).map((component) => {
            const on = selectedBoundary.wraps.includes(component.id)
            return (
              <label key={component.id} className="wraps-item">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    const wraps = on
                      ? selectedBoundary.wraps.filter((id) => id !== component.id)
                      : [...selectedBoundary.wraps, component.id]
                    onBoundary?.(selectedBoundaryIndex, { wraps })
                  }}
                />
                {component.label || component.id}
              </label>
            )
          })}
        </div>
        <p className="hint">
          勾选即加入或移出这个区域。颜色存 meta.editor，导出 Archify 时剥离。
        </p>
      </>
    )
  }

  if (selectedNode) {
    const pos = ensurePos(selectedNode.pos, 0)
    const size = ensureSize(selectedNode.size)
    const style = selectedNode.style ?? {}
    const arch = 'type' in selectedNode
    if (multi) {
      const multiSizes = selectedIds.map((id) => {
        if (isFlowchart(diagram)) {
          return ensureSize(diagram.nodes.find((n) => n.id === id)?.size)
        }
        if (isArchitecture(diagram)) {
          return ensureSize(diagram.components.find((c) => c.id === id)?.size)
        }
        return ensureSize(undefined)
      })
      const sameW = multiSizes.length > 0 && multiSizes.every((s) => s[0] === multiSizes[0][0])
      const sameH = multiSizes.length > 0 && multiSizes.every((s) => s[1] === multiSizes[0][1])
      return (
        <>
          <label>多选</label>
          <input value={`已选 ${selectionSummary}`} readOnly />
          <p className="hint">
            以下修改会应用到全部选中图形（宽/高可统一；Ctrl+A 时填充、字号、文字色、描边和线型还可同步区域框）。Shift/Ctrl
            点选，空白处拖拽框选。
          </p>
          {arch ? (
            <>
              <label>统一类型</label>
              <select
                value={(selectedNode as ArchifyComponent).type}
                onChange={(e) => onNode(selectedNode.id, { type: e.target.value })}
              >
                {COMPONENT_TYPES.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label>统一框体形状</label>
              <select
                value={(selectedNode as ArchifyComponent).shape ?? ''}
                onChange={(e) =>
                  onNode(selectedNode.id, {
                    shape: e.target.value ? (e.target.value as FlowShape) : undefined,
                  })
                }
              >
                <option value="">架构组件卡片</option>
                {FLOW_SHAPES.map((s) => (
                  <option key={s.shape} value={s.shape}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label>统一形状</label>
              <select
                value={(selectedNode as FlowchartNode).shape}
                onChange={(e) => onNode(selectedNode.id, { shape: e.target.value })}
              >
                {FLOW_SHAPES.map((s) => (
                  <option key={s.shape} value={s.shape}>
                    {s.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <div className="row">
            <div>
              <label>统一宽</label>
              <input
                type="number"
                min={40}
                placeholder={sameW ? undefined : '混合'}
                value={sameW ? multiSizes[0][0] : ''}
                onChange={(e) => {
                  const width = Number(e.target.value)
                  if (!Number.isFinite(width)) return
                  onNode(selectedNode.id, { width })
                }}
              />
            </div>
            <div>
              <label>统一高</label>
              <input
                type="number"
                min={24}
                placeholder={sameH ? undefined : '混合'}
                value={sameH ? multiSizes[0][1] : ''}
                onChange={(e) => {
                  const height = Number(e.target.value)
                  if (!Number.isFinite(height)) return
                  onNode(selectedNode.id, { height })
                }}
              />
            </div>
          </div>
          <TagField
            tags={colorTagsOf(diagram)}
            tagId={selectedNode.tagId}
            onBind={(tagId) => onBindTag?.(selectedIds.length ? selectedIds : [selectedNode.id], tagId)}
            onCreate={() => onCreateTag?.(selectedIds.length ? selectedIds : [selectedNode.id])}
            onRename={(label) => selectedNode.tagId && onRenameTag?.(selectedNode.tagId, label)}
          />
          <FontBorderControls
            style={style}
            onPatch={(patch) => onNode(selectedNode.id, { style: patch })}
          />
        </>
      )
    }
    return (
      <>
        <label>ID</label>
        <input value={selectedNode.id} readOnly />
        {arch ? (
          <>
            <label>类型</label>
            <select
              value={(selectedNode as ArchifyComponent).type}
              onChange={(e) => onNode(selectedNode.id, { type: e.target.value })}
            >
              {COMPONENT_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <label>框体形状</label>
            <select
              value={(selectedNode as ArchifyComponent).shape ?? ''}
              onChange={(e) =>
                onNode(selectedNode.id, {
                  shape: e.target.value ? (e.target.value as FlowShape) : undefined,
                })
              }
            >
              <option value="">架构组件卡片</option>
              {FLOW_SHAPES.map((s) => (
                <option key={s.shape} value={s.shape}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label>形状</label>
            <select
              value={(selectedNode as FlowchartNode).shape}
              onChange={(e) => onNode(selectedNode.id, { shape: e.target.value })}
            >
              {FLOW_SHAPES.map((s) => (
                <option key={s.shape} value={s.shape}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
        <label>标题（支持换行）</label>
        <textarea
          rows={3}
          value={selectedNode.label}
          onChange={(e) => onNode(selectedNode.id, { label: e.target.value })}
        />
        {arch ? (
          <>
            <label>副标题</label>
            <input
              value={(selectedNode as ArchifyComponent).sublabel ?? ''}
              onChange={(e) => onNode(selectedNode.id, { sublabel: e.target.value })}
            />
          </>
        ) : null}
        <div className="row">
          <div>
            <label>X</label>
            <input
              type="number"
              value={pos[0]}
              onChange={(e) => onNode(selectedNode.id, { pos: [Number(e.target.value), pos[1]] })}
            />
          </div>
          <div>
            <label>Y</label>
            <input
              type="number"
              value={pos[1]}
              onChange={(e) => onNode(selectedNode.id, { pos: [pos[0], Number(e.target.value)] })}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label>宽</label>
            <input
              type="number"
              min={40}
              value={size[0]}
              onChange={(e) => onNode(selectedNode.id, { size: [Number(e.target.value), size[1]] })}
            />
          </div>
          <div>
            <label>高</label>
            <input
              type="number"
              min={24}
              value={size[1]}
              onChange={(e) => onNode(selectedNode.id, { size: [size[0], Number(e.target.value)] })}
            />
          </div>
        </div>
        {isArchitecture(diagram) && architectureMode(diagram) === 'layered' && onAssignLayer ? (
          <>
            <label>所属层</label>
            <select
              value={String(
                Math.max(
                  0,
                  layers.findIndex((l) =>
                    (diagram.boundaries ?? []).find((b) => b.label === l.label)?.wraps.includes(selectedNode.id),
                  ),
                ),
              )}
              onChange={(e) => onAssignLayer(selectedNode.id, Number(e.target.value))}
            >
              {layers.map((l, i) => (
                <option key={l.id} value={i}>
                  {l.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <TagField
          tags={colorTagsOf(diagram)}
          tagId={selectedNode.tagId}
          onBind={(tagId) => onBindTag?.([selectedNode.id], tagId)}
          onCreate={() => onCreateTag?.([selectedNode.id])}
          onRename={(label) => selectedNode.tagId && onRenameTag?.(selectedNode.tagId, label)}
        />
        <FontBorderControls
          style={style}
          onPatch={(patch) => onNode(selectedNode.id, { style: { ...style, ...patch } })}
        />
      </>
    )
  }

  if (selectedLine) {
    const st = selectedLine.style ?? {}
    return (
      <>
        <label>类型</label>
        <input
          value={selectedLine.route === 'ortho' ? '独立折线' : '独立直线'}
          readOnly
        />
        <label>端点数</label>
        <input value={String(selectedLine.points.length)} readOnly />
        <p className="hint">拖动线上任一端点 / 拐点可改形状；方向键可整线微调。</p>
        <label>线颜色</label>
        <ColorPicker
          compact
          label="线颜色"
          value={st.stroke ?? '#94a3b8'}
          onChange={(stroke) => onLine?.(selectedLine.id, { style: { ...st, stroke } })}
        />
        <label>线宽</label>
        <input
          type="number"
          min={1}
          max={8}
          value={st.strokeWidth ?? 1.5}
          onChange={(e) =>
            onLine?.(selectedLine.id, { style: { ...st, strokeWidth: Number(e.target.value) } })
          }
        />
        <label>箭头</label>
        <select
          value={st.arrow ?? 'end'}
          onChange={(e) =>
            onLine?.(selectedLine.id, { style: { ...st, arrow: e.target.value as ArrowHead } })
          }
        >
          <option value="none">无</option>
          <option value="end">末端</option>
          <option value="start">起点</option>
          <option value="both">双向</option>
        </select>
      </>
    )
  }

  if (selectedEdge) {
    const st = selectedEdge.style ?? {}
    const arrow = (st.arrow ?? 'end') as ArrowHead
    const flow = isFlowchart(diagram)
    const route = 'route' in selectedEdge ? selectedEdge.route : undefined
    return (
      <>
        <label>边 ID</label>
        <input value={selectedEdge.id} readOnly />
        <label>From → To</label>
        <input value={`${selectedEdge.from} → ${selectedEdge.to}`} readOnly />
        <label>文字标签</label>
        <input
          autoFocus
          placeholder="如：是 / HTTPS / 调用"
          value={selectedEdge.label ?? ''}
          onChange={(e) => onEdge(selectedEdge.id, { label: e.target.value })}
        />
        <p className="hint" style={{ marginTop: 4 }}>
          画布上双击连线也可直接改文字。
        </p>
        <label>连线样式</label>
        {flow ? (
          <select
            value={route === 'straight' || route === 'curve' ? route : 'ortho'}
            onChange={(e) => onEdge(selectedEdge.id, { route: e.target.value })}
          >
            <option value="straight">直线</option>
            <option value="ortho">折线（正交，对齐 Archify HTML）</option>
            <option value="curve">曲线</option>
          </select>
        ) : null}
        {flow ? (
          <>
            <label>起点锚点</label>
            <select
              value={('fromSide' in selectedEdge && selectedEdge.fromSide) || 'auto'}
              onChange={(e) =>
                onEdge(selectedEdge.id, {
                  fromSide: e.target.value === 'auto' ? undefined : e.target.value,
                })
              }
            >
              <option value="auto">自动</option>
              <option value="n">上</option>
              <option value="s">下</option>
              <option value="e">右</option>
              <option value="w">左</option>
            </select>
            <label>终点锚点</label>
            <select
              value={('toSide' in selectedEdge && selectedEdge.toSide) || 'auto'}
              onChange={(e) =>
                onEdge(selectedEdge.id, {
                  toSide: e.target.value === 'auto' ? undefined : e.target.value,
                })
              }
            >
              <option value="auto">自动</option>
              <option value="n">上</option>
              <option value="s">下</option>
              <option value="e">右</option>
              <option value="w">左</option>
            </select>
          </>
        ) : null}
        {!flow ? (
          <select
            value={route ?? 'auto'}
            onChange={(e) => onEdge(selectedEdge.id, { route: e.target.value })}
          >
            <option value="auto">自动（正交，同 Archify）</option>
            <option value="straight">直线</option>
            <option value="orthogonal-h">折线 · 水平优先</option>
            <option value="orthogonal-v">折线 · 垂直优先</option>
            <option value="curve">曲线（编辑态；导出时变回 auto）</option>
          </select>
        ) : null}
        <label>箭头</label>
        <select
          value={arrow}
          onChange={(e) =>
            onEdge(selectedEdge.id, {
              style: { ...st, arrow: e.target.value as ArrowHead } satisfies LineStyle,
            })
          }
        >
          <option value="end">末端箭头 →</option>
          <option value="start">起点箭头 ←</option>
          <option value="both">双向箭头 ↔</option>
          <option value="none">无箭头</option>
        </select>
        <ColorPicker
          label="连线颜色"
          value={st.stroke ?? ''}
          onChange={(stroke) => onEdge(selectedEdge.id, { style: { ...st, stroke } satisfies LineStyle })}
        />
        <ColorPicker
          label="标签背景"
          value={st.labelFill ?? 'none'}
          allowNone
          onChange={(labelFill) =>
            onEdge(selectedEdge.id, { style: { ...st, labelFill } satisfies LineStyle })
          }
        />
        <label>线宽</label>
        <NumberInput
          min={0.5}
          step={0.1}
          value={st.strokeWidth ?? 1.6}
          fallback={1.6}
          onCommit={(strokeWidth) =>
            onEdge(selectedEdge.id, { style: { ...st, strokeWidth } satisfies LineStyle })
          }
        />
        <label>线型</label>
        <select
          value={st.strokeDasharray && String(st.strokeDasharray).trim() ? 'dash' : 'solid'}
          onChange={(e) =>
            onEdge(selectedEdge.id, {
              style: {
                ...st,
                strokeDasharray: e.target.value === 'dash' ? '6 4' : '',
              } satisfies LineStyle,
            })
          }
        >
          <option value="solid">实线</option>
          <option value="dash">虚线</option>
        </select>
        <p className="hint">选中连线后可拖拽标签偏移位置（导出 Mermaid 可能丢失偏移）。</p>
      </>
    )
  }

  return (
    <>
      <label>图标题</label>
      <input value={diagram.meta.title} onChange={(e) => onMeta({ title: e.target.value })} />
      <label>副标题</label>
      <input value={diagram.meta.subtitle ?? ''} onChange={(e) => onMeta({ subtitle: e.target.value })} />
      <p className="hint">
        {isFlowchart(diagram)
          ? '流程图：判断节点可拉出多条带标签的边。框体可缩放、可改颜色。'
          : '架构图：导出 JSON 或 Finalize HTML。框体可缩放、可改颜色。分层模式节点会钳制在层带内。'}
      </p>
    </>
  )
}
