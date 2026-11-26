import { describe, expect, it } from 'vitest'
import { openTypedDocument } from '../../../src/import/openTyped'
import { fixtureText } from '../../helpers/fixtures'

describe('openTypedDocument', () => {
  it('rejects architecture file when workflow selected', () => {
    const result = openTypedDocument(fixtureText('demoArchitecture'), 'archify-workflow')
    expect(result.ok).toBe(false)
  })

  it('accepts workflow when workflow selected', () => {
    const result = openTypedDocument(fixtureText('agentWorkflow'), 'archify-workflow')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.diagram.diagram_type).toBe('flowchart')
  })
})
