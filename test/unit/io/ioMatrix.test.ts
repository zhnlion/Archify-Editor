/**
 * 导入 / 导出 / 转换可验证矩阵 — 对齐 docs/TEST-MATRIX.md
 * 夹具：test/fixtures + test/helpers/fixtures.ts
 */
import { describe, expect, it } from 'vitest'
import { enrichArchitectureBoundaries } from '../../../src/domain/boundaries'
import {
  isArchitecture,
  isFlowchart,
  parseDiagram,
  stripForFinalize,
} from '../../../src/domain/document'
import { openDocument } from '../../../src/import/openDocument'
import { openTypedDocument } from '../../../src/import/openTyped'
import { diagramToMermaid, flowchartToMermaid } from '../../../src/export/mermaid'
import { prepareWorkflowFinalizePayload } from '../../../src/export/workflowFinalize'
import { diagramToDrawio } from '../../../src/import/drawio'
import { mergeImportedGeometry } from '../../../src/domain/layout'
import { IMPORT_FORMATS, exportFormatsFor } from '../../../src/io/formats'
import { fixtureJson, fixtureText } from '../../helpers/fixtures'

describe('TC-IMP 导入', () => {
  it('TC-IMP-01 auto · demo.flowchart.json', () => {
    const result = openTypedDocument(fixtureText('demoFlowchart'), 'auto')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toBe('flowchart')
    expect(result.diagram.meta.title).toBe('包处理流程')
  })

  it('TC-IMP-02 auto · demo.architecture.json', () => {
    const result = openTypedDocument(fixtureText('demoArchitecture'), 'auto')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toBe('architecture')
  })

  it('TC-IMP-03 auto · workflow → flowchart + archify_workflow', () => {
    const result = openTypedDocument(fixtureText('agentWorkflow'), 'auto')
    expect(result.ok).toBe(true)
    if (!result.ok || !isFlowchart(result.diagram)) return
    expect(result.format_hints.source).toBe('archify')
    expect(result.diagram.meta.editor?.archify_workflow?.diagram_type).toBe('workflow')
    expect(result.diagram.nodes.length).toBeGreaterThan(5)
  })

  it('TC-IMP-04 editor-json accepts native, rejects workflow', () => {
    expect(openTypedDocument(fixtureText('demoFlowchart'), 'editor-json').ok).toBe(true)
    expect(openTypedDocument(fixtureText('demoArchitecture'), 'editor-json').ok).toBe(true)
    const bad = openTypedDocument(fixtureText('agentWorkflow'), 'editor-json')
    expect(bad.ok).toBe(false)
  })

  it('TC-IMP-05 archify-architecture accepts only architecture', () => {
    expect(openTypedDocument(fixtureText('demoArchitecture'), 'archify-architecture').ok).toBe(true)
    expect(openTypedDocument(fixtureText('demoFlowchart'), 'archify-architecture').ok).toBe(false)
    expect(openTypedDocument(fixtureText('agentWorkflow'), 'archify-architecture').ok).toBe(false)
  })

  it('TC-IMP-06 archify-workflow accepts only workflow', () => {
    const ok = openTypedDocument(fixtureText('agentWorkflow'), 'archify-workflow')
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.diagram.diagram_type).toBe('flowchart')
    expect(openTypedDocument(fixtureText('demoArchitecture'), 'archify-workflow').ok).toBe(false)
  })

  it('TC-IMP-07 mermaid · simple.mmd', () => {
    const result = openTypedDocument(fixtureText('simpleMermaid'), 'mermaid')
    expect(result.ok).toBe(true)
    if (!result.ok || !isFlowchart(result.diagram)) return
    expect(result.format_hints.source).toBe('mermaid')
    expect(result.diagram.nodes.length).toBe(6)
    expect(result.diagram.edges.some((e) => e.label === '是')).toBe(true)
    expect(result.diagram.edges.some((e) => e.label === '否')).toBe(true)
  })

  it('TC-IMP-08 nested boundaries enrich pads', () => {
    const result = openTypedDocument(fixtureText('nestedBoundaries'), 'archify-architecture')
    expect(result.ok).toBe(true)
    if (!result.ok || !isArchitecture(result.diagram)) return
    const bounds = result.diagram.boundaries ?? []
    const outer = bounds.find((b) => b.label === '数据面层（双进程）')
    const mid = bounds.find((b) => b.label === '主处理进程')
    const inner = bounds.find((b) => b.label === '基础设施底座')
    expect(outer?.pad).toBeDefined()
    expect(mid?.pad).toBeDefined()
    expect(inner?.pad).toBeDefined()
    expect(outer!.pad!).toBeGreaterThan(mid!.pad!)
    expect(mid!.pad!).toBeGreaterThanOrEqual(inner!.pad!)
    // 编辑态可保留分侧 pad*；finalize 剥离见 TC-X-04 / TC-EXP-03
    for (const b of bounds) {
      expect(typeof b.pad).toBe('number')
    }
  })

  it('TC-IMP-09 drawio subset import', () => {
    const drawio = IMPORT_FORMATS.find((f) => f.id === 'drawio')
    expect(drawio?.enabled).toBe(true)
    const result = openTypedDocument(fixtureText('subsetDrawio'), 'drawio')
    expect(result.ok).toBe(true)
    if (!result.ok || !isFlowchart(result.diagram)) return
    expect(result.diagram.nodes.some((n) => n.shape === 'decision')).toBe(true)
    expect(result.lossy?.dropped?.length).toBeGreaterThan(0)
  })

  it('TC-IMP-10 drawio compressed expands and imports', () => {
    const result = openTypedDocument(fixtureText('compressedDrawio'), 'drawio')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toMatch(/flowchart|architecture/)
    if (result.diagram.diagram_type === 'flowchart') {
      expect(result.diagram.nodes.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('TC-IMP-10b undecodable compressed drawio guides 未压缩 XML', () => {
    const result = openTypedDocument(fixtureText('compressedBrokenDrawio'), 'drawio')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message).toMatch(/未压缩/)
  })

  it('TC-IMP-11 mermaid C4 → architecture lossy', () => {
    const result = openTypedDocument(fixtureText('simpleC4Mermaid'), 'mermaid')
    expect(result.ok).toBe(true)
    if (!result.ok || !isArchitecture(result.diagram)) return
    expect(result.format_hints.source).toBe('mermaid')
    expect(result.diagram.components.length).toBeGreaterThanOrEqual(3)
    expect(result.lossy?.dropped?.length).toBeGreaterThan(0)
  })
})

describe('TC-EXP 导出', () => {
  it('TC-EXP-01 flowchart editor JSON roundtrip', () => {
    const raw = fixtureJson('demoFlowchart')
    const opened = openDocument(raw)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const text = JSON.stringify(opened.diagram, null, 2)
    const again = openTypedDocument(text, 'editor-json')
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.diagram.diagram_type).toBe('flowchart')
  })

  it('TC-EXP-02 architecture editor JSON may keep meta.editor', () => {
    const raw = fixtureJson<{ meta: { editor?: unknown } }>('nestedBoundaries')
    expect(raw.meta.editor).toBeTruthy()
    const opened = openDocument(raw)
    expect(opened.ok).toBe(true)
    if (!opened.ok || !isArchitecture(opened.diagram)) return
    expect(opened.diagram.meta.editor).toBeTruthy()
  })

  it('TC-EXP-03 architecture Archify JSON strips private fields', () => {
    const opened = openDocument(fixtureJson('nestedBoundaries'))
    expect(opened.ok).toBe(true)
    if (!opened.ok || !isArchitecture(opened.diagram)) return
    const stripped = stripForFinalize(opened.diagram)
    expect(stripped.meta).not.toHaveProperty('editor')
    for (const c of stripped.components) expect(c).not.toHaveProperty('style')
    for (const b of stripped.boundaries ?? []) {
      expect(b).not.toHaveProperty('padBottom')
      expect(Object.keys(b).every((k) => ['kind', 'label', 'wraps', 'pad'].includes(k))).toBe(true)
    }
  })

  it('TC-EXP-04 workflow import → Archify workflow export preserves source', () => {
    const imported = openTypedDocument(fixtureText('agentWorkflow'), 'archify-workflow')
    expect(imported.ok).toBe(true)
    if (!imported.ok || !isFlowchart(imported.diagram)) return
    const { diagram, fromSource } = prepareWorkflowFinalizePayload(imported.diagram)
    expect(fromSource).toBe(true)
    expect(diagram.diagram_type).toBe('workflow')
    expect((diagram.lanes ?? []).length).toBeGreaterThan(1)
  })

  it('TC-EXP-05 native flowchart → synthesized workflow unique cols', () => {
    const opened = openDocument(fixtureJson('demoFlowchart'))
    expect(opened.ok).toBe(true)
    if (!opened.ok || !isFlowchart(opened.diagram)) return
    const { diagram, fromSource } = prepareWorkflowFinalizePayload(opened.diagram)
    expect(fromSource).toBe(false)
    expect(diagram.diagram_type).toBe('workflow')
    const keys = diagram.nodes.map((n) => `${n.lane}:${n.col}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('TC-EXP-06 flowchart → mermaid', () => {
    const doc = parseDiagram(fixtureJson('demoFlowchart'))
    if (!isFlowchart(doc)) throw new Error('expected flowchart')
    const text = flowchartToMermaid(doc)
    expect(text).toMatch(/^flowchart TD/)
    expect(text).toContain('是')
  })

  it('TC-EXP-07 architecture → mermaid lossy', () => {
    const doc = parseDiagram(fixtureJson('demoArchitecture'))
    const { text, lossy } = diagramToMermaid(doc)
    expect(lossy).toBe(true)
    expect(text).toMatch(/^flowchart LR/)
    expect(text).toContain('ui')
  })

  it('TC-EXP-10 drawio export is enabled and readable', () => {
    expect(exportFormatsFor('flowchart').find((f) => f.id === 'drawio')?.enabled).toBe(true)
    expect(exportFormatsFor('architecture').find((f) => f.id === 'drawio')?.enabled).toBe(true)
    const opened = openTypedDocument(fixtureText('subsetDrawio'), 'drawio')
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    const { text } = diagramToDrawio(opened.diagram)
    expect(text).toContain('mxCell')
    const again = openTypedDocument(text, 'drawio')
    expect(again.ok).toBe(true)
  })

  it('export menu enables core formats for both types', () => {
    for (const t of ['flowchart', 'architecture'] as const) {
      const ids = exportFormatsFor(t).filter((f) => f.enabled).map((f) => f.id)
      expect(ids).toEqual(
        expect.arrayContaining([
          'editor-json',
          'archify-json',
          'html',
          'mermaid',
          'svg',
          'png',
          'jpeg',
          'webp',
        ]),
      )
    }
  })
})

describe('TC-X 转换 / 往返', () => {
  it('TC-X-01 workflow → flowchart → merge workflow keeps ids', () => {
    const source = fixtureJson<{ nodes: Array<{ id: string }> }>('agentWorkflow')
    const imported = openTypedDocument(JSON.stringify(source), 'archify-workflow')
    expect(imported.ok).toBe(true)
    if (!imported.ok || !isFlowchart(imported.diagram)) return
    const flow = structuredClone(imported.diagram)
    const n = flow.nodes.find((x) => x.id === 'approval')
    if (n) n.label = '审批闸门\n矩阵测'
    const { diagram } = prepareWorkflowFinalizePayload(flow)
    const ids = new Set(diagram.nodes.map((x) => x.id))
    for (const node of source.nodes) expect(ids.has(node.id)).toBe(true)
    expect(diagram.nodes.find((x) => x.id === 'approval')?.label).toBe('审批闸门')
  })

  it('TC-X-02 flowchart → mermaid → flowchart topology', () => {
    const opened = openTypedDocument(fixtureText('simpleMermaid'), 'mermaid')
    expect(opened.ok).toBe(true)
    if (!opened.ok || !isFlowchart(opened.diagram)) return
    const mmd = flowchartToMermaid(opened.diagram)
    const again = openTypedDocument(mmd, 'mermaid')
    expect(again.ok).toBe(true)
    if (!again.ok || !isFlowchart(again.diagram)) return
    expect(again.diagram.nodes.length).toBe(opened.diagram.nodes.length)
    expect(again.diagram.edges.length).toBe(opened.diagram.edges.length)
    expect(again.diagram.edges.some((e) => e.label === '是')).toBe(true)
  })

  it('TC-X-07 mermaid re-import preserves moved pos / via (F-22)', () => {
    const first = openTypedDocument(fixtureText('simpleMermaid'), 'mermaid')
    expect(first.ok).toBe(true)
    if (!first.ok || !isFlowchart(first.diagram)) return
    const edited = structuredClone(first.diagram)
    const node = edited.nodes[0]!
    node.pos = [420, 260]
    node.size = [180, 72]
    const edge = edited.edges[0]
    if (edge) {
      edge.via = [[500, 200]]
      edge.fromSide = 'e'
      edge.toSide = 'w'
    }
    const incoming = openTypedDocument(fixtureText('simpleMermaid'), 'mermaid')
    expect(incoming.ok).toBe(true)
    if (!incoming.ok || !isFlowchart(incoming.diagram)) return
    const merged = mergeImportedGeometry(edited, incoming.diagram)
    if (!isFlowchart(merged)) return
    const kept = merged.nodes.find((n) => n.id === node.id)
    expect(kept?.pos).toEqual([420, 260])
    expect(kept?.size).toEqual([180, 72])
    if (edge) {
      const me = merged.edges.find((e) => e.id === edge.id)
      expect(me?.via).toEqual([[500, 200]])
      expect(me?.fromSide).toBe('e')
    }
  })

  it('TC-X-03 architecture strip then parse', () => {
    const opened = openDocument(fixtureJson('demoArchitecture'))
    expect(opened.ok).toBe(true)
    if (!opened.ok || !isArchitecture(opened.diagram)) return
    const stripped = stripForFinalize(opened.diagram)
    const again = parseDiagram(JSON.parse(JSON.stringify(stripped)))
    expect(isArchitecture(again)).toBe(true)
    expect(again.meta).not.toHaveProperty('editor')
  })

  it('TC-X-04 nested enrich → strip whitelist', () => {
    const raw = fixtureJson('nestedBoundaries')
    const enriched = enrichArchitectureBoundaries(
      parseDiagram(raw) as ReturnType<typeof parseDiagram> & { diagram_type: 'architecture' },
    )
    if (!isArchitecture(enriched)) throw new Error('expected architecture')
    const stripped = stripForFinalize(enriched)
    const blob = JSON.stringify(stripped)
    expect(blob).not.toContain('padBottom')
    expect(blob).not.toContain('"editor"')
    expect(stripped.boundaries?.every((b) => typeof b.pad === 'number' || b.pad === undefined)).toBe(
      true,
    )
  })

  it('TC-X-05 Codec does not auto-convert flowchart↔architecture', () => {
    const flow = openDocument(fixtureJson('demoFlowchart'))
    const arch = openDocument(fixtureJson('demoArchitecture'))
    expect(flow.ok && flow.diagram.diagram_type).toBe('flowchart')
    expect(arch.ok && arch.diagram.diagram_type).toBe('architecture')
  })

  it('TC-X-06 TypeMismatch workflow as architecture', () => {
    const result = openTypedDocument(fixtureText('agentWorkflow'), 'archify-architecture')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TypeMismatch')
  })
})
