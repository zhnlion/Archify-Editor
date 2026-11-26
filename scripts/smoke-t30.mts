import { writeFileSync } from 'node:fs'
import { flowchartToWorkflow } from '../src/export/workflowFinalize.ts'
const nodes = Array.from({ length: 30 }, (_, i) => ({
  id: `n${i}`,
  shape: (i === 0 ? 'start' : i === 29 ? 'end' : 'process') as 'start' | 'end' | 'process',
  label: `Node ${i}`,
  pos: [80 + (i % 6) * 160, 40 + Math.floor(i / 6) * 100] as [number, number],
  size: [140, 56] as [number, number],
}))
const edges = Array.from({ length: 29 }, (_, i) => ({ id: `e${i}`, from: `n${i}`, to: `n${i + 1}` }))
const wf = flowchartToWorkflow({ schema_version: 1, diagram_type: 'flowchart', meta: { title: 't30', output: 't.html' }, nodes, edges })
writeFileSync('./.tmp-t30.workflow.json', JSON.stringify(wf, null, 2))
console.log(JSON.stringify({ lanes: wf.lanes.length, maxCol: Math.max(...wf.nodes.map(n => n.col)), mainPath: wf.mainPath, w: wf.nodes[0].width }))
