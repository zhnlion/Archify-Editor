import { describe, expect, it } from 'vitest'
import {
  fitSizeToLabel,
  labelTextBlockPlacement,
  measureTextWidth,
  nodeTextMaxWidth,
  wrapLabelText,
  wrapLine,
} from '../../../src/domain/textWrap'

describe('textWrap 节点文字换行', () => {
  it('短文本不折行', () => {
    expect(wrapLine('解析头', 120, 13)).toEqual(['解析头'])
    expect(wrapLine('API Gateway', 120, 13)).toEqual(['API Gateway'])
  })

  it('中文长句按框宽折成多行', () => {
    const lines = wrapLine('用户请求经过网关鉴权后转发到后端服务集群', 78, 13)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('用户请求经过网关鉴权后转发到后端服务集群')
    for (const line of lines) expect(measureTextWidth(line, 13)).toBeLessThanOrEqual(78 + 13)
  })

  it('英文单词不被从中间截断', () => {
    const lines = wrapLine('parse header payload', 70, 13)
    expect(lines).toContain('payload')
    expect(lines.join(' ')).toBe('parse header payload')
  })

  it('单个超长词元按字符硬拆', () => {
    const lines = wrapLine('ABCDEFGHIJKLMN', 30, 13)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('ABCDEFGHIJKLMN')
  })

  it('标点不落在折行行首', () => {
    const lines = wrapLine('这是一段很长很长的文字，需要换行处理。', 78, 13)
    for (const line of lines.slice(1)) {
      expect(/^[，。！？、；：）\]}]/.test(line)).toBe(false)
    }
  })

  it('保留已有 \\n 并对每行继续按宽度折行', () => {
    const lines = wrapLabelText('第一行\n第二行也是一个比较长的标题需要折行', 78, 13)
    expect(lines[0]).toBe('第一行')
    expect(lines.length).toBeGreaterThan(2)
    expect(lines.join('')).toContain('第二行')
  })

  it('节点可用宽度扣除左右内边距', () => {
    expect(nodeTextMaxWidth(150)).toBe(134)
    expect(nodeTextMaxWidth(8)).toBe(24)
  })

  it('长文字折行后框高自动增高，宽度不变', () => {
    const size = fitSizeToLabel(
      [150, 56],
      '用户请求经过网关鉴权后转发至后端服务集群继续处理\n第二行说明文字',
      undefined,
      13,
      11,
      56,
    )
    expect(size[0]).toBe(150)
    expect(size[1]).toBeGreaterThan(56)
  })

  it('短文字不改动框高（只增高不缩小）', () => {
    expect(fitSizeToLabel([150, 56], '收包', undefined, 13, 11, 56)).toEqual([150, 56])
    expect(fitSizeToLabel([120, 72], '短', undefined, 13, 11, 72)).toEqual([120, 72])
  })
})

describe('labelTextBlockPlacement 文字位置', () => {
  it('缺省居中，保持原渲染行为', () => {
    const p = labelTextBlockPlacement(undefined, undefined, 150, 80, 20)
    expect(p).toEqual({ x: 75, textAnchor: 'middle', top: 30 })
  })

  it('左上角：x 与 top 各留内边距，锚点 start', () => {
    const p = labelTextBlockPlacement('left', 'top', 150, 80, 20)
    expect(p).toEqual({ x: 8, textAnchor: 'start', top: 8 })
  })

  it('右下角：x 靠右、锚点 end，top 贴底', () => {
    const p = labelTextBlockPlacement('right', 'bottom', 150, 80, 20)
    expect(p).toEqual({ x: 142, textAnchor: 'end', top: 52 })
  })

  it('纵向 top/bottom 在文字高于框时不翻转（top 不小于内边距）', () => {
    const p = labelTextBlockPlacement('left', 'bottom', 100, 20, 60)
    expect(p.top).toBe(8)
  })
})
