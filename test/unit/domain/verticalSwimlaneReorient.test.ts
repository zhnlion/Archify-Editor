import { describe, expect, it } from 'vitest'
import { resolveLaneOrientation } from '../../../src/domain/document'
import { reorientFlowchartSwimlanes } from '../../../src/domain/verticalSwimlane'
import type { FlowchartDocument } from '../../../src/types'

function horizontalSwim(): FlowchartDocument {
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: {
      title: '泳道',
      output: 'x.html',
      editor: {
        mode: 'swimlane',
        laneOrientation: 'horizontal',
        layers: [
          { id: 'l0', label: '上', order: 0, height: 160 },
          { id: 'l1', label: '下', order: 1, height: 160 },
        ],
        laneWidth: 600,
      },
    },
    nodes: [
      { id: 'n0', shape: 'process', label: '上1', pos: [40, 40], size: [100, 40] },
      { id: 'n1', shape: 'process', label: '下1', pos: [40, 200], size: [100, 40] },
    ],
    edges: [{ id: 'e0', from: 'n0', to: 'n1', label: '往下' }],
  }
}

describe('reorientFlowchartSwimlanes', () => {
  it('switches horizontal bands to vertical columns and sets laneOrientation', () => {
    const out = reorientFlowchartSwimlanes(horizontalSwim(), 'vertical')
    expect(resolveLaneOrientation(out)).toBe('vertical')
    expect(out.meta.editor?.mode).toBe('swimlane')
    expect(out.meta.editor?.layers?.every((l) => (l.width ?? 0) > 0)).toBe(true)
    const xs = out.nodes.map((n) => n.pos![0])
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(80)
  })

  it('writes orientation with zero lanes', () => {
    const empty: FlowchartDocument = {
      schema_version: 1,
      diagram_type: 'flowchart',
      meta: { title: '空', output: 'e.html' },
      nodes: [],
      edges: [],
    }
    const out = reorientFlowchartSwimlanes(empty, 'vertical')
    expect(resolveLaneOrientation(out)).toBe('vertical')
  })
})
