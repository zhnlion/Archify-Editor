import type { ArchifyCard, ArchifyDiagram } from '../types'
import { isArchitecture } from './document'

export const CARD_DOTS = ['cyan', 'emerald', 'violet', 'amber', 'rose', 'orange', 'slate'] as const
export type CardDot = (typeof CARD_DOTS)[number]

export function normalizeCardDot(dot: unknown): CardDot {
  return CARD_DOTS.includes(dot as CardDot) ? (dot as CardDot) : 'cyan'
}

export function emptyCard(partial?: Partial<ArchifyCard>): ArchifyCard {
  return {
    dot: normalizeCardDot(partial?.dot),
    title: partial?.title?.trim() || '摘要',
    items: partial?.items?.length ? [...partial.items] : ['要点'],
  }
}

export function sanitizeCards(cards: ArchifyCard[] | undefined): ArchifyCard[] {
  if (!cards?.length) return []
  return cards.map((c) => ({
    dot: normalizeCardDot(c.dot),
    title: String(c.title || '摘要').trim() || '摘要',
    items: (c.items ?? []).map((i) => String(i)).filter((i) => i.length > 0),
  }))
}

export function setDiagramCards(d: ArchifyDiagram, cards: ArchifyCard[]): ArchifyDiagram {
  const next = sanitizeCards(cards)
  return { ...d, cards: next.length ? next : undefined }
}

export function updateCard(
  d: ArchifyDiagram,
  index: number,
  patch: Partial<ArchifyCard>,
): ArchifyDiagram {
  if (!isArchitecture(d)) return d
  const cards = sanitizeCards(d.cards)
  if (index < 0 || index >= cards.length) return d
  const cur = cards[index]!
  cards[index] = {
    dot: patch.dot !== undefined ? normalizeCardDot(patch.dot) : cur.dot!,
    title: patch.title !== undefined ? String(patch.title) : cur.title,
    items: patch.items !== undefined ? [...patch.items] : cur.items,
  }
  return setDiagramCards(d, cards)
}

export function addCard(d: ArchifyDiagram, card?: Partial<ArchifyCard>): ArchifyDiagram {
  if (!isArchitecture(d)) return d
  return setDiagramCards(d, [...sanitizeCards(d.cards), emptyCard(card)])
}

export function removeCard(d: ArchifyDiagram, index: number): ArchifyDiagram {
  if (!isArchitecture(d)) return d
  const cards = sanitizeCards(d.cards).filter((_, i) => i !== index)
  return setDiagramCards(d, cards)
}
