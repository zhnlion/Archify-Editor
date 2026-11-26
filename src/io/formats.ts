import type { DiagramType } from '../types'

export type ImportFormatId =
  | 'auto'
  | 'editor-json'
  | 'archify-architecture'
  | 'archify-workflow'
  | 'mermaid'
  | 'drawio'
  | 'paste-json'
  | 'paste-mermaid'

export type ExportFormatId =
  | 'editor-json'
  | 'archify-json'
  | 'html'
  | 'mermaid'
  | 'svg'
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'drawio'

export type FormatItem<Id extends string> = {
  id: Id
  label: string
  hint?: string
  /** 文件选择 accept；粘贴类为空 */
  accept?: string
  /** 是否打开文件选择器（否则走粘贴等） */
  pickFile?: boolean
  enabled: boolean
  /** 灰显原因 */
  disabledReason?: string
}

export const IMPORT_FORMATS: FormatItem<ImportFormatId>[] = [
  {
    id: 'auto',
    label: '自动识别',
    hint: 'JSON / workflow / draw.io',
    accept: 'application/json,.json,.drawio,.xml,text/xml',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'editor-json',
    label: '本编辑器 JSON',
    hint: 'flowchart / architecture',
    accept: 'application/json,.json',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'archify-architecture',
    label: 'Archify architecture',
    hint: 'diagram_type: architecture',
    accept: 'application/json,.json',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'archify-workflow',
    label: 'Archify workflow',
    hint: '投影为 flowchart',
    accept: 'application/json,.json',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'mermaid',
    label: 'Mermaid',
    hint: 'flowchart / C4 / architecture-beta',
    accept: '.mmd,.md,.txt,text/plain',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'drawio',
    label: 'draw.io',
    hint: '.drawio / .xml',
    accept: '.drawio,.xml,text/xml',
    pickFile: true,
    enabled: true,
  },
  {
    id: 'paste-json',
    label: '粘贴 JSON…',
    hint: '从剪贴板粘贴',
    pickFile: false,
    enabled: true,
  },
  {
    id: 'paste-mermaid',
    label: '粘贴 Mermaid…',
    hint: 'flowchart / C4 / architecture-beta',
    pickFile: false,
    enabled: true,
  },
]

export function exportFormatsFor(diagramType: DiagramType): FormatItem<ExportFormatId>[] {
  const isFlow = diagramType === 'flowchart'
  return [
    {
      id: 'editor-json',
      label: '本编辑器 JSON',
      hint: '含 meta.editor，可完整再打开',
      enabled: true,
    },
    {
      id: 'archify-json',
      label: isFlow ? 'Archify workflow JSON' : 'Archify architecture JSON',
      hint: isFlow ? '供 finalize workflow' : '剥离私有字段，可供 CLI',
      enabled: true,
    },
    {
      id: 'html',
      label: 'Archify HTML',
      hint: 'finalize 精美交付',
      enabled: true,
    },
    {
      id: 'mermaid',
      label: 'Mermaid (.mmd)',
      hint: isFlow ? 'flowchart TD' : '有损：组件+连线',
      enabled: true,
    },
    {
      id: 'svg',
      label: 'SVG 矢量图',
      hint: '画布快照',
      enabled: true,
    },
    {
      id: 'png',
      label: 'PNG 图片',
      hint: '按内容裁切 · 2x',
      enabled: true,
    },
    {
      id: 'jpeg',
      label: 'JPEG 图片',
      hint: '按内容裁切 · 2x',
      enabled: true,
    },
    {
      id: 'webp',
      label: 'WebP 图片',
      hint: '按内容裁切 · 2x',
      enabled: true,
    },
    {
      id: 'drawio',
      label: 'draw.io',
      hint: '矩形 / 菱形 / 边 / 填色',
      enabled: true,
    },
  ]
}
