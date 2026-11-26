import { describe, expect, it } from 'vitest'
import type { ArchifyDiagram } from '../../../src/types'
import {
  boundaryPatchFromNodeStyle,
  getBoundaryStyle,
  paintBoundaries,
  paintLanes,
  renameBoundaryStyle,
  setBoundaryStyle,
} from '../../../src/domain/boundaryStyle'
import { emptyFlowchart } from '../../../src/domain/document'
import { stripForFinalize } from '../../../src/domain/document'

const base = (): ArchifyDiagram => ({
  schema_version: 1,
  diagram_type: 'architecture',
  meta: { title: 't', output: 't.html', editor: { mode: 'free' } },
  components: [
    { id: 'a', type: 'frontend', label: 'A' },
    { id: 'b', type: 'backend', label: 'B' },
  ],
  boundaries: [
    { kind: 'region', label: '外框', wraps: ['a', 'b'], pad: 16 },
    { kind: 'region', label: '内框', wraps: ['a'], pad: 12 },
  ],
})

describe('boundaryStyle', () => {
  it('stores style under meta.editor.boundaryStyles', () => {
    const d = setBoundaryStyle(base(), '外框', { fill: '#112233', stroke: '#445566' })
    const st = getBoundaryStyle(d, '外框')
    expect(st.fill).toBe('#112233')
    expect(st.stroke).toBe('#445566')
  })

  it('preserves explicit white fill in dark theme', () => {
    const d = setBoundaryStyle(base(), '外框', { fill: '#FFFFFF' })
    expect(getBoundaryStyle(d, '外框', 'dark').fill).toBe('#FFFFFF')
    expect(getBoundaryStyle(d, '外框', 'light').fill).toBe('#FFFFFF')
  })

  it('renames style key with boundary label', () => {
    let d = setBoundaryStyle(base(), '外框', { fill: '#abc' })
    d = renameBoundaryStyle(d, '外框', '新名')
    expect(d.meta.editor?.boundaryStyles?.['新名']?.fill).toBe('#abc')
    expect(d.meta.editor?.boundaryStyles?.['外框']).toBeUndefined()
  })

  it('stripForFinalize drops boundaryStyles with meta.editor', () => {
    const d = setBoundaryStyle(base(), '外框', { fill: '#abc', stroke: '#def' })
    const out = stripForFinalize(d)
    expect(out.meta).not.toHaveProperty('editor')
    expect(JSON.stringify(out)).not.toContain('boundaryStyles')
    expect(JSON.stringify(out)).not.toContain('#abc')
  })

  it('boundaryPatchFromNodeStyle keeps fill, stroke and font fields', () => {
    expect(
      boundaryPatchFromNodeStyle({
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3.2,
        fontSize: 18,
        text: '#111',
        fontWeight: 'bold',
        fontStyle: 'italic',
        strokeDasharray: '6 4',
      }),
    ).toEqual({
      fill: '#ff0000',
      stroke: '#00ff00',
      strokeWidth: 3.2,
      fontSize: 18,
      text: '#111',
      fontWeight: 'bold',
      fontStyle: 'italic',
      strokeDasharray: '6 4',
    })
  })

  it('paintBoundaries applies fill/strokeWidth to selected indexes (Ctrl+A batch)', () => {
    const d = paintBoundaries(base(), [0, 1], { strokeWidth: 4, fontSize: 20, fill: '#fff' })
    expect(getBoundaryStyle(d, '外框').strokeWidth).toBe(4)
    expect(getBoundaryStyle(d, '外框').fontSize).toBe(20)
    expect(getBoundaryStyle(d, '内框').strokeWidth).toBe(4)
    expect(getBoundaryStyle(d, '外框').fill).toBe('#fff')
    expect(getBoundaryStyle(d, '内框').fill).toBe('#fff')
  })

  it('getBoundaryStyle surfaces bold/italic/dash after paintBoundaries', () => {
    const d = paintBoundaries(base(), [0], {
      fontWeight: 'bold',
      fontStyle: 'italic',
      strokeDasharray: '',
      text: '#abcdef',
    })
    const st = getBoundaryStyle(d, '外框')
    expect(st.fontWeight).toBe('bold')
    expect(st.fontStyle).toBe('italic')
    expect(st.strokeDasharray).toBe('')
    expect(st.text).toBe('#abcdef')
  })

  it('paintLanes writes fill and strokeDasharray onto selected swimlanes', () => {
    let doc = emptyFlowchart()
    doc = {
      ...doc,
      meta: {
        ...doc.meta,
        editor: {
          ...doc.meta.editor,
          mode: 'swimlane',
          layers: [
            { id: 'L1', label: '泳道1', order: 0 },
            { id: 'L2', label: '泳道2', order: 1 },
          ],
        },
      },
    }
    doc = paintLanes(doc, ['L1', 'L2'], {
      fill: '#FEF3C7',
      strokeDasharray: '6 4',
      strokeWidth: 3,
    })
    expect(doc.meta.editor?.layers?.[0]?.style?.fill).toBe('#FEF3C7')
    expect(doc.meta.editor?.layers?.[1]?.style?.fill).toBe('#FEF3C7')
    expect(doc.meta.editor?.layers?.[0]?.style?.strokeDasharray).toBe('6 4')
    expect(doc.meta.editor?.layers?.[1]?.style?.strokeWidth).toBe(3)
    doc = paintLanes(doc, ['L1'], { strokeDasharray: '' })
    expect(doc.meta.editor?.layers?.[0]?.style?.strokeDasharray).toBe('')
    expect(doc.meta.editor?.layers?.[1]?.style?.strokeDasharray).toBe('6 4')
  })
})
