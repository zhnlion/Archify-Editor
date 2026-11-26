import { describe, expect, it } from 'vitest'
import { labelForNewDecisionEdge } from '../../../src/domain/decisionEdge'

describe('decision edge labels', () => {
  it('uses 是 then 否 and keeps an explicit label', () => {
    expect(labelForNewDecisionEdge(0)).toBe('是')
    expect(labelForNewDecisionEdge(1)).toBe('否')
    expect(labelForNewDecisionEdge(2)).toBeUndefined()
    expect(labelForNewDecisionEdge(0, '已有')).toBe('已有')
  })
})
