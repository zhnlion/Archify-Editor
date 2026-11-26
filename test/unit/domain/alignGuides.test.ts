import { describe, expect, it } from 'vitest'
import { snapToAlignGuides } from '../../../src/domain/alignGuides'

describe('snapToAlignGuides', () => {
  it('snaps left edges and reports a vertical guide', () => {
    const moving = { id: 'a', pos: [82, 40] as [number, number], size: [100, 50] as [number, number] }
    const others = [{ id: 'b', pos: [80, 200] as [number, number], size: [120, 40] as [number, number] }]
    const { pos, guides } = snapToAlignGuides(moving, others, 6)
    expect(pos[0]).toBe(80)
    expect(guides.some((g) => g.axis === 'v' && g.at === 80)).toBe(true)
  })

  it('snaps vertical centers', () => {
    const moving = { id: 'a', pos: [10, 48] as [number, number], size: [100, 40] as [number, number] }
    const others = [{ id: 'b', pos: [200, 40] as [number, number], size: [80, 60] as [number, number] }]
    // b cy = 70; a cy = 68 → snap dy = 2
    const { pos, guides } = snapToAlignGuides(moving, others, 6)
    expect(pos[1]).toBe(50)
    expect(guides.some((g) => g.axis === 'h' && g.at === 70)).toBe(true)
  })
})
