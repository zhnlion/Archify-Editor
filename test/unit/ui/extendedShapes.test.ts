import { describe, expect, it } from 'vitest'
import { fixtureJson } from '../../helpers/fixtures'
import type { FlowchartDocument } from '../../../src/types'
import { FLOW_SHAPE_GROUPS, FLOW_SHAPES, SHAPE_DEFAULT } from '../../../src/types'
import { parseDiagram } from '../../../src/domain/document'
import { diagramToDrawio } from '../../../src/import/drawio'

const EXTRA = ['offpage', 'merge', 'multi_document'] as const

describe('occasional ANSI shapes', () => {
  it('registers offpage/merge/multi_document in palette + defaults', () => {
    const ids = new Set(FLOW_SHAPES.map((s) => s.shape))
    const listed = FLOW_SHAPE_GROUPS.flatMap((g) => g.shapes)
    for (const s of EXTRA) {
      expect(ids.has(s)).toBe(true)
      expect(listed).toContain(s)
      expect(SHAPE_DEFAULT[s]).toBeTruthy()
    }
  })

  it('parses extended-shapes fixture and round-trips draw.io archifyShape', () => {
    const raw = fixtureJson<FlowchartDocument>('extendedShapes')
    const doc = parseDiagram(raw)
    expect(doc.diagram_type).toBe('flowchart')
    if (doc.diagram_type !== 'flowchart') return
    const shapes = new Set(doc.nodes.map((n) => n.shape))
    for (const s of EXTRA) expect(shapes.has(s)).toBe(true)
    expect(shapes.has('document')).toBe(true)
    expect(shapes.has('database')).toBe(true)
    expect(shapes.has('preparation')).toBe(true)

    const { text } = diagramToDrawio(doc)
    expect(text).toContain('archifyShape=offpage')
    expect(text).toContain('archifyShape=merge')
    expect(text).toContain('archifyShape=multi_document')
  })
})
