import { describe, expect, it } from 'vitest'
import { sampleFlowchart } from '../../../src/samples'
import { flowchartToMermaid } from '../../../src/export/mermaid'
import { importMermaidFlowchart } from '../../../src/import/mermaidImport'

describe('mermaid roundtrip (lossy layout)', () => {
  it('exports flowchart TD with nodes and edge labels', () => {
    const text = flowchartToMermaid(sampleFlowchart)
    expect(text).toMatch(/^flowchart TD/)
    expect(text).toContain('n1')
    expect(text).toContain('是')
  })

  it('imports simple mermaid', () => {
    const doc = importMermaidFlowchart(`flowchart TD
  a(["Start"])
  b{"OK?"}
  c["Do"]
  a --> b
  b -->|yes| c`)
    expect(doc.diagram_type).toBe('flowchart')
    expect(doc.nodes.length).toBe(3)
    expect(doc.edges.some((e) => e.label === 'yes')).toBe(true)
    expect(doc.meta.format_hints?.source).toBe('mermaid')
  })
})
