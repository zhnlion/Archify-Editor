import { spawn } from 'node:child_process'
import { accessSync, constants, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const pluginDir = dirname(fileURLToPath(import.meta.url))

function candidateBins(): string[] {
  const list: string[] = []
  if (process.env.ARCHIFY_BIN) list.push(process.env.ARCHIFY_BIN)
  // 仓库自包含：archify-editor/tools/archify
  list.push(join(pluginDir, '..', 'tools', 'archify', 'bin', 'archify.mjs'))
  // 兼容旧并列目录 dataplane/tools/archify
  list.push(join(pluginDir, '..', '..', 'archify', 'bin', 'archify.mjs'))
  list.push(join(homedir(), '.cursor', 'skills', 'archify', 'bin', 'archify.mjs'))
  return list
}

function archifyBin(): string | null {
  for (const candidate of candidateBins()) {
    try {
      accessSync(candidate, constants.R_OK)
      return candidate
    } catch {
      /* try next */
    }
  }
  return null
}

function readBody(req: IncomingMessage, maxBytes = 2_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c)
      size += buf.length
      if (size > maxBytes) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

type FinalizeKind = 'architecture' | 'workflow'
type Quality = 'showcase' | 'standard'

function detectFinalizeKind(diagram: unknown): FinalizeKind {
  if (diagram && typeof diagram === 'object' && (diagram as { diagram_type?: string }).diagram_type === 'workflow') {
    return 'workflow'
  }
  return 'architecture'
}

function detectQuality(diagram: unknown, explicit?: string): Quality {
  if (explicit === 'standard' || explicit === 'showcase') return explicit
  if (diagram && typeof diagram === 'object') {
    const q = (diagram as { meta?: { quality_profile?: string } }).meta?.quality_profile
    if (q === 'standard' || q === 'showcase') return q
  }
  return 'showcase'
}

function formatFinalizeFailure(kind: FinalizeKind, code: number | null, stdout: string, stderr: string): string {
  const text = stdout.trim() || stderr.trim()
  if (text.startsWith('{')) {
    try {
      const receipt = JSON.parse(text) as {
        failedStage?: string
        diagnostics?: Array<{ code?: string; message?: string }>
      }
      const lines = (receipt.diagnostics ?? []).slice(0, 8).map((d) => `${d.code ?? '?'}: ${d.message ?? ''}`)
      const head = `finalize ${kind} 失败（退出码 ${code ?? '?'}，阶段 ${receipt.failedStage ?? 'unknown'}）`
      if (lines.length) return `${head}\n${lines.join('\n')}`
      return head
    } catch {
      /* fall through */
    }
  }
  return stderr.trim() || stdout.trim() || `finalize ${kind} 退出码 ${code ?? '?'}`
}

function isDesktopReadabilityFailure(stdout: string): boolean {
  return stdout.includes('composition/desktop-readability')
}

function parseFinalizeReceipt(stdout: string): { failedStage?: string; diagnostics?: Array<{ code?: string }> } | null {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.trim().startsWith('{'))
  if (!line) return null
  try {
    return JSON.parse(line) as { failedStage?: string; diagnostics?: Array<{ code?: string }> }
  } catch {
    return null
  }
}

/** deliver 已出 HTML，仅卡在 browser-check（常见 viewport-overflow）时可软通过 */
function canSoftPassBrowserCheck(stdout: string): boolean {
  const receipt = parseFinalizeReceipt(stdout)
  if (receipt?.failedStage === 'browser-check') return true
  if (stdout.includes('viewer/viewport-overflow')) return true
  if (/failedStage"\s*:\s*"browser-check"/.test(stdout)) return true
  return false
}

async function tryReadHtml(outPath: string): Promise<string | null> {
  if (!existsSync(outPath)) return null
  try {
    const html = await readFile(outPath, 'utf8')
    if (html.length > 500 && (html.includes('<html') || html.includes('<svg') || html.includes('<!DOCTYPE'))) {
      return html
    }
  } catch {
    /* ignore */
  }
  return null
}

async function runFinalizeOnce(
  jsonText: string,
  outPath: string,
  bin: string,
  kind: FinalizeKind,
  quality: Quality,
): Promise<{ ok: true; html: string; soft?: boolean } | { ok: false; error: string; stdout: string }> {
  const dir = await mkdtemp(join(tmpdir(), 'archify-editor-'))
  const inFile = join(dir, 'diagram.json')
  await writeFile(inFile, jsonText, 'utf8')
  try {
    const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [bin, 'finalize', kind, inFile, outPath, '--quality', quality, '--json'],
        { windowsHide: true },
      )
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => {
        stdout += String(d)
      })
      child.stderr.on('data', (d) => {
        stderr += String(d)
      })
      child.on('error', reject)
      child.on('close', (code) => resolve({ code, stdout, stderr }))
    })
    if (result.code === 0) {
      return { ok: true, html: await readFile(outPath, 'utf8') }
    }
    // deliver 已写出 HTML；browser-check 视口溢出不阻断编辑器导出
    if (canSoftPassBrowserCheck(result.stdout)) {
      const html = await tryReadHtml(outPath)
      if (html) return { ok: true, html, soft: true }
    }
    return {
      ok: false,
      error: formatFinalizeFailure(kind, result.code, result.stdout, result.stderr),
      stdout: result.stdout,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * showcase 下 desktop-readability 为硬错误；宽 workflow 自动回退 standard 再试一次。
 */
async function runFinalize(
  jsonText: string,
  outPath: string,
  bin: string,
  kind: FinalizeKind,
  quality: Quality,
): Promise<{ html: string; soft?: boolean }> {
  const first = await runFinalizeOnce(jsonText, outPath, bin, kind, quality)
  if (first.ok) return { html: first.html, soft: first.soft }

  if (kind === 'workflow' && quality === 'showcase' && isDesktopReadabilityFailure(first.stdout)) {
    let adjusted = jsonText
    try {
      const doc = JSON.parse(jsonText) as { meta?: Record<string, unknown> }
      doc.meta = { ...(doc.meta ?? {}), quality_profile: 'standard' }
      adjusted = JSON.stringify(doc, null, 2)
    } catch {
      adjusted = jsonText
    }
    const second = await runFinalizeOnce(adjusted, outPath, bin, kind, 'standard')
    if (second.ok) return { html: second.html, soft: second.soft }
    throw new Error(
      `${first.error}\n—— 已自动用 --quality standard 重试仍失败 ——\n${second.error}`,
    )
  }

  throw new Error(first.error)
}

function handler() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? ''
    if (url === '/api/finalize/status' && req.method === 'GET') {
      const bin = archifyBin()
      sendJson(res, 200, { available: Boolean(bin), bin })
      return
    }
    if (url !== '/api/finalize' || req.method !== 'POST') {
      next()
      return
    }
    const bin = archifyBin()
    if (!bin) {
      sendJson(res, 503, {
        ok: false,
        error: '未找到 Archify CLI。请确认 tools/archify 已归档，或设置 ARCHIFY_BIN。',
      })
      return
    }
    try {
      const raw = await readBody(req)
      const payload = JSON.parse(raw) as { diagram?: unknown; quality?: string }
      if (!payload.diagram) {
        sendJson(res, 400, { ok: false, error: '缺少 diagram' })
        return
      }
      const kind = detectFinalizeKind(payload.diagram)
      const quality = detectQuality(payload.diagram, payload.quality)
      const outFile = join(tmpdir(), `archify-out-${Date.now()}.html`)
      try {
        const result = await runFinalize(JSON.stringify(payload.diagram, null, 2), outFile, bin, kind, quality)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${kind}.html"`)
        if (result.soft) res.setHeader('X-Archify-Soft-Pass', 'browser-check')
        res.end(result.html)
      } finally {
        await rm(outFile, { force: true })
      }
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}

export function finalizePlugin(): Plugin {
  return {
    name: 'archify-finalize-bridge',
    configureServer(server) {
      server.middlewares.use(handler())
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler())
    },
  }
}
