export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export type FinalizeKind = 'architecture' | 'workflow'

/** 复制到终端的命令模板：优先指向仓库内 tools/archify */
export function finalizeCommandTemplate(kind: FinalizeKind = 'architecture'): string {
  const win =
    kind === 'workflow'
      ? 'node "%CD%\\tools\\archify\\bin\\archify.mjs" finalize workflow <your.workflow.json> <out.html> --quality showcase --json'
      : 'node "%CD%\\tools\\archify\\bin\\archify.mjs" finalize architecture <your.json> <out.html> --quality showcase --json'
  const unix =
    kind === 'workflow'
      ? 'node ./tools/archify/bin/archify.mjs finalize workflow ./diagram.workflow.json ./out.html --quality showcase --json'
      : 'node ./tools/archify/bin/archify.mjs finalize architecture ./diagram.architecture.json ./out.html --quality showcase --json'
  return navigator.platform.toLowerCase().includes('win') ? win : unix
}

export async function finalizeHtml(
  diagram: unknown,
  opts?: { quality?: 'showcase' | 'standard' },
): Promise<{ html?: string; error?: string; soft?: boolean }> {
  try {
    const res = await fetch('/api/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diagram, quality: opts?.quality }),
    })
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/html')) {
      if (!res.ok) return { error: `finalize HTTP ${res.status}` }
      return {
        html: await res.text(),
        soft: res.headers.get('X-Archify-Soft-Pass') === 'browser-check',
      }
    }
    const body = (await res.json()) as { error?: string }
    return { error: body.error || `finalize HTTP ${res.status}` }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '无法连接 Finalize 服务（静态托管下请用 CLI 兜底）' }
  }
}
