import type {
  ArchifyComponent,
  ArchifyConnection,
  ArchifyDiagram,
  ComponentType,
  FlowchartDocument,
  FlowShape,
} from '../types'
import type { LossyReport } from './types'
import { DEFAULT_NODE_FONT_SIZE, resolveSubFontSize } from '../domain/style'
import { fitSizeToLabel } from '../domain/textWrap'

type ParsedMermaidNode = {
  id: string
  shape: FlowShape
  label: string
  explicit: boolean
  end: number
}

type ParsedMermaidEdge = {
  label?: string
  reverse?: boolean
  end: number
}

const MERMAID_ID_RE = /^[\p{L}\p{N}_][\p{L}\p{N}_.-]*/u
const MERMAID_NODE_SHAPES: Array<{ re: RegExp; shape: FlowShape }> = [
  { re: /^\(\[([\s\S]*?)\]\)/, shape: 'start' },
  { re: /^\[\[([\s\S]*?)\]\]/, shape: 'subprocess' },
  { re: /^\[\(([\s\S]*?)\)\]/, shape: 'database' },
  { re: /^\(\(([\s\S]*?)\)\)/, shape: 'connector' },
  { re: /^\{\{([\s\S]*?)\}\}/, shape: 'preparation' },
  { re: /^\[\/([\s\S]*?)\/\]/, shape: 'data' },
  { re: /^\[\\([\s\S]*?)\\\]/, shape: 'data' },
  { re: /^>([\s\S]*?)\]/, shape: 'offpage' },
  { re: /^\{([\s\S]*?)\}/, shape: 'decision' },
  { re: /^\(([\s\S]*?)\)/, shape: 'start' },
  { re: /^\[([\s\S]*?)\]/, shape: 'process' },
]

function skipWs(text: string, pos: number): number {
  let next = pos
  while (next < text.length && /\s/.test(text[next]!)) next += 1
  return next
}

function mermaidLabel(raw: string | undefined, fallback: string): string {
  let text = (raw ?? '').trim()
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")) ||
      (text.startsWith('`') && text.endsWith('`')))
  ) {
    text = text.slice(1, -1)
  }
  return (
    text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim() || fallback
  )
}

function readMermaidNode(text: string, pos: number): ParsedMermaidNode | null {
  const start = skipWs(text, pos)
  const id = MERMAID_ID_RE.exec(text.slice(start))?.[0]
  if (!id) return null

  let end = start + id.length
  let shape: FlowShape = 'process'
  let label = id
  let explicit = false
  const rest = text.slice(end)
  for (const candidate of MERMAID_NODE_SHAPES) {
    const match = rest.match(candidate.re)
    if (!match) continue
    shape = candidate.shape
    label = mermaidLabel(match[1], id)
    explicit = true
    end += match[0].length
    break
  }

  end = skipWs(text, end)
  const classSuffix = text.slice(end).match(/^:::[A-Za-z0-9_.-]+/)
  if (classSuffix) end += classSuffix[0].length

  return { id, shape, label, explicit, end }
}

function readMermaidNodeGroup(text: string, pos: number): { nodes: ParsedMermaidNode[]; end: number } | null {
  const first = readMermaidNode(text, pos)
  if (!first) return null
  const nodes = [first]
  let end = first.end
  while (true) {
    const amp = skipWs(text, end)
    if (text[amp] !== '&') break
    const next = readMermaidNode(text, amp + 1)
    if (!next) break
    nodes.push(next)
    end = next.end
  }
  return { nodes, end }
}

function readMermaidEdge(text: string, pos: number): ParsedMermaidEdge | null {
  const start = skipWs(text, pos)
  const rest = text.slice(start)

  const textLabel = rest.match(
    /^(<--|--|==|-\.)\s+(.+?)\s+(<-->|-->|==>|\.->|---|===|--[ox]|==[ox])\s*/,
  )
  if (textLabel) {
    return {
      label: mermaidLabel(textLabel[2], ''),
      reverse: textLabel[1]!.startsWith('<'),
      end: start + textLabel[0].length,
    }
  }

  const pipeLabel = rest.match(
    /^(<-->|<--|-->|==>|-\.->|---|===|--[ox]|==[ox]|--+|==+)\s*(?:\|([^|]*)\|)?\s*/,
  )
  if (!pipeLabel) return null
  return {
    label: pipeLabel[2] !== undefined ? mermaidLabel(pipeLabel[2], '') : undefined,
    reverse: pipeLabel[1]!.startsWith('<'),
    end: start + pipeLabel[0].length,
  }
}

function splitMermaidStatements(line: string): string[] {
  const out: string[] = []
  let quote = ''
  let depth = 0
  let start = 0
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!
    if (quote) {
      if (ch === quote && line[i - 1] !== '\\') quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '[' || ch === '{' || ch === '(') depth += 1
    else if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1)
    else if (ch === ';' && depth === 0) {
      const statement = line.slice(start, i).trim()
      if (statement) out.push(statement)
      start = i + 1
    }
  }
  const tail = line.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/** Mermaid flowchart / graph 导入；保留常见节点形状、连线和链式语法。 */
export function importMermaidFlowchart(text: string): FlowchartDocument {
  const raw = text.replace(/\r\n/g, '\n').trim()
  const body = raw.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
  const firstMeaningful = body
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%'))
  if (!firstMeaningful || !/^(flowchart|graph)\b/i.test(firstMeaningful)) {
    throw new Error('不是 Mermaid flowchart/graph（请以 flowchart TD 或 graph TD 开头）')
  }

  const nodes = new Map<string, { id: string; shape: FlowShape; label: string }>()
  const edges: Array<{ id: string; from: string; to: string; label?: string }> = []
  let edgeSeq = 0

  const ensure = (id: string, shape: FlowShape = 'process', label?: string) => {
    const prev = nodes.get(id)
    if (!prev) {
      nodes.set(id, { id, shape, label: label ?? id })
      return
    }
    if (label) prev.label = label
    if (shape !== 'process' || prev.shape === 'process') prev.shape = shape
  }

  const statements = body
    .split('\n')
    .flatMap((line) => {
      const clean = line.replace(/%%.*$/, '').trim()
      return clean ? splitMermaidStatements(clean) : []
    })

  for (const statement of statements) {
    if (
      /^(flowchart|graph)\b/i.test(statement) ||
      /^(subgraph|end|direction|classDef|class|style|linkStyle|click|accTitle|accDescr)\b/i.test(
        statement,
      )
    ) {
      continue
    }

    const first = readMermaidNodeGroup(statement, 0)
    if (!first) continue
    for (const node of first.nodes) {
      ensure(node.id, node.shape, node.explicit ? node.label : undefined)
    }

    let current = first.nodes
    let cursor = first.end
    while (true) {
      const edge = readMermaidEdge(statement, cursor)
      if (!edge) break
      const next = readMermaidNodeGroup(statement, edge.end)
      if (!next) break
      for (const node of next.nodes) {
        ensure(node.id, node.shape, node.explicit ? node.label : undefined)
      }
      for (const from of current) {
        for (const to of next.nodes) {
          const a = edge.reverse ? to.id : from.id
          const b = edge.reverse ? from.id : to.id
          if (a === b) continue
          edgeSeq += 1
          edges.push({ id: `e-${edgeSeq}`, from: a, to: b, label: edge.label })
        }
      }
      current = next.nodes
      cursor = next.end
    }
  }

  if (!nodes.size) throw new Error('未解析到节点（当前仅支持简单 flowchart 语法）')

  const list = [...nodes.values()]
  const subFontSize = resolveSubFontSize(DEFAULT_NODE_FONT_SIZE)
  const sized = list.map((n) => {
    const base: [number, number] =
      n.shape === 'decision'
        ? [140, 90]
        : n.shape === 'database'
          ? [120, 72]
          : n.shape === 'connector'
            ? [72, 56]
            : [150, 56]
    // 亿图式：长文字 / <br> 折行后框高自动撑开，保证导入即完整显示
    const size = fitSizeToLabel(base, n.label, undefined, DEFAULT_NODE_FONT_SIZE, subFontSize, base[1])
    return { ...n, size }
  })

  const frontMatter = raw.match(/^---\s*\n([\s\S]*?)\n---/)
  const frontTitle = frontMatter?.[1]
    ?.split('\n')
    .map((line) => line.match(/^\s*title:\s*(.+)$/i)?.[1]?.trim())
    .find(Boolean)
  const titleMatch = raw.match(/%%\s*title:\s*(.+)/i)
  const directionMatch = firstMeaningful.match(/^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i)
  const rawDirection = directionMatch?.[1]?.toUpperCase()
  const flowDirection =
    rawDirection === 'TD' ? 'TB' : (rawDirection as 'TB' | 'BT' | 'LR' | 'RL' | undefined)
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: {
      title: frontTitle || titleMatch?.[1]?.trim() || 'Imported Mermaid',
      output: 'mermaid-import.html',
      format_hints: { source: 'mermaid' },
      editor: { flowDirection: flowDirection ?? 'TB' },
    },
    nodes: sized,
    edges,
  }
}

export function isMermaidArchitectureText(text: string): boolean {
  const head = text.replace(/\r\n/g, '\n').trim().slice(0, 240)
  return /^\s*(C4Context|C4Container|C4Component|C4Deployment|architecture-beta)\b/im.test(head)
}

function c4Type(kind: string): ComponentType {
  const k = kind.toLowerCase()
  if (/person|user|actor|external/.test(k)) return 'external'
  if (/db|database|storage|queue|bucket/.test(k)) return 'database'
  if (/cloud|gateway|cdn|lb|load.?balancer/.test(k)) return 'cloud'
  if (/security|auth|iam|firewall/.test(k)) return 'security'
  if (/bus|mq|kafka|pubsub|message/.test(k)) return 'messagebus'
  if (/ui|web|frontend|spa|mobile/.test(k)) return 'frontend'
  return 'backend'
}

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '').trim()
}

/**
 * Mermaid C4* / architecture-beta → architecture（有损：组件+边；无几何，靠 F-22 布局）。
 */
export function importMermaidArchitecture(text: string): {
  diagram: ArchifyDiagram
  lossy: LossyReport
} {
  const raw = text.replace(/\r\n/g, '\n').trim()
  if (!isMermaidArchitectureText(raw)) {
    throw new Error(
      '不是 Mermaid C4 / architecture-beta（请以 C4Context、C4Container、C4Component、C4Deployment 或 architecture-beta 开头）',
    )
  }

  const dropped: string[] = [
    'Mermaid C4 / architecture-beta 有损导入：仅组件与连线；样式/图标/嵌套组几何已丢弃',
  ]
  const components = new Map<string, ArchifyComponent>()
  const connections: ArchifyConnection[] = []
  let edgeSeq = 0
  let title = 'Imported Mermaid Architecture'

  const ensure = (id: string, type: ComponentType, label?: string, sublabel?: string) => {
    const prev = components.get(id)
    if (!prev) {
      components.set(id, {
        id,
        type,
        label: label ?? id,
        ...(sublabel ? { sublabel } : {}),
      })
      return
    }
    if (label) prev.label = label
    if (sublabel) prev.sublabel = sublabel
  }

  const addEdge = (from: string, to: string, label?: string) => {
    if (!from || !to || from === to) return
    ensure(from, 'backend')
    ensure(to, 'backend')
    edgeSeq += 1
    connections.push({
      id: `e-${edgeSeq}`,
      from,
      to,
      label: label || undefined,
      route: 'auto',
    })
  }

  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const isBeta = /^\s*architecture-beta\b/i.test(lines[0] ?? '')

  for (const line of lines) {
    if (/^(C4Context|C4Container|C4Component|C4Deployment|architecture-beta)\b/i.test(line)) continue
    if (line.startsWith('%%') || line.startsWith('UpdateElementStyle') || line.startsWith('UpdateRelStyle')) {
      continue
    }

    const titleLine = line.match(/^title\s+(.+)$/i)
    if (titleLine) {
      title = titleLine[1]!.trim()
      continue
    }

    // C4: Person(id, "Name", "desc") / System(id, "Name") / Container(...) / Component(...)
    const c4Node = line.match(
      /^(Person_Ext|System_Ext|Person|SystemDb|SystemQueue|System|ContainerDb|ContainerQueue|Container|ComponentDb|ComponentQueue|Component|Node|Deployment_Node)\s*\(\s*([^,)\s]+)\s*(?:,\s*([^)]*))?\)\s*$/i,
    )
    if (c4Node) {
      const kind = c4Node[1]!
      const id = c4Node[2]!.trim()
      const rest = (c4Node[3] ?? '').trim()
      const parts = rest.match(/"([^"]*)"/g)?.map((p) => stripQuotes(p)) ?? []
      const label = parts[0] ?? id
      const sub = parts[1]
      ensure(id, c4Type(kind + ' ' + label), label, sub)
      continue
    }

    // C4: Boundary(id, "Name") { ... } — 仅记名，组几何丢弃
    const boundary = line.match(/^(Enterprise_Boundary|System_Boundary|Container_Boundary|Boundary)\s*\(/i)
    if (boundary) {
      dropped.push(`边界/组「${boundary[1]}」降级为平铺组件`)
      continue
    }

    // C4 Rel / BiRel / Rel_U ...
    const rel = line.match(
      /^(BiRel|Rel_[A-Z]+|Rel)\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*(?:,\s*"([^"]*)")?/i,
    )
    if (rel) {
      addEdge(rel[2]!.trim(), rel[3]!.trim(), rel[4]?.trim())
      continue
    }

    if (isBeta) {
      // group id(icon)[Label]  /  service id(icon)[Label] in parent
      const svc =
        line.match(
          /^(?:group|service|junction)\s+(\w+)\s*(?:\([^)]*\))?\s*\[([^\]]*)\](?:\s+in\s+(\w+))?/i,
        ) || line.match(/^(?:group|service|junction)\s+(\w+)/i)
      if (svc) {
        const id = svc[1]!
        const label = svc[2] ? stripQuotes(svc[2]) : id
        const iconHint = (line.match(/\(([^)]*)\)/)?.[1] ?? '') + ' ' + label
        ensure(id, c4Type(iconHint), label)
        if (svc[3]) dropped.push(`嵌套 in ${svc[3]} 未保留为 boundary`)
        continue
      }

      // id:L --> R:id2  /  id --> id2
      const betaEdge =
        line.match(
          /^(\w+)\s*(?::[A-Z])?\s*(?:<-->|<--|-->|---|==>|--)\s*(?:[A-Z]:)?\s*(\w+)/i,
        ) || line.match(/^(\w+)\s*-->\s*(\w+)/)
      if (betaEdge) {
        addEdge(betaEdge[1]!, betaEdge[2]!)
        continue
      }
    }
  }

  if (!components.size) {
    throw new Error('未解析到组件（C4 / architecture-beta 子集）')
  }

  // 无坐标：留给 layoutMissingPositions / F-22
  const list = [...components.values()]
  const diagram: ArchifyDiagram = {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: {
      title,
      output: 'mermaid-architecture-import.html',
      format_hints: { source: 'mermaid' },
      editor: { mode: 'free' },
    },
    components: list,
    connections,
  }

  return {
    diagram,
    lossy: { dropped: [...new Set(dropped)] },
  }
}
