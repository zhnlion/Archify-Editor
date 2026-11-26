import type { ArchifyCard } from '../types'
import { CARD_DOTS, type CardDot } from '../domain/cards'

type Props = {
  cards: ArchifyCard[]
  selectedIndex: number | null
  onSelect: (index: number | null) => void
  onAdd: () => void
  onRemove: (index: number) => void
  onPatch: (index: number, patch: Partial<ArchifyCard>) => void
}

/** architecture 画布下方摘要卡：可增删改；finalize HTML 仍读 IR cards */
export function ArchCards({ cards, selectedIndex, onSelect, onAdd, onRemove, onPatch }: Props) {
  return (
    <div className="arch-cards" aria-label="架构摘要卡">
      <div className="arch-cards-head">
        <span className="arch-cards-title">摘要卡</span>
        <button type="button" className="tiny" onClick={onAdd} title="新增摘要卡">
          + 卡
        </button>
      </div>
      <div className="arch-cards-row">
        {cards.length === 0 ? (
          <p className="hint arch-cards-empty">暂无摘要卡；导出 HTML 可带 cards。点「+ 卡」编辑。</p>
        ) : (
          cards.map((card, i) => {
            const active = selectedIndex === i
            const dot = (card.dot ?? 'cyan') as CardDot
            return (
              <article
                key={`${card.title}-${i}`}
                className={`arch-card${active ? ' selected' : ''}`}
                data-dot={dot}
                onClick={() => onSelect(active ? null : i)}
              >
                <header className="arch-card-head">
                  <i className={`arch-card-dot dot-${dot}`} aria-hidden />
                  {active ? (
                    <input
                      className="arch-card-title-input"
                      value={card.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onPatch(i, { title: e.target.value })}
                      aria-label="卡标题"
                    />
                  ) : (
                    <strong>{card.title}</strong>
                  )}
                  <button
                    type="button"
                    className="danger tiny"
                    title="删除此卡"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(i)
                    }}
                  >
                    ×
                  </button>
                </header>
                {active ? (
                  <div className="arch-card-edit" onClick={(e) => e.stopPropagation()}>
                    <label>
                      色点
                      <select
                        value={dot}
                        onChange={(e) => onPatch(i, { dot: e.target.value as CardDot })}
                      >
                        {CARD_DOTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      条目（每行一条）
                      <textarea
                        rows={3}
                        value={(card.items ?? []).join('\n')}
                        onChange={(e) => onPatch(i, { items: e.target.value.split('\n') })}
                      />
                    </label>
                  </div>
                ) : (
                  <ul>
                    {(card.items ?? []).slice(0, 4).map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                    {(card.items?.length ?? 0) > 4 ? <li className="muted">…</li> : null}
                  </ul>
                )}
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
