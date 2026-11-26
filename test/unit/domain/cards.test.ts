import { describe, expect, it } from 'vitest'
import { fixtureJson } from '../../helpers/fixtures'
import type { ArchifyDiagram } from '../../../src/types'
import { addCard, removeCard, sanitizeCards, updateCard } from '../../../src/domain/cards'

describe('cards', () => {
  const sample = fixtureJson<ArchifyDiagram>('layeredCards')

  it('sanitizes dots and empty titles', () => {
    expect(sanitizeCards([{ title: '', items: ['a'], dot: 'nope' as 'cyan' }])).toEqual([
      { title: '摘要', items: ['a'], dot: 'cyan' },
    ])
  })

  it('adds updates and removes cards on architecture', () => {
    let d = addCard(sample, { title: '新卡', items: ['x'], dot: 'rose' })
    expect(d.cards?.length).toBe(3)
    d = updateCard(d, 2, { title: '改名' })
    expect(d.cards?.[2]?.title).toBe('改名')
    d = removeCard(d, 0)
    expect(d.cards?.length).toBe(2)
    expect(d.cards?.[0]?.title).toBe('注意')
  })
})
