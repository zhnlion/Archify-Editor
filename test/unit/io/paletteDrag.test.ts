import { describe, expect, it } from 'vitest'
import { decodePaletteDrag, encodePaletteDrag } from '../../../src/io/paletteDrag'

describe('paletteDrag', () => {
  it('roundtrips flow and arch payloads', () => {
    const flow = encodePaletteDrag({ kind: 'flow', shape: 'decision' })
    expect(decodePaletteDrag(flow)).toEqual({ kind: 'flow', shape: 'decision' })
    const arch = encodePaletteDrag({ kind: 'arch', type: 'database' })
    expect(decodePaletteDrag(arch)).toEqual({ kind: 'arch', type: 'database' })
  })

  it('roundtrips boundary and line payloads', () => {
    expect(decodePaletteDrag(encodePaletteDrag({ kind: 'boundary' }))).toEqual({ kind: 'boundary' })
    for (const route of ['straight', 'ortho', 'curve'] as const) {
      expect(decodePaletteDrag(encodePaletteDrag({ kind: 'line', route }))).toEqual({
        kind: 'line',
        route,
      })
    }
  })

  it('rejects unknown line routes', () => {
    expect(decodePaletteDrag(JSON.stringify({ kind: 'line', route: 'zigzag' }))).toBeNull()
  })
})
