import { describe, expect, it } from 'vitest'
import { openDocument } from '../../../src/import/openDocument'
import {
  projectWorkflowToFlowchart,
  workflowDisplayLabel,
} from '../../../src/import/workflowProjection'
import { fixtureJson } from '../../helpers/fixtures'

describe('workflow → flowchart (F-21)', () => {
  it('workflowDisplayLabel: 主标题用 label，丢弃序号副标题', () => {
    expect(workflowDisplayLabel({ id: 'fp_in', label: 'redirect', sublabel: '快路径 1' })).toBe(
      'redirect',
    )
    expect(workflowDisplayLabel({ id: 'x', label: 'rps', sublabel: '1' })).toBe('rps')
    expect(workflowDisplayLabel({ id: 'x', label: 'localin', sublabel: '5 · 分流本机流' })).toBe(
      'localin\n分流本机流',
    )
  })

  it('projects agent-tool-call.workflow.json', () => {
    const raw = fixtureJson('agentWorkflow')
    const result = projectWorkflowToFlowchart(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagram.diagram_type).toBe('flowchart')
    expect(result.format_hints.source).toBe('archify')
    expect(result.diagram.meta.format_hints?.source).toBe('archify')
    if (result.diagram.diagram_type !== 'flowchart') return
    expect(result.diagram.nodes.length).toBeGreaterThan(5)
    expect(result.diagram.edges.some((e) => e.label === 'needs approval?')).toBe(true)
    expect(result.diagram.edges.some((e) => e.label === 'denied')).toBe(true)
    expect(result.diagram.meta.editor?.archify_workflow?.diagram_type).toBe('workflow')
    expect(result.diagram.meta.editor?.mode).toBe('swimlane')
    expect(result.diagram.meta.editor?.layers?.length).toBeGreaterThan(1)
  })

  it('openDocument routes workflow', () => {
    const result = openDocument(fixtureJson('agentWorkflow'))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.diagram.diagram_type).toBe('flowchart')
  })

  it('openDocument keeps native flowchart', () => {
    const result = openDocument(fixtureJson('demoFlowchart'))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.diagram.diagram_type).toBe('flowchart')
      expect(result.diagram.meta.title).toBe('包处理流程')
    }
  })
})
