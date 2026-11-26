/**
 * 节点文字换行工具。
 *
 * SVG <text> 没有原生自动折行；这里按可用宽度估算文字宽度并把长行拆成多行，
 * 让导入 / 编辑的主题文字在节点框内像亿图一样自动换行、完整显示。
 * 纯函数、不依赖 DOM 测量，便于单测与快照导出复用。
 */

/** 常见全角 / CJK 区段：按 1em 估算宽度。 */
const FULL_WIDTH_RE =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/

/** 不允许出现在折行后行首的标点（中文 + 英文）。 */
const NO_LINE_START_RE = /[，。！？、；：）》」』】〉,.!?;:)\]}]/

/** 英文「单词」字符：连续出现时作为一个整体，避免把词从中间截断。 */
const WORD_CHAR_RE = /[A-Za-z0-9._@/\-]/

/** 估算单个字符宽度（相对 fontSize 的 em 数）。 */
export function measureCharWidth(ch: string, fontSize: number): number {
  if (FULL_WIDTH_RE.test(ch)) return fontSize
  if (ch === ' ') return fontSize * 0.3
  if (ch === '\t') return fontSize * 1.2
  if (ch >= '0' && ch <= '9') return fontSize * 0.56
  if (ch >= 'A' && ch <= 'Z') return fontSize * 0.64
  if (ch >= 'a' && ch <= 'z') return fontSize * 0.54
  return fontSize * 0.5
}

/** 估算整段文字宽度。 */
export function measureTextWidth(text: string, fontSize: number): number {
  let width = 0
  for (const ch of text) width += measureCharWidth(ch, fontSize)
  return width
}

/** 把文本切成「英文单词 / 单个其它字符」的词元序列。 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  let word = ''
  for (const ch of text) {
    if (WORD_CHAR_RE.test(ch)) {
      word += ch
    } else {
      if (word) {
        tokens.push(word)
        word = ''
      }
      tokens.push(ch)
    }
  }
  if (word) tokens.push(word)
  return tokens
}

/** 把一个超长词元按字符硬拆成若干不超过 maxWidth 的片段。 */
function hardSplit(token: string, maxWidth: number, fontSize: number): string[] {
  const parts: string[] = []
  let buf = ''
  let width = 0
  for (const ch of token) {
    const cw = measureCharWidth(ch, fontSize)
    if (buf && width + cw > maxWidth) {
      parts.push(buf)
      buf = ''
      width = 0
    }
    buf += ch
    width += cw
  }
  if (buf) parts.push(buf)
  return parts
}

/**
 * 把单行文本按 maxWidth 折成多行。
 * - 中英文混排：英文单词整体保留，中文逐字折行
 * - 标点不孤零零落在下一行行首
 * - 单个词元就超宽时按字符硬拆
 */
export function wrapLine(text: string, maxWidth: number, fontSize: number): string[] {
  if (!text) return ['']
  if (maxWidth <= 0 || measureTextWidth(text, fontSize) <= maxWidth) return [text]

  const tokens = tokenize(text)
  const lines: string[] = []
  let line = ''
  let width = 0

  for (const token of tokens) {
    const tokenWidth = measureTextWidth(token, fontSize)

    if (line && width + tokenWidth > maxWidth) {
      // 标点跟随上一行，允许轻微超宽，避免行首悬空标点
      if (NO_LINE_START_RE.test(token)) {
        line += token
        width += tokenWidth
        continue
      }
      lines.push(line.trimEnd())
      line = ''
      width = 0
    }

    // 换行后行首的空格没有意义，丢弃
    if (!line && token === ' ') continue

    if (tokenWidth > maxWidth) {
      const parts = hardSplit(token, maxWidth, fontSize)
      lines.push(...parts.slice(0, -1))
      line = parts.at(-1) ?? ''
      width = measureTextWidth(line, fontSize)
    } else {
      line += token
      width += tokenWidth
    }
  }
  if (line) lines.push(line.trimEnd())
  return lines.length ? lines : ['']
}

/**
 * 折一段（可能已含 \n 的）文字：先按已有换行拆分，再对每行按宽度折行。
 */
export function wrapLabelText(text: string, maxWidth: number, fontSize: number): string[] {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .flatMap((line) => wrapLine(line, maxWidth, fontSize))
}

/** 节点内文字左右各留 8px 内边距后的可用宽度。 */
export function nodeTextMaxWidth(nodeWidth: number): number {
  return Math.max(24, nodeWidth - 16)
}

/** 与画布 MultilineNodeLabel 一致的行高计算，渲染与尺寸自适应共用。 */
export function nodeLabelLineLayout(
  label: string,
  sublabel: string | undefined,
  w: number,
  fontSize: number,
  subFontSize: number,
) {
  const maxWidth = nodeTextMaxWidth(w)
  const parts = String(label ?? '').replace(/\r\n/g, '\n').split('\n')
  const titleLines = wrapLabelText(parts[0] ?? '', maxWidth, fontSize)
  const subLines = [
    ...parts.slice(1).flatMap((line) => wrapLabelText(line, maxWidth, subFontSize)),
    ...(sublabel ? wrapLabelText(sublabel, maxWidth, subFontSize) : []),
  ]
  const titleLineHeight = fontSize * 1.25
  const subLineHeight = Math.max(subFontSize * 1.35, 12)
  const totalHeight = titleLines.length * titleLineHeight + subLines.length * subLineHeight
  return { titleLines, subLines, titleLineHeight, subLineHeight, totalHeight }
}

export type TextHAlign = 'left' | 'center' | 'right'
export type TextVAlign = 'top' | 'middle' | 'bottom'

/**
 * 计算多行文字块在节点框内的落点：水平锚点（SVG textAnchor + x）与纵向起始 Y。
 * 纯函数，渲染与一般化复用；缺省 center/middle 保持原有居中效果。
 *
 * - totalHeight 为整块文字（标题行 + 副标题行）的总高度；
 * - 水平 left/right 时留 NORMAL_PAD 内边距，middle 时 x = w/2 且 anchor=middle；
 * - 垂直 top/bottom 时留 NORMAL_PAD 内边距，middle 时垂直居中。
 */
export function labelTextBlockPlacement(
  hAlign: TextHAlign | undefined,
  vAlign: TextVAlign | undefined,
  w: number,
  h: number,
  totalHeight: number,
  pad = 8,
): { x: number; textAnchor: 'start' | 'middle' | 'end'; top: number } {
  const ha = hAlign ?? 'center'
  const va = vAlign ?? 'middle'
  const x = ha === 'left' ? pad : ha === 'right' ? w - pad : w / 2
  const textAnchor = ha === 'left' ? 'start' : ha === 'right' ? 'end' : 'middle'
  const top =
    va === 'top' ? pad : va === 'bottom' ? Math.max(pad, h - totalHeight - pad) : (h - totalHeight) / 2
  return { x, textAnchor, top }
}

/**
 * 让节点框高度至少容纳折行后的全部文字（只增高、不缩小），实现亿图式「字多框长高」。
 * 宽度保持不变，超长文字通过折行消化。
 */
export function fitSizeToLabel(
  size: [number, number],
  label: string,
  sublabel: string | undefined,
  fontSize: number,
  subFontSize: number,
  minHeight = 56,
): [number, number] {
  const [w, h] = size
  const { totalHeight } = nodeLabelLineLayout(label, sublabel, w, fontSize, subFontSize)
  const needed = Math.ceil(totalHeight + 16)
  return [w, Math.max(minHeight, h, needed)]
}
