import {
  FLOW_SHAPES,
  FLOW_SHAPE_GROUPS,
  SHAPE_DEFAULT,
  type FlowShape,
  type LaneOrientation,
} from '../types'
import {
  architectureMode,
  isArchitecture,
  isFlowchart,
  resolveLaneOrientation,
  sortedLayers,
} from '../domain/document'
import type { AnyDiagram } from '../types'
import { PALETTE_MIME, encodePaletteDrag, type LineRouteOption } from '../io/paletteDrag'
import { FlowShapeGeom } from './flowShapeGeom'

type Props = {
  diagram: AnyDiagram
  onAddFlow: (shape: FlowShape) => void
  /** 点击区域框图块：进入拖拽绘制模式 */
  onAddBoundary?: () => void
  /** 点击直线/折线/曲线图块：进入对应绘制模式 */
  onDrawLine?: (route: LineRouteOption) => void
  onAddLayer?: () => void
  onRenameLayer?: (id: string, label: string) => void
  onRemoveLayer?: (id: string) => void
  onSetLaneOrientation?: (orientation: LaneOrientation) => void
  /** layered：跨层连线规则 */
  layerEdgeRule?: 'free' | 'downward'
  onSetLayerEdgeRule?: (rule: 'free' | 'downward') => void
  layerEdgeViolationCount?: number
}

function FlowPreview({ shape }: { shape: FlowShape }) {
  const st = SHAPE_DEFAULT[shape]
  return (
    <FlowShapeGeom
      shape={shape}
      w={56}
      h={28}
      fill={st.fill ?? '#E8F1FF'}
      stroke={st.stroke ?? '#3D9CF0'}
      strokeWidth={1.6}
      className=""
    />
  )
}

const LINE_OPTIONS: { route: LineRouteOption; label: string; d: string }[] = [
  { route: 'straight', label: '直线', d: 'M 8 32 L 56 12' },
  { route: 'ortho', label: '折线', d: 'M 8 32 L 30 32 L 30 14 L 56 14' },
  { route: 'curve', label: '曲线', d: 'M 8 32 C 24 32 26 12 56 12' },
]

function FlowSymbolGroups({
  onAddFlow,
  onAddBoundary,
  onDrawLine,
}: {
  onAddFlow: (shape: FlowShape) => void
  onAddBoundary?: () => void
  onDrawLine?: (route: LineRouteOption) => void
}) {
  return (
    <>
      {FLOW_SHAPE_GROUPS.map((group) => (
        <div key={group.id} className="palette-group">
          <p className="palette-group-title">{group.title}</p>
          <div className="palette-grid">
            {group.shapes.map((shape) => {
              const label = FLOW_SHAPES.find((s) => s.shape === shape)?.label ?? shape
              return (
                <button
                  key={shape}
                  type="button"
                  className="palette-tile"
                  title={`${label}（拖到画布或点击插入）`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PALETTE_MIME, encodePaletteDrag({ kind: 'flow', shape }))
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => onAddFlow(shape)}
                >
                  <svg className="palette-preview" viewBox="0 0 64 44" aria-hidden>
                    <g transform="translate(4,8)">
                      <FlowPreview shape={shape} />
                    </g>
                  </svg>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {onAddBoundary ? (
        <div className="palette-group">
          <p className="palette-group-title">容器</p>
          <div className="palette-grid">
            <button
              type="button"
              className="palette-tile"
              title="区域框（拖到画布放置，或点击后拖拽绘制）"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(PALETTE_MIME, encodePaletteDrag({ kind: 'boundary' }))
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAddBoundary()}
            >
              <svg className="palette-preview" viewBox="0 0 64 44" aria-hidden>
                <rect
                  x={7}
                  y={9}
                  width={50}
                  height={27}
                  rx={6}
                  fill="var(--accent, #2dd4bf)"
                  fillOpacity={0.08}
                  stroke="var(--accent, #2dd4bf)"
                  strokeWidth={1.6}
                  strokeDasharray="5 3"
                />
                <text x={13} y={21} fontSize={9} fill="var(--text, #94a3b8)">
                  区域框
                </text>
              </svg>
              <span>区域框</span>
            </button>
          </div>
        </div>
      ) : null}

      {onDrawLine ? (
        <div className="palette-group">
          <p className="palette-group-title">连线</p>
          <div className="palette-grid">
            {LINE_OPTIONS.map((opt) => (
              <button
                key={opt.route}
                type="button"
                className="palette-tile palette-tile--line"
                title={`${opt.label}（拖到画布放置，或点击后拖拽绘制）`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    PALETTE_MIME,
                    encodePaletteDrag({ kind: 'line', route: opt.route }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => onDrawLine(opt.route)}
              >
                <svg className="palette-preview" viewBox="0 0 64 44" aria-hidden>
                  <path
                    d={opt.d}
                    fill="none"
                    stroke="var(--accent, #2dd4bf)"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

function LaneList({
  layers,
  title,
  orientation,
  onAddLayer,
  onRenameLayer,
  onRemoveLayer,
  onSetLaneOrientation,
}: {
  layers: Array<{ id: string; label: string }>
  title: string
  orientation?: LaneOrientation
  onAddLayer?: () => void
  onRenameLayer?: (id: string, label: string) => void
  onRemoveLayer?: (id: string) => void
  onSetLaneOrientation?: (orientation: LaneOrientation) => void
}) {
  return (
    <>
      <p className="panel-title" style={{ marginTop: 16 }}>
        {title}
      </p>
      {title === '泳道' && onSetLaneOrientation ? (
        <>
          <label className="palette-lane-orient-label">泳道方向</label>
          <select
            aria-label="泳道方向"
            value={orientation ?? 'horizontal'}
            onChange={(e) => onSetLaneOrientation(e.target.value as LaneOrientation)}
          >
            <option value="horizontal">横向（横带）</option>
            <option value="vertical">纵向（纵列）</option>
          </select>
        </>
      ) : null}
      {layers.map((l) => (
        <div key={l.id} className="layer-row">
          <input value={l.label} onChange={(e) => onRenameLayer?.(l.id, e.target.value)} />
          <button type="button" className="danger tiny" onClick={() => onRemoveLayer?.(l.id)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={onAddLayer}>
        {title === '泳道' ? '新增泳道' : '新增层'}
      </button>
    </>
  )
}

export function Palette({
  diagram,
  onAddFlow,
  onAddBoundary,
  onDrawLine,
  onAddLayer,
  onRenameLayer,
  onRemoveLayer,
  onSetLaneOrientation,
  layerEdgeRule = 'free',
  onSetLayerEdgeRule,
  layerEdgeViolationCount = 0,
}: Props) {
  if (isFlowchart(diagram)) {
    const lanes = [...(diagram.meta.editor?.layers ?? [])].sort((a, b) => a.order - b.order)
    return (
      <>
        <p className="panel-title">符号库</p>
        <FlowSymbolGroups
          onAddFlow={onAddFlow}
          onAddBoundary={onAddBoundary}
          onDrawLine={onDrawLine}
        />
        <LaneList
          layers={lanes}
          title="泳道"
          orientation={resolveLaneOrientation(diagram)}
          onAddLayer={onAddLayer}
          onRenameLayer={onRenameLayer}
          onRemoveLayer={onRemoveLayer}
          onSetLaneOrientation={onSetLaneOrientation}
        />
        <p className="hint palette-hint">常用流程图符号；拖到画布或点击插入。不含海量 clipart。</p>
      </>
    )
  }

  if (!isArchitecture(diagram)) return null

  const layered = architectureMode(diagram) === 'layered'
  const layers = sortedLayers(diagram)
  return (
    <>
      <p className="panel-title">符号库</p>
      <FlowSymbolGroups
        onAddFlow={onAddFlow}
        onAddBoundary={onAddBoundary}
        onDrawLine={onDrawLine}
      />
      {layered ? (
        <>
          <LaneList
            layers={layers}
            title="分层"
            onAddLayer={onAddLayer}
            onRenameLayer={onRenameLayer}
            onRemoveLayer={onRemoveLayer}
          />
          {onSetLayerEdgeRule ? (
            <>
              <label className="palette-lane-orient-label">跨层连线</label>
              <select
                aria-label="跨层连线规则"
                value={layerEdgeRule}
                onChange={(e) => onSetLayerEdgeRule(e.target.value as 'free' | 'downward')}
              >
                <option value="free">自由（不校验）</option>
                <option value="downward">仅上层→下层</option>
              </select>
              {layerEdgeRule === 'downward' && layerEdgeViolationCount > 0 ? (
                <p className="hint palette-hint warn">
                  {layerEdgeViolationCount} 条边自下而上，已在画布高亮
                </p>
              ) : (
                <p className="hint palette-hint">同层与自上而下合法；违规边橙色高亮（不阻断编辑）。</p>
              )}
            </>
          ) : null}
        </>
      ) : null}
      <p className="hint palette-hint">符号库与流程图一致；框体可点选后拖边框手柄改宽高。</p>
    </>
  )
}
