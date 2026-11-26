import { describe, expect, it } from 'vitest'
import {
  canUseSavePicker,
  extensionOf,
  nameWithoutExtension,
  normalizeSaveName,
} from '../../../src/export/saveFile'

describe('normalizeSaveName', () => {
  it('补上缺失的扩展名', () => {
    expect(normalizeSaveName('我的流程图', '.json')).toBe('我的流程图.json')
    expect(normalizeSaveName('diagram', 'mmd')).toBe('diagram.mmd')
  })

  it('已有同名扩展名时不重复追加（大小写不敏感）', () => {
    expect(normalizeSaveName('flow.JSON', '.json')).toBe('flow.JSON')
    expect(normalizeSaveName('chart.svg', '.svg')).toBe('chart.svg')
  })

  it('清理 Windows 非法字符，避免另存为失败', () => {
    expect(normalizeSaveName('a/b:c*d?e"f<g>h|i', '.json')).toBe('a-b-c-d-e-f-g-h-i.json')
  })

  it('压缩多余空格并去掉首尾空白与点', () => {
    expect(normalizeSaveName('  我的  图...  ', '.mmd')).toBe('我的 图.mmd')
  })

  it('空文件名回退为 diagram', () => {
    expect(normalizeSaveName('   ', '.json')).toBe('diagram.json')
    expect(normalizeSaveName('...', '.json')).toBe('diagram.json')
  })
})

describe('文件名拆解', () => {
  it('nameWithoutExtension 取主干', () => {
    expect(nameWithoutExtension('flow.chart.json')).toBe('flow.chart')
    expect(nameWithoutExtension('noext')).toBe('noext')
    expect(nameWithoutExtension('.hidden')).toBe('.hidden')
  })

  it('extensionOf 取扩展名', () => {
    expect(extensionOf('flow.chart.json')).toBe('.json')
    expect(extensionOf('noext')).toBe('')
  })
})

describe('canUseSavePicker', () => {
  it('无 window 的环境（Node 单测）返回 false', () => {
    expect(canUseSavePicker()).toBe(false)
  })
})
