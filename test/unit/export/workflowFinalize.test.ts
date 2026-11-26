import { describe, expect, it } from 'vitest'
import { projectWorkflowToFlowchart } from '../../../src/import/workflowProjection'
import {
  flowchartToWorkflow,
  mergeFlowchartIntoWorkflow,
  prepareWorkflowFinalizePayload,
} from '../../../src/export/workflowFinalize'
import { fixtureJson } from '../../helpers/fixtures'

describe('workflow finalize payload', () => {
  it('preserves source for Archify HTML fidelity', () => {
    const raw = fixtureJson('agentWorkflow')
    const imported = projectWorkflowToFlowchart(raw)
    expect(imported.ok).toBe(true)
    if (!imported.ok || imported.diagram.diagram_type !== 'flowchart') return

    const { diagram, fromSource } = prepareWorkflowFinalizePayload(imported.diagram)
    expect(fromSource).toBe(true)
    expect(diagram.diagram_type).toBe('workflow')
    expect(diagram.lanes?.length).toBeGreaterThan(1)
    expect(diagram.phases?.length).toBeGreaterThan(0)
    expect(diagram.groups?.length).toBeGreaterThan(0)
    expect(diagram.nodes.some((n) => n.id === 'approval')).toBe(true)
  })

  it('merges label edits into source workflow', () => {
    const raw = fixtureJson<{ lanes: unknown[] }>('agentWorkflow')
    const imported = projectWorkflowToFlowchart(raw)
    if (!imported.ok || imported.diagram.diagram_type !== 'flowchart') return
    const flow = structuredClone(imported.diagram)
    const node = flow.nodes.find((n) => n.id === 'approval')
    if (node) node.label = '审批闸门\n新说明'
    const merged = mergeFlowchartIntoWorkflow(flow, flow.meta.editor!.archify_workflow!)
    expect(merged.nodes.find((n) => n.id === 'approval')?.label).toBe('审批闸门')
    expect(merged.nodes.find((n) => n.id === 'approval')?.sublabel).toBe('新说明')
    expect(merged.lanes.length).toBe(raw.lanes.length)
  })

  it('synthesizes workflow when no source', () => {
    const wf = flowchartToWorkflow({
      schema_version: 1,
      diagram_type: 'flowchart',
      meta: { title: 't', output: 'o.html' },
      nodes: [
        { id: 'a', shape: 'start', label: '开始' },
        { id: 'b', shape: 'end', label: '结束' },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }],
    })
    expect(wf.diagram_type).toBe('workflow')
    expect(wf.lanes).toHaveLength(1)
    expect(wf.nodes).toHaveLength(2)
  })

  it('assigns unique col per lane to avoid node-overlap', () => {
    const raw = fixtureJson('demoFlowchart')
    const wf = flowchartToWorkflow(raw as Parameters<typeof flowchartToWorkflow>[0])
    const keys = wf.nodes.map((n) => `${n.lane}:${n.col}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(wf.nodes.every((n) => n.col >= 0 && n.col <= 7)).toBe(true)
    expect(wf.meta.quality_profile).toBe('standard')
  })

  it('packs ~30 nodes into a near-square grid without bogus mainPath', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      shape: (i === 0 ? 'start' : i === 29 ? 'end' : 'process') as 'start' | 'end' | 'process',
      label: `N${i}`,
      pos: [i * 10, i * 10] as [number, number],
    }))
    const edges = Array.from({ length: 29 }, (_, i) => ({
      id: `e${i}`,
      from: `n${i}`,
      to: `n${i + 1}`,
    }))
    const wf = flowchartToWorkflow({
      schema_version: 1,
      diagram_type: 'flowchart',
      meta: { title: 't30', output: 't.html' },
      nodes,
      edges,
    })
    expect(wf.lanes.length).toBeGreaterThanOrEqual(4)
    expect(wf.lanes.length).toBeLessThanOrEqual(8)
    expect(wf.mainPath).toBeUndefined()
    const keys = wf.nodes.map((n) => `${n.lane}:${n.col}`)
    expect(new Set(keys).size).toBe(30)
  })
})
