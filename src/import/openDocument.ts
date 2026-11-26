import { enrichArchitectureBoundaries } from '../domain/boundaries'
import { isArchitecture, parseDiagram } from '../domain/document'
import type { AnyDiagram } from '../types'
import type { ParseResult } from './types'
import { isArchifyWorkflow, projectWorkflowToFlowchart } from './workflowProjection'

/** 统一打开：native IR 或 Archify workflow 投影 */
export function openDocument(raw: unknown): ParseResult {
  if (isArchifyWorkflow(raw)) {
    return projectWorkflowToFlowchart(raw)
  }
  try {
    let diagram: AnyDiagram = parseDiagram(raw)
    if (isArchitecture(diagram)) {
      diagram = enrichArchitectureBoundaries(diagram)
    }
    return {
      ok: true,
      diagram,
      format_hints: diagram.meta.format_hints ?? { source: 'native' },
    }
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'ParseError',
        message: e instanceof Error ? e.message : String(e),
      },
    }
  }
}
