import { describe, expect, it } from 'vitest'
import { importMermaidFlowchart } from '../../../src/import/mermaidImport'
import { fixtureText } from '../../helpers/fixtures'

describe('Mermaid flowchart full-shape import', () => {
  it('keeps inline definitions, shape variants, chains and parallel targets', () => {
    const doc = importMermaidFlowchart(fixtureText('complexMermaid'))

    expect(doc.nodes).toHaveLength(13)
    expect(doc.edges).toHaveLength(14)
    expect(doc.meta.title).toBe('Mermaid Missing Shapes Test')
    expect(Object.fromEntries(doc.nodes.map((n) => [n.id, n.shape]))).toMatchObject({
      start: 'start',
      parse: 'process',
      decide: 'decision',
      check: 'connector',
      reject: 'offpage',
      store: 'database',
      notify: 'subprocess',
      prep: 'preparation',
      data: 'data',
      done: 'start',
    })
    expect(doc.nodes.find((n) => n.id === 'parse')?.label).toBe('Parse header')
    expect(doc.edges.filter((e) => e.from === 'fanout').map((e) => e.to).sort()).toEqual([
      'left',
      'right',
    ])
    expect(doc.edges.some((e) => e.label === 'yes')).toBe(true)
    expect(doc.edges.some((e) => e.label === 'no')).toBe(true)
  })

  it('converts <br> in node labels into newlines', () => {
    const doc = importMermaidFlowchart(
      'flowchart TD\nA["第一行<br/>第二行<br>第三行"] --> B{判断节点}',
    )
    expect(doc.nodes.find((n) => n.id === 'A')?.label).toBe('第一行\n第二行\n第三行')
    expect(doc.nodes.find((n) => n.id === 'B')?.label).toBe('判断节点')
    // 多行 <br> 节点导入后框高自动撑开，保证文字完整显示
    expect(doc.nodes.find((n) => n.id === 'A')!.size[1]).toBeGreaterThan(56)
  })

  it('parses semicolon-separated flowchart statements', () => {
    const doc = importMermaidFlowchart(
      'flowchart TD; A[Start] --> B{OK}; B -- yes --> C((End)); C --> D & E',
    )
    expect(doc.nodes.map((n) => n.id).sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(doc.nodes.find((n) => n.id === 'B')?.shape).toBe('decision')
    expect(doc.nodes.find((n) => n.id === 'C')?.shape).toBe('connector')
    expect(doc.edges).toHaveLength(4)
  })
})
