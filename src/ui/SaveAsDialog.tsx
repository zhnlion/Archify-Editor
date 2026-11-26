import { useEffect, useRef, useState } from 'react'
import {
  canUseSavePicker,
  downloadWithName,
  extensionOf,
  nameWithoutExtension,
  normalizeSaveName,
  pickSaveFile,
  toBlob,
} from '../export/saveFile'

export type SaveAsRequest = {
  /** 默认文件名（含扩展名），由各导出格式生成 */
  suggestedName: string
  /** 待写入内容 */
  content: string | Blob
  /** MIME 类型，决定系统保存对话框的文件类型过滤 */
  mime: string
  /** 文件类型描述，如「编辑器 JSON」 */
  description?: string
}

type Props = {
  request: SaveAsRequest | null
  onClose: () => void
  onSaved: (message: string) => void
}

/**
 * 另存为面板：导出时先弹出，让用户改名并选择保存方式。
 * - 支持 File System Access API：可在系统对话框指定路径并命名；
 * - 不支持时降级为 a[download]，但文件名仍以用户输入为准。
 */
export function SaveAsDialog({ request, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!request) return
    setName(request.suggestedName)
    setSaving(false)
    const t = window.setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const stemLength = nameWithoutExtension(request.suggestedName).length
      el.setSelectionRange(0, stemLength)
    }, 0)
    return () => window.clearTimeout(t)
  }, [request])

  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, onClose])

  if (!request) return null

  const ext = extensionOf(request.suggestedName)
  const finalName = () => normalizeSaveName(name, ext)
  const pickerSupported = canUseSavePicker()

  const saveToPicker = async () => {
    setSaving(true)
    try {
      const handle = await pickSaveFile({
        suggestedName: finalName(),
        mime: request.mime,
        description: request.description,
      })
      if (!handle) {
        setSaving(false)
        return // 用户在系统对话框取消
      }
      const writable = await handle.createWritable()
      await writable.write(toBlob(request.content, request.mime))
      await writable.close()
      onSaved(`已保存到 ${handle.name}`)
    } catch (err) {
      setSaving(false)
      onSaved(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const saveToDownload = () => {
    const savedName = finalName()
    downloadWithName(savedName, request.content, request.mime)
    onSaved(`已下载 ${savedName}`)
  }

  return (
    <div
      className="shortcuts-overlay save-as-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="另存为"
      onClick={() => !saving && onClose()}
    >
      <div className="shortcuts-panel save-as-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <strong>另存为</strong>
          <button type="button" disabled={saving} onClick={onClose}>
            取消
          </button>
        </div>
        <label className="save-as-label" htmlFor="save-as-name">
          文件名
        </label>
        <input
          id="save-as-name"
          ref={inputRef}
          className="save-as-input"
          value={name}
          spellCheck={false}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (pickerSupported) void saveToPicker()
              else saveToDownload()
            }
          }}
        />
        <p className="hint save-as-hint">
          {pickerSupported
            ? '点「选择位置」在系统对话框里指定保存路径与文件名；点「直接下载」存入浏览器默认下载目录。'
            : '当前浏览器不支持选择保存路径，将按上面填写的文件名下载到浏览器默认目录。Chrome / Edge 可选择路径。'}
        </p>
        <div className="save-as-actions">
          {pickerSupported ? (
            <button type="button" className="primary" disabled={saving} onClick={() => void saveToPicker()}>
              {saving ? '保存中…' : '选择位置并保存'}
            </button>
          ) : null}
          <button type="button" disabled={saving} onClick={saveToDownload}>
            直接下载
          </button>
        </div>
      </div>
    </div>
  )
}
