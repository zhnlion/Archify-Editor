import { describe, expect, it } from 'vitest'
import { normalizeArchitecture, parseDiagram } from '../../../src/domain/document'
import { fixtureJson } from '../../helpers/fixtures'
import type { ArchifyDiagram } from '../../../src/types'

describe('normalizeArchitecture', () => {
  it('fills missing connection ids without collisions', () => {
    const raw = fixtureJson<ArchifyDiagram>('productionDeployment')
    expect(raw.connections?.every((c) => !c.id)).toBe(true)
    const normalized = normalizeArchitecture(raw)
    const ids = normalized.connections!.map((c) => c.id)
    expect(ids).toHaveLength(raw.connections!.length)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('c1')
  })

  it('parseDiagram applies normalize for architecture', () => {
    const raw = fixtureJson('productionDeployment')
    const doc = parseDiagram(raw)
    expect(doc.diagram_type).toBe('architecture')
    if (doc.diagram_type !== 'architecture') return
    expect(doc.connections?.every((c) => typeof c.id === 'string' && c.id.length > 0)).toBe(true)
    expect(doc.cards?.length).toBe(3)
  })
})
