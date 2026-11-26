import { isArchitecture, isFlowchart } from '../domain/document'
import { isArchifyWorkflow } from './workflowProjection'
import { openDocument } from './openDocument'
import {
  importMermaidArchitecture,
  importMermaidFlowchart,
  isMermaidArchitectureText,
} from './mermaidImport'
import { importDrawioDocument, isDrawioXml } from './drawio'
import type { ImportFormatId } from '../io/formats'
import type { ParseResult } from './types'

export function openTypedDocument(rawText: string, format: ImportFormatId): ParseResult {
  const drawioAuto = format === 'auto' && isDrawioXml(rawText) && !rawText.trim().startsWith('{')
  if (format === 'drawio' || drawioAuto) {
    return importDrawioDocument(rawText)
  }

  const mermaidAuto =
    format === 'auto' &&
    !rawText.trim().startsWith('{') &&
    (isMermaidArchitectureText(rawText) || /^\s*(flowchart|graph)\b/im.test(rawText.trim()))

  if (format === 'mermaid' || format === 'paste-mermaid' || mermaidAuto) {
    try {
      if (isMermaidArchitectureText(rawText)) {
        const { diagram, lossy } = importMermaidArchitecture(rawText)
        return { ok: true, diagram, format_hints: { source: 'mermaid' }, lossy }
      }
      const diagram = importMermaidFlowchart(rawText)
      return { ok: true, diagram, format_hints: { source: 'mermaid' } }
    } catch (e) {
      return {
        ok: false,
        error: { code: 'ParseError', message: e instanceof Error ? e.message : String(e) },
      }
    }
  }

  let data: unknown
  try {
    data = JSON.parse(rawText)
  } catch {
    return { ok: false, error: { code: 'ParseError', message: '不是合法 JSON' } }
  }

  if (format === 'archify-architecture') {
    if (!data || typeof data !== 'object' || (data as { diagram_type?: string }).diagram_type !== 'architecture') {
      return {
        ok: false,
        error: { code: 'TypeMismatch', message: '所选类型为 Archify architecture，但文件不是 architecture JSON' },
      }
    }
  }
  if (format === 'archify-workflow') {
    if (!isArchifyWorkflow(data)) {
      return {
        ok: false,
        error: { code: 'TypeMismatch', message: '所选类型为 Archify workflow，但文件不是 workflow JSON' },
      }
    }
  }
  if (format === 'editor-json') {
    const t = (data as { diagram_type?: string })?.diagram_type
    if (isArchifyWorkflow(data) || t === 'workflow') {
      return {
        ok: false,
        error: {
          code: 'TypeMismatch',
          message: '这是 Archify workflow，请改选「Archify workflow」或「自动识别」',
        },
      }
    }
    if (t !== 'flowchart' && t !== 'architecture') {
      return {
        ok: false,
        error: {
          code: 'TypeMismatch',
          message: '所选类型为本编辑器 JSON，需要 diagram_type 为 flowchart 或 architecture',
        },
      }
    }
  }

  const result = openDocument(data)
  if (!result.ok) return result

  if (format === 'archify-architecture' && !isArchitecture(result.diagram)) {
    return {
      ok: false,
      error: { code: 'TypeMismatch', message: '导入结果不是 architecture' },
    }
  }
  if (format === 'archify-workflow' && !isFlowchart(result.diagram)) {
    return {
      ok: false,
      error: { code: 'TypeMismatch', message: 'workflow 投影失败：结果不是 flowchart' },
    }
  }
  return result
}
