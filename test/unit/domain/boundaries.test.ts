import { describe, expect, it } from 'vitest'
import type { ArchifyDiagram } from '../../../src/types'
import { enrichArchitectureBoundaries, migrateBoundaryExtras } from '../../../src/domain/boundaries'
import { BOUNDARY_PAD_MAX, boundaryRect } from '../../../src/domain/geom'

describe('migrateBoundaryExtras', () => {
  it('keeps padBottom and folds into padY / pad', () => {
    const out = migrateBoundaryExtras({
      kind: 'region',
      label: 'x',
      wraps: ['a'],
      padBottom: 24,
    } as Parameters<typeof migrateBoundaryExtras>[0])
    expect(out.padBottom).toBe(24)
    expect(out.padY).toBe(24)
    expect(out.pad).toBe(24)
  })

  it('keeps asymmetric padLeft/padRight', () => {
    const out = migrateBoundaryExtras({
      kind: 'region',
      label: 'x',
      wraps: ['a'],
      padLeft: 10,
      padRight: 30,
    } as Parameters<typeof migrateBoundaryExtras>[0])
    expect(out.padLeft).toBe(10)
    expect(out.padRight).toBe(30)
    expect(out.padX).toBe(30)
    expect(out.pad).toBeGreaterThanOrEqual(30)
  })
})

describe('enrichArchitectureBoundaries', () => {
  it('shrinks sibling pads so 业务插件 and 基础设施底座 do not cross', () => {
    const doc: ArchifyDiagram = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 't', output: 't.html' },
      components: [
        { id: 'a', type: 'security', label: 'A', pos: [100, 100], size: [80, 60] },
        { id: 'b', type: 'security', label: 'B', pos: [200, 100], size: [80, 60] },
        { id: 'c', type: 'messagebus', label: 'C', pos: [100, 280], size: [120, 60] },
      ],
      boundaries: [
        { kind: 'region', label: '业务插件', wraps: ['a', 'b'], pad: 80, padY: 80 },
        { kind: 'region', label: '基础设施底座', wraps: ['c'], pad: 40, padY: 40 },
      ],
    }
    const out = enrichArchitectureBoundaries(doc)
    const boxes = out.components.map((c) => ({ id: c.id, pos: c.pos!, size: c.size! }))
    const byLabel = Object.fromEntries(
      (out.boundaries ?? []).map((b) => [b.label, boundaryRect(b.wraps, boxes, b)!]),
    )
    const p = byLabel['业务插件']
    const base = byLabel['基础设施底座']
    const overlap =
      p.x < base.x + base.w && p.x + p.w > base.x && p.y < base.y + base.h && p.y + p.h > base.y
    expect(overlap).toBe(false)
  })

  it('does not hang when nested pads already at BOUNDARY_PAD_MAX', () => {
    const doc: ArchifyDiagram = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 't', output: 't.html' },
      components: [
        { id: 'a', type: 'frontend', label: 'A' },
        { id: 'b', type: 'backend', label: 'B' },
      ],
      boundaries: [
        {
          kind: 'region',
          label: 'outer',
          wraps: ['a', 'b'],
          pad: BOUNDARY_PAD_MAX,
          padY: BOUNDARY_PAD_MAX,
        },
        {
          kind: 'region',
          label: 'inner',
          wraps: ['b'],
          pad: BOUNDARY_PAD_MAX,
          padY: BOUNDARY_PAD_MAX,
        },
      ],
    }
    const out = enrichArchitectureBoundaries(doc)
    expect(out.boundaries).toHaveLength(2)
    expect(out.boundaries!.every((b) => (b.padY ?? 0) <= BOUNDARY_PAD_MAX)).toBe(true)
  })

  it('separates nested pads when both unset or equal', () => {
    const doc: ArchifyDiagram = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 't', output: 't.html' },
      components: [
        { id: 'a', type: 'frontend', label: 'A' },
        { id: 'b', type: 'backend', label: 'B' },
      ],
      boundaries: [
        { kind: 'region', label: 'outer', wraps: ['a', 'b'], pad: 14 },
        { kind: 'region', label: 'inner', wraps: ['b'], pad: 14 },
      ],
    }
    const out = enrichArchitectureBoundaries(doc)
    const outer = out.boundaries!.find((b) => b.label === 'outer')!
    const inner = out.boundaries!.find((b) => b.label === 'inner')!
    expect(outer.pad!).toBeGreaterThan(inner.pad!)
    expect(out.boundaries![0].label).toBe('outer')
  })
})
