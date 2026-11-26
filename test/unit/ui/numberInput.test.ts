import { describe, expect, it } from 'vitest'
import { isIncompleteNumberDraft } from '../../../src/ui/NumberInput'

describe('NumberInput draft parse', () => {
  it('treats empty and trailing separators as incomplete (hand-typing)', () => {
    expect(isIncompleteNumberDraft('')).toBe(true)
    expect(isIncompleteNumberDraft('-')).toBe(true)
    expect(isIncompleteNumberDraft('.')).toBe(true)
    expect(isIncompleteNumberDraft('1.')).toBe(false)
    expect(isIncompleteNumberDraft('12')).toBe(false)
    expect(isIncompleteNumberDraft('1.5')).toBe(false)
  })
})
