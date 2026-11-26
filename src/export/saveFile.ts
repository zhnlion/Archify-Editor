/**
 * 另存为工具：文件名规范化 + File System Access API（指定路径/命名）+ 降级下载。
 *
 * 浏览器安全模型下，网页不能静默写入任意路径。真正的「指定路径」只能通过
 * showSaveFilePicker 让用户确认；localhost / https 属于 secure context，Chrome/Edge 可用。
 * 不支持的浏览器降级为 a[download]，但仍可在另存为面板里改名。
 */

export type SaveMode = 'picker' | 'download'

/** 文件名非法字符（Windows 规则，兼顾其它平台与控制字符） */
const ILLEGAL_FILENAME = /[\\/:*?"<>|\x00-\x1F]/g

/**
 * 规范化另存为文件名：清理非法字符、压空格、去首尾空白与点、补扩展名。
 * 纯函数，便于单测。
 */
export function normalizeSaveName(input: string, ext: string): string {
  const dot = ext.startsWith('.') ? ext : `.${ext}`
  let name = input
    .trim()
    .replace(ILLEGAL_FILENAME, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()
  if (!name) name = 'diagram'
  // 已有同名扩展名时不重复追加（大小写不敏感）
  if (name.toLowerCase().endsWith(dot.toLowerCase())) return name
  return `${name}${dot}`
}

/** 取不含扩展名的主干，用于输入框自动选中 */
export function nameWithoutExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(0, i) : name
}

/** 取文件名的扩展名（含点），无扩展名时返回空串 */
export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i) : ''
}

/** 内容转 Blob（字符串按 mime 包装） */
export function toBlob(content: Blob | string, mime: string): Blob {
  return typeof content === 'string' ? new Blob([content], { type: mime }) : content
}

type WriteStream = {
  write(data: Blob | string): Promise<void>
  close(): Promise<void>
  abort?(): Promise<void>
}

export type SaveFileHandle = {
  name: string
  createWritable(): Promise<WriteStream>
}

type PickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string
    id?: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<SaveFileHandle>
}

/** 当前浏览器是否支持系统另存为对话框 */
export function canUseSavePicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showSaveFilePicker === 'function'
  )
}

/**
 * 打开系统另存为对话框（用户选路径 + 改名）。必须在用户手势内调用。
 * 返回 null 表示用户取消或浏览器不支持；其它错误向上抛出。
 */
export async function pickSaveFile(opts: {
  suggestedName: string
  mime: string
  description?: string
}): Promise<SaveFileHandle | null> {
  if (!canUseSavePicker()) return null
  const ext = extensionOf(opts.suggestedName)
  const types = ext
    ? [{ description: opts.description ?? '导出文件', accept: { [opts.mime]: [ext] } }]
    : undefined
  try {
    return await (window as PickerWindow).showSaveFilePicker!({
      suggestedName: opts.suggestedName,
      // 固定 id：浏览器可按此记住上次使用的目录
      id: 'archify-editor-export',
      ...(types ? { types } : {}),
    })
  } catch (err) {
    // AbortError = 用户主动取消，静默处理
    if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
      return null
    }
    throw err
  }
}

/** 降级：存入浏览器默认下载目录，文件名仍由用户指定 */
export function downloadWithName(name: string, content: Blob | string, mime: string): void {
  const blob = toBlob(content, mime)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
