import { readFileSync, writeFileSync } from 'fs'
import { projectWorkflowToFlowchart } from '../src/import/workflowProjection.ts'
import { prepareWorkflowFinalizePayload, flowchartToWorkflow } from '../src/export/workflowFinalize.ts'
import { sampleFlowchart } from '../src/samples.ts'

const raw = JSON.parse(readFileSync('./examples/agent-tool-call.workflow.json','utf8'))
const imported = projectWorkflowToFlowchart(raw)
if (!imported.ok) throw new Error(JSON.stringify(imported))
const { diagram, fromSource } = prepareWorkflowFinalizePayload(imported.diagram)
writeFileSync('./.tmp-prepared.workflow.json', JSON.stringify(diagram, null, 2))
console.log('fromSource', fromSource, 'metaKeys', Object.keys(diagram.meta))
const synth = flowchartToWorkflow(sampleFlowchart)
writeFileSync('./.tmp-synth.workflow.json', JSON.stringify(synth, null, 2))
console.log('synth ok', synth.nodes.length, synth.mainPath)
