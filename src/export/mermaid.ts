import type { AnyDiagram, ArchifyDiagram, FlowchartDocument } from '../types'
import { isArchitecture, isFlowchart } from '../domain/document'

function escLabel(s: string): string {
  return s.replace(/"/g, '#quot;').replace(/\n/g, ' ')
}

function flowShape(shape: string, id: string, label: string): string {
  const t = escLabel(label)
  switch (shape) {
    case 'start':
    case 'end':
      return `${id}(["${t}"])`
    case 'decision':
      return `${id}{"${t}"}`
    case 'subprocess':
      return `${id}[["${t}"]]`
    case 'database':
      return `${id}[("${t}")]`
    case 'document':
    case 'multi_document':
    case 'data':
    case 'preparation':
    case 'offpage':
    case 'merge':
      // Mermaid 无对应形：退化为矩形，往返靠 archifyShape 不保证
      return `${id}["${t}"]`
    default:
      return `${id}["${t}"]`
  }
}

export function flowchartToMermaid(doc: FlowchartDocument): string {
  const lines = ['flowchart TD']
  for (const n of doc.nodes) {
    lines.push(`  ${flowShape(n.shape, n.id, n.label)}`)
  }
  for (const e of doc.edges) {
    const lab = e.label ? `|${escLabel(e.label)}|` : ''
    lines.push(`  ${e.from} -->${lab} ${e.to}`)
  }
  return `${lines.join('\n')}\n`
}

/** architecture 有损降级为 flowchart-like graph */
export function architectureToMermaid(doc: ArchifyDiagram): string {
  const lines = ['flowchart LR']
  for (const c of doc.components) {
    const label = c.sublabel ? `${c.label}\\n${c.sublabel}` : c.label
    lines.push(`  ${c.id}["${escLabel(label)}"]`)
  }
  for (const e of doc.connections ?? []) {
    const lab = e.label ? `|${escLabel(e.label)}|` : ''
    lines.push(`  ${e.from} -->${lab} ${e.to}`)
  }
  return `${lines.join('\n')}\n`
}

export function diagramToMermaid(d: AnyDiagram): { text: string; lossy: boolean } {
  if (isFlowchart(d)) return { text: flowchartToMermaid(d), lossy: false }
  if (isArchitecture(d)) return { text: architectureToMermaid(d), lossy: true }
  throw new Error('无法导出 Mermaid')
}
