import { describe, expect, it } from 'vitest'
import { emptyFlowchart, stripForFinalize, emptyArchitecture, isArchitecture, isFlowchart } from '../../../src/domain/document'
import { bindColorTag, createColorTag, paintNodes, upsertColorTag } from '../../../src/domain/colorTags'
import type { AnyDiagram } from '../../../src/types'

describe('color tags', () => {
  it('updates every node that references the tag', () => {
    let doc: AnyDiagram = emptyFlowchart()
    doc = {
      ...doc,
      nodes: [
        { id: 'a', shape: 'process', label: 'A', style: { fill: '#fff', stroke: '#111', text: '#111' } },
        { id: 'b', shape: 'process', label: 'B', style: { fill: '#fff', stroke: '#111', text: '#111' } },
      ],
    }
    const tag = createColorTag('review', '待审核', { fill: '#FDE68A', stroke: '#D97706', text: '#78350F' })
    doc = upsertColorTag(doc, tag)
    doc = bindColorTag(doc, ['a', 'b'], 'review')
    doc = paintNodes(doc, ['a'], { fill: '#FCA5A5' })
    if (!isFlowchart(doc)) throw new Error('type')
    expect(doc.nodes.every((n) => n.style?.fill === '#FCA5A5')).toBe(true)
    expect(doc.meta.editor?.colorTags?.[0].label).toBe('待审核')
  })

  it('paintNodes batch applies font/border local props to every id (incl. shared tag)', () => {
    let doc: AnyDiagram = emptyFlowchart()
    doc = {
      ...doc,
      nodes: [
        { id: 'a', shape: 'process', label: 'A', style: { fill: '#fff', stroke: '#111', text: '#111' } },
        { id: 'b', shape: 'process', label: 'B', style: { fill: '#fff', stroke: '#111', text: '#111' } },
        { id: 'c', shape: 'process', label: 'C', style: { fill: '#eee', stroke: '#222', text: '#222' } },
      ],
    }
    doc = paintNodes(doc, ['a', 'b', 'c'], {
      fontSize: 20,
      fontWeight: 'bold',
      fontStyle: 'italic',
      strokeWidth: 3.5,
      strokeDasharray: '6 4',
      text: '#112233',
    })
    if (!isFlowchart(doc)) throw new Error('type')
    for (const n of doc.nodes) {
      expect(n.style?.fontSize).toBe(20)
      expect(n.style?.fontWeight).toBe('bold')
      expect(n.style?.fontStyle).toBe('italic')
      expect(n.style?.strokeWidth).toBe(3.5)
      expect(n.style?.strokeDasharray).toBe('6 4')
      expect(n.style?.text).toBe('#112233')
    }

    const tag = createColorTag('t1', '同色', { fill: '#FDE68A', stroke: '#D97706', text: '#78350F' })
    doc = upsertColorTag(doc, tag)
    doc = bindColorTag(doc, ['a', 'b'], 't1')
    doc = paintNodes(doc, ['a', 'b'], { fontWeight: 'normal', strokeDasharray: '', strokeWidth: 2 })
    if (!isFlowchart(doc)) throw new Error('type')
    expect(doc.nodes.filter((n) => n.id === 'a' || n.id === 'b').every((n) => n.style?.fontWeight === 'normal')).toBe(
      true,
    )
    expect(doc.nodes.filter((n) => n.id === 'a' || n.id === 'b').every((n) => n.style?.strokeDasharray === '')).toBe(
      true,
    )
    expect(doc.nodes.find((n) => n.id === 'c')?.style?.fontWeight).toBe('bold')
  })

  it('does not keep tagId or editor colors on architecture finalize', () => {
    let doc: AnyDiagram = {
      ...emptyArchitecture(),
      components: [{ id: 'api', type: 'backend', label: 'API', tagId: 'review', style: { fill: '#fff' } }],
      connections: [{ id: 'e', from: 'api', to: 'api', via: [[1, 2]], route: 'curve' }],
    }
    doc = upsertColorTag(doc, createColorTag('review', '待审核'))
    if (!isArchitecture(doc)) throw new Error('type')
    const stripped = stripForFinalize(doc)
    expect(stripped.meta).not.toHaveProperty('editor')
    expect(stripped.components[0]).not.toHaveProperty('tagId')
    expect(stripped.components[0]).not.toHaveProperty('style')
    expect(stripped.connections?.[0]).not.toHaveProperty('via')
    expect(stripped.connections?.[0]).not.toHaveProperty('route')
  })
})
