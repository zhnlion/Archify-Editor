import { describe, expect, it } from 'vitest'
import { paintEdges, snapshotLineStyle } from '../../../src/domain/style'
import type { FlowchartDocument } from '../../../src/types'

function flow(): FlowchartDocument {
  return {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: { title: 't', output: 't.html' },
    nodes: [
      { id: 'a', shape: 'process', label: 'A', pos: [0, 0], size: [80, 40] },
      { id: 'b', shape: 'process', label: 'B', pos: [200, 0], size: [80, 40] },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', label: '是', style: { stroke: '#111', strokeWidth: 2, labelFill: '#eee' } },
      { id: 'e2', from: 'a', to: 'b', label: '否' },
    ],
  }
}

describe('edge format brush helpers', () => {
  it('snapshotLineStyle copies stroke fields and defaults labelFill to none', () => {
    const snap = snapshotLineStyle(
      { stroke: '#f00', strokeWidth: 3, arrow: 'both', strokeDasharray: '6 4' },
      { stroke: '#ccc', strokeWidth: 1.6, arrow: 'end' },
    )
    expect(snap.stroke).toBe('#f00')
    expect(snap.strokeWidth).toBe(3)
    expect(snap.arrow).toBe('both')
    expect(snap.strokeDasharray).toBe('6 4')
    expect(snap.labelFill).toBe('none')
  })

  it('snapshotLineStyle keeps explicit labelFill', () => {
    expect(snapshotLineStyle({ labelFill: '#FEF3C7' }).labelFill).toBe('#FEF3C7')
  })

  it('paintEdges merges style onto target edges', () => {
    const out = paintEdges(flow(), ['e2'], {
      stroke: '#DC2626',
      strokeWidth: 2.4,
      labelFill: '#FEF3C7',
      strokeDasharray: '6 4',
    })
    expect(out.diagram_type).toBe('flowchart')
    if (out.diagram_type !== 'flowchart') return
    const e2 = out.edges.find((e) => e.id === 'e2')
    expect(e2?.style).toMatchObject({
      stroke: '#DC2626',
      strokeWidth: 2.4,
      labelFill: '#FEF3C7',
      strokeDasharray: '6 4',
    })
    const e1 = out.edges.find((e) => e.id === 'e1')
    expect(e1?.style?.stroke).toBe('#111')
  })
})
