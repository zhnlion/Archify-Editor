/** 判断节点新出边的默认文案。已有非空文案不改。第三条起不再自动填写。 */
export function labelForNewDecisionEdge(existingOutgoing: number, explicit?: string): string | undefined {
  if (explicit && explicit.trim()) return explicit
  if (existingOutgoing <= 0) return '是'
  if (existingOutgoing === 1) return '否'
  return explicit?.trim() ? explicit : undefined
}
