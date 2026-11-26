import { describe, expect, it } from 'vitest'
import {
  diagramToDrawio,
  expandCompressedDrawio,
  importDrawioDocument,
  isCompressedDrawio,
} from '../../../src/import/drawio'
import { fixtureText } from '../../helpers/fixtures'

const fixture = fixtureText('subsetDrawio')

describe('draw.io subset', () => {
  it('TC-IMP-10 expands compressed draw.io and imports cells', () => {
    const compressed = fixtureText('compressedDrawio')
    expect(isCompressedDrawio(compressed)).toBe(true)
    const expanded = expandCompressedDrawio(compressed)
    expect(expanded).toBeTruthy()
    expect(expanded).toMatch(/mxCell/)
    const result = importDrawioDocument(compressed, 'flowchart')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toBe('flowchart')
    if (result.diagram.diagram_type !== 'flowchart') return
    expect(result.diagram.nodes.some((n) => n.shape === 'decision')).toBe(true)
    expect(result.diagram.nodes.length).toBeGreaterThanOrEqual(2)
  })

  it('rejects undecodable compressed draw.io with 未压缩 guidance', () => {
    const broken = fixtureText('compressedBrokenDrawio')
    expect(isCompressedDrawio(broken)).toBe(true)
    expect(expandCompressedDrawio(broken)).toBeNull()
    const result = importDrawioDocument(broken, 'flowchart')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toMatch(/未压缩/)
    expect(result.error.message).toMatch(/Export as/)
  })

  it('imports rectangles, diamonds, edges and drops vendor icons', () => {
    const result = importDrawioDocument(fixture, 'flowchart')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toBe('flowchart')
    if (result.diagram.diagram_type !== 'flowchart') return
    expect(result.diagram.nodes.some((n) => n.shape === 'decision')).toBe(true)
    expect(result.diagram.nodes.length).toBeGreaterThanOrEqual(2)
    expect(result.lossy?.dropped?.length).toBeGreaterThan(0)
  })

  it('roundtrips export → import for flowchart', () => {
    const imported = importDrawioDocument(fixture, 'flowchart')
    expect(imported.ok).toBe(true)
    if (!imported.ok) return
    const { text } = diagramToDrawio(imported.diagram)
    const again = importDrawioDocument(text, 'flowchart')
    expect(again.ok).toBe(true)
  })

  it('exports note and text shapes without inventing architecture types', () => {
    const base = importDrawioDocument(fixture, 'flowchart')
    expect(base.ok).toBe(true)
    if (!base.ok || base.diagram.diagram_type !== 'flowchart') return
    const withAnno = {
      ...base.diagram,
      nodes: [
        ...base.diagram.nodes,
        {
          id: 'note-1',
          shape: 'note' as const,
          label: '备注',
          pos: [40, 200] as [number, number],
          size: [120, 64] as [number, number],
        },
        {
          id: 'text-1',
          shape: 'text' as const,
          label: '独立文本',
          pos: [200, 220] as [number, number],
          size: [140, 36] as [number, number],
        },
      ],
    }
    const { text, lossy } = diagramToDrawio(withAnno)
    expect(text).toMatch(/shape=note|archifyShape=note/)
    expect(text).toMatch(/text;|archifyShape=text/)
    expect(lossy?.dropped?.some((d) => /独立文本|备注/.test(d))).toBeFalsy()
  })
})
