export type DiagramType = 'flowchart' | 'architecture'
export type Point = [number, number]
export type Size = [number, number]
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type ComponentType =
  | 'external'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'security'
  | 'messagebus'

/** 流程图形状（常用符号子集，非全量 clipart） */
export type FlowShape =
  | 'start'
  | 'process'
  | 'decision'
  | 'end'
  | 'subprocess'
  | 'document'
  | 'data'
  | 'preparation'
  | 'manual'
  | 'delay'
  | 'connector'
  | 'display'
  | 'note'
  /** 独立文本框（无流程语义；注释用 note） */
  | 'text'
  | 'database'
  /** ANSI 跨页连接符（偶发扩形，非整库） */
  | 'offpage'
  /** ANSI 合并 */
  | 'merge'
  /** ANSI 多文档 */
  | 'multi_document'
  | 'chevron'
  | 'arrow_right'
  | 'arrow_left'
  | 'arrow_up'
  | 'arrow_down'
  | 'arrow_both'

export interface BoxStyle {
  fill?: string
  stroke?: string
  text?: string
  strokeWidth?: number
  /** 标题字号（px）；缺省节点 13、区域框 12 */
  fontSize?: number
  /** 附标题字号（px）；缺省约为主标题的 85% */
  subFontSize?: number
  /** 加粗；编辑态可见，finalize 可丢 */
  fontWeight?: 'normal' | 'bold'
  /** 斜体；编辑态可见，finalize 可丢 */
  fontStyle?: 'normal' | 'italic'
  /** SVG stroke-dasharray；空/缺省=实线，如 `6 4`=虚线 */
  strokeDasharray?: string
  /** 文字水平对齐；缺省 center */
  textHAlign?: 'left' | 'center' | 'right'
  /** 文字垂直对齐；缺省 middle */
  textVAlign?: 'top' | 'middle' | 'bottom'
}

/** 命名色标。只存在 meta.editor，finalize 随 editor 剥离。 */
export interface ColorTag {
  id: string
  label: string
  fill: string
  stroke: string
  text: string
}

export type ArrowHead = 'none' | 'end' | 'start' | 'both'

export interface LineStyle {
  stroke?: string
  strokeWidth?: number
  /** 箭头：默认 end（末端箭头） */
  arrow?: ArrowHead
  /** SVG stroke-dasharray，如虚线边 `6 4` */
  strokeDasharray?: string
  /**
   * 边标签底色。缺省 / none / transparent = 无填充（透明）；
   * 写入色值则显示标签底。架构 finalize 会剥离 connection.style。
   */
  labelFill?: string
}

export interface FormatHints {
  source?: 'native' | 'mermaid' | 'drawio' | 'archify'
  original_name?: string
}

export type LaneOrientation = 'horizontal' | 'vertical'

export interface EditorLayer {
  id: string
  label: string
  order: number
  height?: number
  /** 层/泳道宽度；缺省用全局 laneWidth 或 LAYER_WIDTH / 纵向默认宽 */
  width?: number
  style?: BoxStyle
}

export interface EnvelopeMeta {
  title: string
  subtitle?: string
  output: string
  locale?: string
  quality_profile?: string
  animation?: string
  visual_preset?: string
  editor?: {
    /** free | layered(architecture) | swimlane(flowchart from Archify workflow) */
    mode?: 'free' | 'layered' | 'swimlane'
    /** 泳道方向：horizontal 横带（默认）· vertical 纵列（每 SFC 一列） */
    laneOrientation?: LaneOrientation
    /** 无坐标流程图自动排版方向；Mermaid TD/LR 导入时保留 */
    flowDirection?: 'TB' | 'BT' | 'LR' | 'RL'
    layers?: EditorLayer[]
    /**
     * layered 跨层连线规则（仅 architecture）：
     * free=不限制；downward=仅允许上层→下层（含同层）；违规边高亮。
     * finalize 随 meta.editor 剥离。
     */
    layerEdgeRule?: 'free' | 'downward'
    /** 泳道/分层共用默认宽度（横向泳道） */
    laneWidth?: number
    styles?: Record<string, BoxStyle>
    /** 区域框样式（按 label 键）；finalize 随 meta.editor 一并剥离 */
    boundaryStyles?: Record<string, BoxStyle>
    /** 命名色标；节点用 tagId 引用 */
    colorTags?: ColorTag[]
    /**
     * 导入 Archify workflow 时保留的完整源文档，供 finalize workflow → HTML（保真）。
     * 导出 HTML 时优先使用，并合并编辑器中的文案改动。
     */
    archify_workflow?: Record<string, unknown>
  }
  format_hints?: FormatHints
}

export interface ArchifyComponent {
  id: string
  type: ComponentType
  label: string
  sublabel?: string
  /** 编辑器流程符号；finalize 按 schema 白名单剥离 */
  shape?: FlowShape
  tag?: string
  pos?: Point
  size?: Size
  /** 色标引用；finalize 剥离 */
  tagId?: string
  style?: BoxStyle
}

export interface ArchifyConnection {
  /** Archify 样例常省略；导入时 normalizeArchitecture 会补齐 */
  id: string
  from: string
  to: string
  label?: string
  variant?: string
  fromSide?: string
  toSide?: string
  /** Archify: auto|straight|orthogonal-h|orthogonal-v；curve 为编辑器扩展，finalize 时剥离 */
  route?: 'auto' | 'straight' | 'orthogonal-h' | 'orthogonal-v' | 'curve'
  /** 编辑态拐点；finalize 剥离（Archify schema 无此字段） */
  via?: Point[]
  /** 标签相对中点的像素偏移（编辑态；finalize / Mermaid 可丢） */
  labelOffset?: Point
  /** 色标引用；finalize 剥离 */
  tagId?: string
  style?: LineStyle
}

export interface ArchifyBoundary {
  kind: string
  label: string
  wraps: string[]
  /** Archify schema 允许的统一内边距；finalize 时由分侧 pad 折算 */
  pad?: number
  /** @deprecated 对称左右；新编辑用 padLeft/padRight */
  padX?: number
  /** @deprecated 对称上下；新编辑用 padTop/padBottom */
  padY?: number
  /** 编辑态：分侧内边距（拖哪侧只动哪侧） */
  padLeft?: number
  padRight?: number
  padTop?: number
  padBottom?: number
  /**
   * 手绘区域框：不包裹节点时的显式矩形（编辑态）。
   * 有 pos/size 时以它为几何来源；wraps 可为空。
   */
  pos?: Point
  size?: Size
}

export interface ArchifyCard {
  dot?: string
  title: string
  items: string[]
}

/**
 * 独立线段：不连接节点，直接放在画布指定位置（draw.io / 亿图式直线、折线）。
 * points 为世界坐标；直线 2 点，折线可含中间拐点。finalize/Mermaid 可丢。
 */
export interface StandaloneLine {
  id: string
  points: Point[]
  route?: 'straight' | 'ortho' | 'curve'
  style?: LineStyle
  label?: string
}

export interface ArchifyDiagram {
  schema_version: 1
  diagram_type: 'architecture'
  meta: EnvelopeMeta
  components: ArchifyComponent[]
  connections?: ArchifyConnection[]
  boundaries?: ArchifyBoundary[]
  /** 独立直线 / 折线（编辑器扩展） */
  lines?: StandaloneLine[]
  cards?: ArchifyCard[]
}

export interface FlowchartNode {
  id: string
  shape: FlowShape
  label: string
  pos?: Point
  size?: Size
  /** 命名色标；finalize 剥离 */
  tagId?: string
  style?: BoxStyle
}

export interface FlowchartEdge {
  id: string
  from: string
  to: string
  label?: string
  /** straight 直线 · ortho 正交折线（Archify HTML 默认观感）· curve 曲线 */
  route?: 'straight' | 'ortho' | 'curve'
  /** 出边锚点：n/s/e/w */
  fromSide?: 'n' | 's' | 'e' | 'w' | string
  toSide?: 'n' | 's' | 'e' | 'w' | string
  /** 折线中间拐点（用户拖拽） */
  via?: Point[]
  /** 标签相对中点的像素偏移（编辑态；导出 Mermaid 可丢） */
  labelOffset?: Point
  style?: LineStyle
}

export interface FlowchartDocument {
  schema_version: 1
  diagram_type: 'flowchart'
  meta: EnvelopeMeta
  nodes: FlowchartNode[]
  edges: FlowchartEdge[]
  /** 区域框（编辑器扩展；wraps 引用 node id，或手绘显式 pos/size） */
  boundaries?: ArchifyBoundary[]
  /** 独立直线 / 折线（编辑器扩展） */
  lines?: StandaloneLine[]
}

export type AnyDiagram = FlowchartDocument | ArchifyDiagram

export const COMPONENT_TYPES: { type: ComponentType; label: string }[] = [
  { type: 'external', label: 'External' },
  { type: 'frontend', label: 'Frontend' },
  { type: 'backend', label: 'Backend' },
  { type: 'database', label: 'Database' },
  { type: 'cloud', label: 'Cloud' },
  { type: 'security', label: 'Security' },
  { type: 'messagebus', label: 'Message Bus' },
]

export const FLOW_SHAPES: { shape: FlowShape; label: string }[] = [
  { shape: 'start', label: '开始' },
  { shape: 'process', label: '过程' },
  { shape: 'decision', label: '判断' },
  { shape: 'subprocess', label: '子流程' },
  { shape: 'end', label: '结束' },
  { shape: 'document', label: '文档' },
  { shape: 'data', label: '数据' },
  { shape: 'preparation', label: '准备' },
  { shape: 'manual', label: '手工' },
  { shape: 'delay', label: '延迟' },
  { shape: 'connector', label: '连接点' },
  { shape: 'display', label: '显示' },
  { shape: 'note', label: '注释' },
  { shape: 'text', label: '文本框' },
  { shape: 'database', label: '数据库' },
  { shape: 'offpage', label: '跨页符' },
  { shape: 'merge', label: '合并' },
  { shape: 'multi_document', label: '多文档' },
  { shape: 'chevron', label: '流程箭头' },
  { shape: 'arrow_right', label: '右箭头' },
  { shape: 'arrow_left', label: '左箭头' },
  { shape: 'arrow_up', label: '上箭头' },
  { shape: 'arrow_down', label: '下箭头' },
  { shape: 'arrow_both', label: '双向箭头' },
]

/** 左侧符号库分组 */
export const FLOW_SHAPE_GROUPS: { id: string; title: string; shapes: FlowShape[] }[] = [
  {
    id: 'basic',
    title: '基本流程',
    shapes: ['start', 'process', 'decision', 'subprocess', 'end'],
  },
  {
    id: 'arrows',
    title: '箭头',
    shapes: ['arrow_right', 'arrow_left', 'arrow_up', 'arrow_down', 'arrow_both', 'chevron'],
  },
  {
    id: 'data',
    title: '数据与文档',
    shapes: ['document', 'multi_document', 'data', 'database', 'display'],
  },
  {
    id: 'annotate',
    title: '注释与文本',
    shapes: ['note', 'text'],
  },
  {
    id: 'ops',
    title: '操作',
    shapes: ['preparation', 'manual', 'delay', 'connector', 'offpage', 'merge'],
  },
]

/** 标准色：黑白灰 + 基础色（常见办公色板首行） */
export const COLOR_STANDARD = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#B7B7B7',
  '#CCCCCC',
  '#EFEFEF',
  '#FFFFFF',
  '#F87171',
  '#FBBF24',
  '#FDE047',
  '#34D399',
  '#22D3EE',
  '#3D9CF0',
  '#A78BFA',
  '#F472B6',
]

/** 推荐色：架构 / 流程图常用填充与强调色 */
export const COLOR_RECOMMENDED = [
  '#E8F1FF',
  '#FFF4E5',
  '#E7F8EF',
  '#FDECEC',
  '#F3E8FF',
  '#ECFEFF',
  '#FEFCE8',
  '#F1F5F9',
  '#1E2731',
  '#111827',
  '#3D9CF0',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#A78BFA',
  '#94A3B8',
]

/** @deprecated 兼容旧引用；优先用 COLOR_STANDARD / COLOR_RECOMMENDED */
export const COLOR_PRESETS = [...COLOR_STANDARD, ...COLOR_RECOMMENDED]

export const TYPE_COLOR: Record<ComponentType, string> = {
  external: '#94a3b8',
  frontend: '#3d9cf0',
  backend: '#34d399',
  database: '#fbbf24',
  cloud: '#a78bfa',
  security: '#f87171',
  messagebus: '#2dd4bf',
}

export const SHAPE_DEFAULT: Record<FlowShape, BoxStyle> = {
  start: { fill: '#E7F8EF', stroke: '#34D399', text: '#064E3B' },
  end: { fill: '#FDECEC', stroke: '#F87171', text: '#7F1D1D' },
  process: { fill: '#E8F1FF', stroke: '#3D9CF0', text: '#0F172A' },
  decision: { fill: '#FFF4E5', stroke: '#FBBF24', text: '#78350F' },
  subprocess: { fill: '#F3E8FF', stroke: '#A78BFA', text: '#3B0764' },
  document: { fill: '#EEF2FF', stroke: '#6366F1', text: '#312E81' },
  data: { fill: '#ECFEFF', stroke: '#06B6D4', text: '#164E63' },
  preparation: { fill: '#F0FDF4', stroke: '#22C55E', text: '#14532D' },
  manual: { fill: '#FFF7ED', stroke: '#F97316', text: '#9A3412' },
  delay: { fill: '#FDF4FF', stroke: '#D946EF', text: '#86198F' },
  connector: { fill: '#F1F5F9', stroke: '#64748B', text: '#0F172A' },
  display: { fill: '#EFF6FF', stroke: '#3B82F6', text: '#1E3A8A' },
  note: { fill: '#FEFCE8', stroke: '#EAB308', text: '#713F12' },
  text: { fill: 'none', stroke: 'none', text: '#0F172A' },
  database: { fill: '#FFFBEB', stroke: '#D97706', text: '#78350F' },
  offpage: { fill: '#F8FAFC', stroke: '#64748B', text: '#0F172A' },
  merge: { fill: '#FDF2F8', stroke: '#EC4899', text: '#831843' },
  multi_document: { fill: '#EEF2FF', stroke: '#6366F1', text: '#312E81' },
  chevron: { fill: '#E0F2FE', stroke: '#0EA5E9', text: '#0C4A6E' },
  arrow_right: { fill: '#DBEAFE', stroke: '#2563EB', text: '#1E3A8A' },
  arrow_left: { fill: '#DBEAFE', stroke: '#2563EB', text: '#1E3A8A' },
  arrow_up: { fill: '#D1FAE5', stroke: '#059669', text: '#064E3B' },
  arrow_down: { fill: '#D1FAE5', stroke: '#059669', text: '#064E3B' },
  arrow_both: { fill: '#E0E7FF', stroke: '#4F46E5', text: '#312E81' },
}

export const MIN_SIZE: Size = [40, 24]
export const LAYER_PAD = 16
export const LAYER_WIDTH = 1080
export const DEFAULT_LAYER_HEIGHT = 140
/** 纵向泳道默认列宽 / 列高 */
export const VERTICAL_LANE_WIDTH = 200
export const VERTICAL_LANE_HEIGHT = 900
