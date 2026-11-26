import { describe, expect, it } from 'vitest'
import { sampleLayered } from '../../../src/samples'
import type { ArchifyDiagram } from '../../../src/types'
import {
  batchResizeNodes,
  filenameFor,
  layerBand,
  layerIndexAtPoint,
  parseDiagram,
  stripForFinalize,
  syncBoundaries,
} from '../../../src/domain/document'
import type { EditorLayer, FlowchartDocument } from '../../../src/types'

describe('parseDiagram', () => {
  it('accepts flowchart', () => {
    const d = parseDiagram({
      schema_version: 1,
      diagram_type: 'flowchart',
      meta: { title: 't', output: 'a.html' },
      nodes: [],
      edges: [],
    })
    expect(d.diagram_type).toBe('flowchart')
  })

  it('rejects unknown type', () => {
    expect(() => parseDiagram({ diagram_type: 'mindmap' })).toThrow(/diagram_type/)
  })
})

describe('batchResizeNodes', () => {
  const sample: FlowchartDocument = {
    schema_version: 1,
    diagram_type: 'flowchart',
    meta: { title: 't', output: 'a.html' },
    nodes: [
      { id: 'a', shape: 'process', label: 'A', pos: [0, 0], size: [100, 40] },
      { id: 'b', shape: 'process', label: 'B', pos: [20, 20], size: [160, 80] },
      { id: 'c', shape: 'decision', label: 'C', pos: [40, 40], size: [120, 60] },
    ],
    edges: [],
  }

  it('unifies width only; keeps each height', () => {
    const out = batchResizeNodes(sample, ['a', 'b'], { width: 200 })
    expect(out.diagram_type).toBe('flowchart')
    if (out.diagram_type !== 'flowchart') return
    expect(out.nodes.find((n) => n.id === 'a')?.size).toEqual([200, 40])
    expect(out.nodes.find((n) => n.id === 'b')?.size).toEqual([200, 80])
    expect(out.nodes.find((n) => n.id === 'c')?.size).toEqual([120, 60])
  })

  it('unifies height only; clamps below MIN_SIZE', () => {
    const out = batchResizeNodes(sample, ['a', 'b', 'c'], { height: 10 })
    if (out.diagram_type !== 'flowchart') return
    expect(out.nodes.map((n) => n.size?.[1])).toEqual([24, 24, 24])
    expect(out.nodes.find((n) => n.id === 'b')?.size?.[0]).toBe(160)
  })
})

describe('filenameFor', () => {
  it('uses type suffix', () => {
    expect(filenameFor(sampleLayered)).toBe('三层-web-架构.architecture.json')
  })
})

describe('stripForFinalize', () => {
  it('drops editor metadata and style', () => {
    const withStyle = structuredClone(sampleLayered)
    withStyle.components[0].style = { fill: '#fff' }
    withStyle.components[0].shape = 'process'
    withStyle.meta.editor = { ...withStyle.meta.editor, styles: { web: { fill: '#fff' } } }
    const out = stripForFinalize(withStyle)
    expect(out.meta).not.toHaveProperty('editor')
    expect(out.components[0]).not.toHaveProperty('style')
    expect(out.components[0]).not.toHaveProperty('shape')
    expect(out.boundaries?.map((b) => b.label)).toEqual([
      '展示层',
      '服务层',
      '数据层',
      '系统边界',
    ])
  })

  it('strips boundary padBottom (schema only allows pad)', () => {
    const doc: ArchifyDiagram = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 't', output: 't.html', editor: { mode: 'free' } },
      components: [
        { id: 'web', type: 'frontend', label: 'Web' },
        { id: 'api', type: 'backend', label: 'API' },
      ],
      boundaries: [
        {
          kind: 'region',
          label: '数据面层（双进程）',
          wraps: ['web', 'api'],
          padBottom: 24,
        },
        {
          kind: 'region',
          label: '主处理进程',
          wraps: ['api'],
          pad: 12,
          padBottom: 8,
        },
      ] as unknown as ArchifyDiagram['boundaries'],
    }
    const out = stripForFinalize(doc)
    // padBottom 折叠进 pad 后导出；不保留 padBottom/padLeft 等编辑态字段
    expect(out.boundaries).toEqual([
      { kind: 'region', label: '数据面层（双进程）', wraps: ['web', 'api'], pad: 24 },
      { kind: 'region', label: '主处理进程', wraps: ['api'], pad: 12 },
    ])
    for (const b of out.boundaries ?? []) {
      expect(b).not.toHaveProperty('padBottom')
      expect(b).not.toHaveProperty('padLeft')
    }
  })
})

describe('syncBoundaries', () => {
  it('keeps wraps by layer labels', () => {
    const synced = syncBoundaries(sampleLayered)
    expect(synced.boundaries?.find((b) => b.label === '数据层')?.wraps).toContain('db')
  })

  it('preserves outer non-layer boundaries', () => {
    const synced = syncBoundaries(sampleLayered)
    expect(synced.boundaries?.find((b) => b.label === '系统边界')?.wraps).toEqual([
      'web',
      'api',
      'db',
    ])
  })
})

describe('stripForFinalize outer boundary', () => {
  it('keeps outer boundary after strip', () => {
    const out = stripForFinalize(sampleLayered)
    expect(out.boundaries?.some((b) => b.label === '系统边界')).toBe(true)
  })
})

describe('vertical swimlane geometry', () => {
  const layers: EditorLayer[] = [
    { id: 'fast', label: 'Fast path', order: 0, width: 200, height: 800 },
    { id: 'fwd', label: 'Forward-SFC', order: 1, width: 200, height: 800 },
    { id: 'dec', label: 'Decrypted-SFC', order: 2, width: 200, height: 800 },
  ]

  it('layerBand stacks columns left-to-right', () => {
    const a = layerBand(layers, 0, 200, 'vertical')
    const b = layerBand(layers, 1, 200, 'vertical')
    expect(a.x).toBeLessThan(b.x)
    expect(a.y).toBe(b.y)
    expect(a.w).toBe(200)
  })

  it('layerIndexAtPoint picks column by x', () => {
    const b0 = layerBand(layers, 0, 200, 'vertical')
    const b1 = layerBand(layers, 1, 200, 'vertical')
    expect(layerIndexAtPoint(layers, [b0.x + 20, 100], 200, 'vertical')).toBe(0)
    expect(layerIndexAtPoint(layers, [b1.x + 20, 100], 200, 'vertical')).toBe(1)
  })
})
