import { describe, expect, it } from 'vitest'
import { FLOW_SHAPE_GROUPS, FLOW_SHAPES, SHAPE_DEFAULT } from '../../../src/types'

describe('flow symbol library', () => {
  it('groups cover every registered shape once', () => {
    const listed = FLOW_SHAPE_GROUPS.flatMap((g) => g.shapes)
    expect(new Set(listed).size).toBe(listed.length)
    expect(listed.sort()).toEqual([...FLOW_SHAPES.map((s) => s.shape)].sort())
  })

  it('has arrow shapes for flowchart palette', () => {
    const ids = new Set(FLOW_SHAPES.map((s) => s.shape))
    for (const s of ['arrow_right', 'arrow_left', 'arrow_up', 'arrow_down', 'arrow_both', 'chevron']) {
      expect(ids.has(s as (typeof FLOW_SHAPES)[number]['shape'])).toBe(true)
      expect(SHAPE_DEFAULT[s as keyof typeof SHAPE_DEFAULT]).toBeTruthy()
    }
  })
})
