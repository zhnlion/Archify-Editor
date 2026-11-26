import { describe, expect, it } from 'vitest'
import { beautifyDiagram, boundaryFrames, componentGapsTooTight } from '../../../src/domain/beautify'
import { ARCHIFY_GAP_X, ARCHIFY_GAP_Y, boundaryRect } from '../../../src/domain/geom'
import type { ArchifyDiagram } from '../../../src/types'
import { ensureSize } from '../../../src/domain/document'

function arch(partial: Partial<ArchifyDiagram> = {}): ArchifyDiagram {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: '叠框', output: 'a.html', locale: 'zh-CN' },
    components: [
      { id: 'a', type: 'frontend', label: 'A', pos: [0, 0], size: [120, 60] },
      { id: 'b', type: 'backend', label: 'B', pos: [10, 10], size: [120, 60] },
      { id: 'c', type: 'database', label: 'C', pos: [20, 20], size: [120, 60] },
    ],
    boundaries: [
      { kind: 'region', label: '内层', wraps: ['a', 'b'], pad: 16 },
      { kind: 'region', label: '外层', wraps: ['a', 'b', 'c'], pad: 16 },
    ],
    ...partial,
  }
}

describe('beautify like Archify HTML', () => {
  it('opens a gap between components that are not nested', () => {
    const laid = beautifyDiagram(arch())
    if (laid.diagram_type !== 'architecture') throw new Error('type')
    expect(componentGapsTooTight(laid.components)).toBe(false)
    const [a, b] = laid.components
    const aw = ensureSize(a.size)[0]
    const ah = ensureSize(a.size)[1]
    const separated =
      a.pos![0] + aw + ARCHIFY_GAP_X <= b.pos![0] ||
      b.pos![0] + ensureSize(b.size)[0] + ARCHIFY_GAP_X <= a.pos![0] ||
      a.pos![1] + ah + ARCHIFY_GAP_Y <= b.pos![1] ||
      b.pos![1] + ensureSize(b.size)[1] + ARCHIFY_GAP_Y <= a.pos![1]
    expect(separated).toBe(true)
  })

  it('keeps the outer boundary frame strictly outside the inner one', () => {
    const laid = beautifyDiagram(arch())
    if (laid.diagram_type !== 'architecture') throw new Error('type')
    const boxes = laid.components.map((component) => ({
      id: component.id,
      pos: component.pos!,
      size: ensureSize(component.size),
    }))
    const inner = laid.boundaries!.find((boundary) => boundary.label === '内层')!
    const outer = laid.boundaries!.find((boundary) => boundary.label === '外层')!
    expect(outer.pad!).toBeGreaterThan(inner.pad!)
    const innerFrame = boundaryRect(inner.wraps, boxes, inner.pad)
    const outerFrame = boundaryRect(outer.wraps, boxes, outer.pad)
    expect(innerFrame && outerFrame).toBeTruthy()
    expect(outerFrame!.x).toBeLessThan(innerFrame!.x)
    expect(outerFrame!.y).toBeLessThan(innerFrame!.y)
    expect(outerFrame!.x + outerFrame!.w).toBeGreaterThan(innerFrame!.x + innerFrame!.w)
    expect(outerFrame!.y + outerFrame!.h).toBeGreaterThanOrEqual(innerFrame!.y + innerFrame!.h)
    expect(boundaryFrames(laid).length).toBe(2)
  })
})
