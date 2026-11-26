import type { AnyDiagram, DiagramType, FormatHints } from '../types'

/** 导入嗅探结果 */
export type ImportRoute =
  | { kind: 'native'; diagramType: DiagramType }
  | { kind: 'archify-architecture' }
  | { kind: 'archify-workflow' }
  | { kind: 'mermaid'; suggested: DiagramType }
  | { kind: 'drawio'; suggested: DiagramType }
  | { kind: 'unknown'; reason: string }

export type EditorErrorCode =
  | 'ParseError'
  | 'ValidateError'
  | 'BridgeError'
  | 'LossyImportWarning'
  | 'TypeMismatch'
  | 'UnsupportedFormat'

export interface EditorError {
  code: EditorErrorCode
  message: string
  details?: string[]
}

export interface LossyReport {
  dropped: string[]
  notes?: string[]
}

export interface ParseSuccess {
  ok: true
  diagram: AnyDiagram
  format_hints: FormatHints
  lossy?: LossyReport
  warnings?: EditorError[]
}

export interface ParseFailure {
  ok: false
  error: EditorError
}

export type ParseResult = ParseSuccess | ParseFailure

/**
 * 可插拔 Codec 契约（Σ）。
 * detect → 路由；parse → IR；encode → 字节/文本。
 */
export interface DiagramCodec {
  readonly id: 'native' | 'archify-workflow' | 'mermaid' | 'drawio' | string
  detect(input: string, fileName?: string): ImportRoute | null
  parse(input: string, fileName?: string): ParseResult
  encode?(diagram: AnyDiagram): { text: string; mime: string; lossy?: LossyReport }
}
