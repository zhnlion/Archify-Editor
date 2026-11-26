/** 从画布 SVG 导出矢量 / 位图快照（按内容裁切，避免整张空白世界坐标） */

export type RasterFormat = 'png' | 'jpeg' | 'webp'

const MIME: Record<RasterFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/** JPEG 不支持透明；WebP/PNG 也铺底以免透出棋盘格。非 #hex 时回落白色。 */
export function opaqueRasterFill(cssBg: string, format: RasterFormat): string {
  const raw = (cssBg || '').trim()
  if (format === 'jpeg') {
    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw.length === 4 || raw.length === 5 ? expandShortHex(raw) : raw.slice(0, 7)
    if (/^rgb(a)?\(/i.test(raw)) return rgbToHexOrWhite(raw)
    return '#ffffff'
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw
  if (/^rgb(a)?\(/i.test(raw)) return rgbToHexOrWhite(raw, raw)
  return raw || '#0f1419'
}

function expandShortHex(h: string): string {
  const s = h.slice(1)
  if (s.length === 3 || s.length === 4) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`
  }
  return h
}

function rgbToHexOrWhite(rgb: string, fallback = '#ffffff'): string {
  const m = rgb.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (!m) return fallback
  const r = Math.round(Number(m[1]))
  const g = Math.round(Number(m[2]))
  const b = Math.round(Number(m[3]))
  if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) return fallback
  const hex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/** JPEG/WebP 质量；PNG 忽略。钳制到浏览器合理区间。 */
export function rasterQuality(format: RasterFormat, quality = 0.92): number | undefined {
  if (format === 'png') return undefined
  return Math.min(1, Math.max(0.5, quality))
}

/** 导出缩放：默认 2×；限制最长边，避免超大 canvas 失败。 */
export function clampRasterScale(
  contentW: number,
  contentH: number,
  scale = 2,
  maxEdge = 8192,
): number {
  const s = Math.min(4, Math.max(1, scale))
  const longest = Math.max(contentW, contentH, 1)
  if (longest * s <= maxEdge) return s
  return Math.max(1, Math.floor((maxEdge / longest) * 1000) / 1000)
}

export function padBox(
  box: { x: number; y: number; w: number; h: number },
  pad = 40,
): { x: number; y: number; w: number; h: number } {
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 }
}

function contentViewBox(svg: SVGSVGElement): { x: number; y: number; w: number; h: number } {
  const ctm = svg.getScreenCTM()
  const els = svg.querySelectorAll('g.node, g.edge, g.boundary, g.layer-band, g.standalone-line')
  if (!ctm || !els.length) return { x: 0, y: 0, w: 960, h: 640 }
  const inv = ctm.inverse()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width < 1 && r.height < 1) continue
    const corners: Array<[number, number]> = [
      [r.left, r.top],
      [r.right, r.top],
      [r.right, r.bottom],
      [r.left, r.bottom],
    ]
    for (const [sx, sy] of corners) {
      const p = svg.createSVGPoint()
      p.x = sx
      p.y = sy
      const local = p.matrixTransform(inv)
      minX = Math.min(minX, local.x)
      minY = Math.min(minY, local.y)
      maxX = Math.max(maxX, local.x)
      maxY = Math.max(maxY, local.y)
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 960, h: 640 }
  return padBox({ x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) })
}

function cloneCanvasSvg(): SVGSVGElement {
  const svg = document.querySelector('svg.canvas-svg') as SVGSVGElement | null
  if (!svg) throw new Error('未找到画布 SVG')
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.querySelectorAll('.handle, .node-port, .edge-via-handle, .edge-seg-handle, .selection-marquee, .link-preview, .draw-preview, .line-point-handle, .lane-handle').forEach((el) =>
    el.remove(),
  )
  const box = contentViewBox(svg)
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
  clone.setAttribute('width', String(Math.round(box.w)))
  clone.setAttribute('height', String(Math.round(box.h)))
  const cs = getComputedStyle(document.documentElement)
  const bg = cs.getPropertyValue('--canvas-bg').trim() || '#0f1419'
  const text = cs.getPropertyValue('--text').trim() || '#e7eef6'
  const muted = cs.getPropertyValue('--muted').trim() || '#8b9aab'
  const diagramFont =
    cs.getPropertyValue('--diagram-font').trim() ||
    '"Times New Roman", Times, "Noto Serif", "Songti SC", "SimSun", "Noto Serif CJK SC", serif'
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `
    text { font-family: ${diagramFont}; fill: ${text}; }
    .boundary text, .layer-band text { fill: ${muted}; }
    .sub { opacity: 0.75; }
  `
  clone.insertBefore(style, clone.firstChild)
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('x', String(box.x))
  bgRect.setAttribute('y', String(box.y))
  bgRect.setAttribute('width', String(box.w))
  bgRect.setAttribute('height', String(box.h))
  bgRect.setAttribute('fill', bg)
  clone.insertBefore(bgRect, clone.firstChild)
  return clone
}

export function exportCanvasSvg(): string {
  const clone = cloneCanvasSvg()
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

export async function exportCanvasImage(
  format: RasterFormat = 'png',
  scale = 2,
  opts?: { quality?: number },
): Promise<Blob> {
  const svgText = exportCanvasSvg()
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  const contentW = Math.max(1, Number(root.getAttribute('width') || 960))
  const contentH = Math.max(1, Number(root.getAttribute('height') || 640))
  const effectiveScale = clampRasterScale(contentW, contentH, scale)
  const w = Math.max(1, Math.round(contentW * effectiveScale))
  const h = Math.max(1, Math.round(contentH * effectiveScale))
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('SVG 栅格化失败'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 canvas')
    const cssBg =
      getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim() || '#0f1419'
    ctx.fillStyle = opaqueRasterFill(cssBg, format)
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const mime = MIME[format]
    const quality = rasterQuality(format, opts?.quality ?? 0.92)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`${format.toUpperCase()} 编码失败（浏览器可能不支持）`))),
        mime,
        quality,
      )
    })
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** @deprecated 使用 exportCanvasImage('png', scale) */
export function exportCanvasPng(scale = 2): Promise<Blob> {
  return exportCanvasImage('png', scale)
}

export function downloadBlob(filename: string, blob: Blob) {
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
