import { inflateSync } from 'fflate'
import type {
  AnyDiagram,
  ArchifyDiagram,
  BoxStyle,
  ComponentType,
  DiagramType,
  FlowShape,
  FlowchartDocument,
  LineStyle,
  Point,
} from '../types'
import type { LossyReport, ParseResult } from './types'

const COMPONENT_TYPES = new Set<ComponentType>([
  'external',
  'frontend',
  'backend',
  'database',
  'cloud',
  'security',
  'messagebus',
])

export function isDrawioXml(text: string): boolean {
  return /<mxfile\b|<mxGraphModel\b|<mxCell\b/i.test(text)
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function encodeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function attrs(source: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w:-]+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) out[match[1]] = decodeXml(match[2])
  return out
}

function styleMap(style: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of style.split(';')) {
    if (!part) continue
    const eq = part.indexOf('=')
    if (eq < 0) out[part] = '1'
    else out[part.slice(0, eq)] = part.slice(eq + 1)
  }
  return out
}

function num(value: string | undefined, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function vendorShape(style: Record<string, string>): boolean {
  const shape = `${style.shape ?? ''} ${style.image ?? ''}`.toLowerCase()
  if (!shape.trim()) return false
  return /mxgraph\.|aws|azure|gcp|kubernetes|k8s|cisco|alibaba|ibm|sap|citrix|image=/.test(shape)
}

function flowShape(style: Record<string, string>, label: string): FlowShape {
  const key = (style.archifyShape ?? '').trim()
  const known: FlowShape[] = [
    'start',
    'process',
    'decision',
    'end',
    'subprocess',
    'document',
    'data',
    'preparation',
    'manual',
    'delay',
    'connector',
    'display',
    'note',
    'text',
    'database',
    'offpage',
    'merge',
    'multi_document',
  ]
  if (known.includes(key as FlowShape)) return key as FlowShape
  // 独立文本：无边框 / 仅文字单元格
  if (style.text === '1' || (style.strokeColor === 'none' && style.fillColor === 'none')) {
    return 'text'
  }
  if (style.shape === 'note' || style.shape === 'mxgraph.basic.note') return 'note'
  const shape = (style.shape ?? '').toLowerCase()
  if (shape.includes('document') || shape === 'mxgraph.flowchart.document') {
    return shape.includes('multi') ? 'multi_document' : 'document'
  }
  if (shape.includes('cylinder') || shape.includes('datastore') || shape.includes('dataStorage')) {
    return 'database'
  }
  if (shape.includes('hexagon') || shape.includes('preparation')) return 'preparation'
  if (shape.includes('offpage') || shape.includes('offPage')) return 'offpage'
  if (shape.includes('merge') || shape.includes('triangle')) return 'merge'
  if (style.rhombus === '1' || style.ellipse === '1') {
    if (style.rhombus === '1') return 'decision'
    if (/结束|end/i.test(label)) return 'end'
    return 'start'
  }
  return 'process'
}

function componentType(style: Record<string, string>): ComponentType {
  const hinted = style.archifyType as ComponentType
  if (COMPONENT_TYPES.has(hinted)) return hinted
  const shape = (style.shape ?? '').toLowerCase()
  if (shape.includes('cylinder') || shape.includes('datastore')) return 'database'
  return 'backend'
}

function boxFromStyle(style: Record<string, string>): BoxStyle | undefined {
  const fill = style.fillColor
  const stroke = style.strokeColor
  const text = style.fontColor
  if (!fill && !stroke && !text) return undefined
  return {
    ...(fill ? { fill: normalizeColor(fill) } : {}),
    ...(stroke ? { stroke: normalizeColor(stroke) } : {}),
    ...(text ? { text: normalizeColor(text) } : {}),
  }
}

function normalizeColor(value: string): string {
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return value
  return value
}

function suggestType(xml: string): DiagramType {
  const rhombus = (xml.match(/rhombus/gi) ?? []).length
  const ellipse = (xml.match(/ellipse/gi) ?? []).length
  return rhombus + ellipse > 0 ? 'flowchart' : 'architecture'
}

/** 压缩 / 无明文 mxCell：需先解码 diagram 载荷（不静默空图） */
export function isCompressedDrawio(xml: string): boolean {
  if (/compressed\s*=\s*["']true["']/i.test(xml)) return true
  if (/<mxCell\b/i.test(xml)) return false
  // mxfile 有 diagram 但无 mxGraphModel/mxCell → 多为 base64 压缩载荷
  if (/<mxfile\b/i.test(xml) && /<diagram[\s>]/i.test(xml)) return true
  if (/<mxfile\b/i.test(xml) && !/<mxGraphModel\b/i.test(xml)) return true
  return false
}

const COMPRESSED_DRAWIO_MSG =
  '这份 draw.io 文件是压缩图且无法自动解码。请打开 diagrams.net → 打开该文件 → File → Export as → XML… → 勾选「Uncompressed / 未压缩」→ Download，再用本编辑器导入该 XML；也可直接导入本编辑器导出的 .drawio。'

/** base64 → inflate(raw) →（可选）URI 解码，对齐主流流程图编辑器 mxfile 压缩载荷 */
export function decodeMxDiagramPayload(payload: string): string | null {
  const trimmed = payload.replace(/\s+/g, '').trim()
  if (!trimmed || /[<>]/.test(trimmed)) return null
  let bytes: Uint8Array
  try {
    const bin = atob(trimmed)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    return null
  }
  let inflated: Uint8Array
  try {
    inflated = inflateSync(bytes)
  } catch {
    return null
  }
  const asText = new TextDecoder('utf-8', { fatal: false }).decode(inflated)
  try {
    const uri = decodeURIComponent(asText)
    if (/<mxGraphModel\b|<mxCell\b/i.test(uri)) return uri
  } catch {
    /* 非 URI 编码时退回原文 */
  }
  if (/<mxGraphModel\b|<mxCell\b/i.test(asText)) return asText
  return null
}

/**
 * 将 mxfile 内压缩 diagram 正文展开为明文 mxGraphModel。
 * 成功则返回可解析 XML；失败返回 null（调用方给「另存未压缩」引导）。
 */
export function expandCompressedDrawio(xml: string): string | null {
  if (!isCompressedDrawio(xml) && /<mxCell\b/i.test(xml)) return xml
  let expandedAny = false
  let failedAny = false
  const next = xml.replace(/<diagram(\b[^>]*)>([\s\S]*?)<\/diagram>/gi, (full, attrs: string, body: string) => {
    const inner = body.trim()
    if (/<mxGraphModel\b|<mxCell\b/i.test(inner)) {
      expandedAny = true
      return full
    }
    const decoded = decodeMxDiagramPayload(inner)
    if (decoded) {
      expandedAny = true
      return `<diagram${attrs}>\n${decoded}\n</diagram>`
    }
    failedAny = true
    return full
  })
  if (failedAny || !expandedAny || !/<mxCell\b/i.test(next)) return null
  return next.replace(/\scompressed\s*=\s*["'][^"']*["']/gi, '')
}

export function importDrawioDocument(xml: string, force?: DiagramType): ParseResult {
  if (!isDrawioXml(xml)) {
    return { ok: false, error: { code: 'ParseError', message: '不是 draw.io XML' } }
  }
  let source = xml
  if (isCompressedDrawio(xml) || !/<mxCell\b/i.test(xml)) {
    const expanded = expandCompressedDrawio(xml)
    if (!expanded) {
      return {
        ok: false,
        error: {
          code: 'UnsupportedFormat',
          message: COMPRESSED_DRAWIO_MSG,
        },
      }
    }
    source = expanded
  }

  const diagramType = force ?? suggestType(source)
  const dropped: string[] = []
  const cells = source.match(/<mxCell\b[\s\S]*?(?:\/>|<\/mxCell>)/g) ?? []
  const vertices: Array<{
    id: string
    label: string
    style: Record<string, string>
    pos: Point
    size: [number, number]
  }> = []
  const edges: Array<{ id: string; from: string; to: string; label?: string; style?: LineStyle }> = []

  for (const raw of cells) {
    const open = raw.match(/^<mxCell\b([^>]*)>/) ?? raw.match(/^<mxCell\b([^>]*)\/>/)
    if (!open) continue
    const cell = attrs(open[1])
    if (cell.id === '0' || cell.id === '1') continue
    const geo = attrs((raw.match(/<mxGeometry\b([^>]*)\/?>/) ?? ['', ''])[1])
    const label = stripHtml(cell.value ?? '')
    const style = styleMap(cell.style ?? '')
    if (cell.vertex === '1') {
      if (vendorShape(style)) {
        dropped.push(label || cell.id || '图标')
        continue
      }
      const width = num(geo.width, 160)
      const height = num(geo.height, 64)
      if (!geo.width && !geo.height && style.group === '1') {
        dropped.push(label || '分组')
        continue
      }
      vertices.push({
        id: cell.id || `n-${vertices.length + 1}`,
        label: label || cell.id || '未命名',
        style,
        pos: [num(geo.x), num(geo.y)],
        size: [Math.max(40, width), Math.max(24, height)],
      })
      continue
    }
    if (cell.edge === '1') {
      if (!cell.source || !cell.target) {
        dropped.push(label ? `边 ${label}` : '未连接的边')
        continue
      }
      const line: LineStyle = {}
      if (style.strokeColor) line.stroke = normalizeColor(style.strokeColor)
      if (style.strokeWidth) line.strokeWidth = num(style.strokeWidth, 1.6)
      edges.push({
        id: cell.id || `e-${edges.length + 1}`,
        from: cell.source,
        to: cell.target,
        label: label || undefined,
        style: Object.keys(line).length ? line : undefined,
      })
    }
  }

  if (!vertices.length) {
    return { ok: false, error: { code: 'ParseError', message: 'draw.io 子集里没有可导入的矩形或菱形' } }
  }

  const kept = new Set(vertices.map((node) => node.id))
  const linked = edges.filter((edge) => kept.has(edge.from) && kept.has(edge.to))
  const skippedEdges = edges.length - linked.length
  if (skippedEdges) dropped.push(`${skippedEdges} 条指向已丢弃形状的边`)

  if (diagramType === 'architecture' && vertices.some((node) => node.style.rhombus === '1')) {
    dropped.push('菱形在架构图中改为组件框')
  }

  const diagram: AnyDiagram =
    diagramType === 'flowchart' ? toFlow(vertices, linked) : toArch(vertices, linked)

  const lossy: LossyReport | undefined = dropped.length ? { dropped } : undefined
  return {
    ok: true,
    diagram,
    format_hints: { source: 'drawio' },
    lossy,
  }
}

function toFlow(
  vertices: Array<{ id: string; label: string; style: Record<string, string>; pos: Point; size: [number, number] }>,
  edges: Array<{ id: string; from: string; to: string; label?: string; style?: LineStyle }>,
): FlowchartDocument {
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: {
      title: 'draw.io 导入',
      output: 'drawio-import.html',
      format_hints: { source: 'drawio' },
    },
    nodes: vertices.map((node) => ({
      id: node.id,
      shape: flowShape(node.style, node.label),
      label: node.label,
      pos: node.pos,
      size: node.size,
      style: boxFromStyle(node.style),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      route: 'ortho' as const,
      style: edge.style ?? { arrow: 'end' as const },
    })),
  }
}

function toArch(
  vertices: Array<{ id: string; label: string; style: Record<string, string>; pos: Point; size: [number, number] }>,
  edges: Array<{ id: string; from: string; to: string; label?: string; style?: LineStyle }>,
): ArchifyDiagram {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title: 'draw.io 导入',
      output: 'drawio-import.html',
      format_hints: { source: 'drawio' },
    },
    components: vertices.map((node) => ({
      id: node.id,
      type: componentType(node.style),
      label: node.label,
      pos: node.pos,
      size: node.size,
      style: boxFromStyle(node.style),
    })),
    connections: edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      route: 'auto' as const,
      style: edge.style,
    })),
  }
}

function styleAttr(shape: string, style?: BoxStyle, extra?: string): string {
  const parts = [shape, 'whiteSpace=wrap', 'html=1']
  if (style?.fill) parts.push(`fillColor=${style.fill}`)
  if (style?.stroke) parts.push(`strokeColor=${style.stroke}`)
  if (style?.text) parts.push(`fontColor=${style.text}`)
  if (extra) parts.push(extra)
  return parts.join(';')
}

function vertexXml(id: string, label: string, style: string, pos: Point, size: [number, number]): string {
  return `<mxCell id="${encodeXml(id)}" value="${encodeXml(label)}" style="${encodeXml(style)}" vertex="1" parent="1"><mxGeometry x="${pos[0]}" y="${pos[1]}" width="${size[0]}" height="${size[1]}" as="geometry"/></mxCell>`
}

function edgeXml(id: string, from: string, to: string, label: string | undefined, style?: LineStyle): string {
  const parts = ['endArrow=classic', 'html=1']
  if (style?.stroke) parts.push(`strokeColor=${style.stroke}`)
  if (style?.strokeWidth) parts.push(`strokeWidth=${style.strokeWidth}`)
  return `<mxCell id="${encodeXml(id)}" value="${encodeXml(label ?? '')}" style="${encodeXml(parts.join(';'))}" edge="1" parent="1" source="${encodeXml(from)}" target="${encodeXml(to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`
}

/** 未压缩 mxfile。矩形、菱形、边、文字、填色。其它形状导出为矩形并记在 lossy。 */
export function diagramToDrawio(diagram: AnyDiagram): { text: string; lossy?: LossyReport } {
  const dropped: string[] = []
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
  if (diagram.diagram_type === 'flowchart') {
    for (const node of diagram.nodes) {
      const pos = node.pos ?? [80, 60]
      const size = node.size ?? [160, 64]
      let shape = 'rounded=0'
      let extra = `archifyShape=${node.shape}`
      if (node.shape === 'decision') shape = 'rhombus'
      else if (node.shape === 'start' || node.shape === 'end') shape = 'ellipse'
      else if (node.shape === 'text') shape = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=top'
      else if (node.shape === 'note') shape = 'shape=note'
      else if (node.shape !== 'process') {
        dropped.push(`${node.label}（${node.shape} 导出为矩形）`)
      }
      cells.push(vertexXml(node.id, node.label, styleAttr(shape, node.style, extra), pos, size))
    }
    for (const edge of diagram.edges) {
      cells.push(edgeXml(edge.id, edge.from, edge.to, edge.label, edge.style))
    }
  } else {
    for (const node of diagram.components) {
      const pos = node.pos ?? [80, 60]
      const size = node.size ?? [160, 64]
      cells.push(
        vertexXml(
          node.id,
          node.label,
          styleAttr('rounded=0', node.style, `archifyType=${node.type}`),
          pos,
          size,
        ),
      )
    }
    for (const edge of diagram.connections ?? []) {
      cells.push(edgeXml(edge.id, edge.from, edge.to, edge.label, edge.style))
    }
  }
  const text = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="archify-editor" type="device">
  <diagram name="${encodeXml(diagram.meta.title)}" id="page">
    <mxGraphModel>
      <root>
        ${cells.join('\n        ')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`
  return { text, lossy: dropped.length ? { dropped } : undefined }
}
