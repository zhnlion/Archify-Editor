import { describe, expect, it } from 'vitest'
import { fixtureJson } from '../../helpers/fixtures'
import type { ArchifyDiagram } from '../../../src/types'
import {
  isLayerEdgeViolation,
  layerEdgeViolations,
  resolveLayerEdgeRule,
  setLayerEdgeRule,
} from '../../../src/domain/layerRules'
import { stripForFinalize } from '../../../src/domain/document'

describe('layerRules', () => {
  const sample = fixtureJson<ArchifyDiagram>('layeredCards')

  it('reads downward rule from meta.editor', () => {
    expect(resolveLayerEdgeRule(sample)).toBe('downward')
    expect(layerEdgeViolations(sample).map((c) => c.id)).toEqual(['e-up'])
    expect(isLayerEdgeViolation(sample, { from: 'web', to: 'api' })).toBe(false)
    expect(isLayerEdgeViolation(sample, { from: 'db', to: 'api' })).toBe(true)
  })

  it('free rule reports no violations', () => {
    const free = setLayerEdgeRule(sample, 'free')
    expect(resolveLayerEdgeRule(free)).toBe('free')
    expect(layerEdgeViolations(free)).toEqual([])
  })

  it('stripForFinalize drops layerEdgeRule with meta.editor and keeps cards', () => {
    const out = stripForFinalize(sample)
    expect(out.meta).not.toHaveProperty('editor')
    expect(out.cards?.length).toBe(2)
    expect(out.connections?.some((c) => c.id === 'e-up')).toBe(true)
  })
})
