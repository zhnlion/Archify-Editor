import { describe, expect, it } from 'vitest'
import {
  importMermaidArchitecture,
  isMermaidArchitectureText,
} from '../../../src/import/mermaidImport'
import { openTypedDocument } from '../../../src/import/openTyped'
import { isArchitecture } from '../../../src/domain/document'
import { fixtureText } from '../../helpers/fixtures'

describe('Mermaid C4 / architecture-beta', () => {
  it('detects C4Context', () => {
    expect(isMermaidArchitectureText(fixtureText('simpleC4Mermaid'))).toBe(true)
    expect(isMermaidArchitectureText('flowchart TD\nA-->B')).toBe(false)
  })

  it('imports C4 as architecture with lossy report', () => {
    const { diagram, lossy } = importMermaidArchitecture(fixtureText('simpleC4Mermaid'))
    expect(diagram.diagram_type).toBe('architecture')
    expect(diagram.components.length).toBeGreaterThanOrEqual(3)
    expect(diagram.connections?.length).toBeGreaterThanOrEqual(2)
    expect(diagram.meta.format_hints?.source).toBe('mermaid')
    expect(lossy.dropped?.length).toBeGreaterThan(0)
    // 无几何：留给 F-22 layout
    expect(diagram.components.every((c) => !c.pos)).toBe(true)
  })

  it('openTyped mermaid routes C4 to architecture', () => {
    const result = openTypedDocument(fixtureText('simpleC4Mermaid'), 'mermaid')
    expect(result.ok).toBe(true)
    if (!result.ok || !isArchitecture(result.diagram)) return
    expect(result.diagram.components.some((c) => c.label === 'User')).toBe(true)
    expect(result.lossy?.dropped?.length).toBeGreaterThan(0)
  })

  it('imports architecture-beta service graph lossily', () => {
    const text = `architecture-beta
    group api(cloud)[API]
    service db(database)[Database] in api
    service web(server)[Web]
    db:R -- L:web
    web:B --> T:api
`
    const { diagram } = importMermaidArchitecture(text)
    expect(diagram.components.map((c) => c.id).sort()).toEqual(['api', 'db', 'web'].sort())
    expect(diagram.connections?.some((e) => e.from === 'db' && e.to === 'web')).toBe(true)
    expect(diagram.connections?.some((e) => e.from === 'web' && e.to === 'api')).toBe(true)
  })
})
