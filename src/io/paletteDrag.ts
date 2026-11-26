import type { ComponentType, FlowShape } from '../types'

export const PALETTE_MIME = 'application/x-archify-palette'

export type LineRouteOption = 'straight' | 'ortho' | 'curve'

export type PaletteDragPayload =
  | { kind: 'flow'; shape: FlowShape }
  | { kind: 'arch'; type: ComponentType }
  | { kind: 'boundary' }
  | { kind: 'line'; route: LineRouteOption }

export function encodePaletteDrag(payload: PaletteDragPayload): string {
  return JSON.stringify(payload)
}

export function decodePaletteDrag(raw: string): PaletteDragPayload | null {
  try {
    const data = JSON.parse(raw) as PaletteDragPayload
    if (data?.kind === 'flow' && typeof data.shape === 'string') return data
    if (data?.kind === 'arch' && typeof data.type === 'string') return data
    if (data?.kind === 'boundary') return data
    if (
      data?.kind === 'line' &&
      (data.route === 'straight' || data.route === 'ortho' || data.route === 'curve')
    ) {
      return data
    }
    return null
  } catch {
    return null
  }
}
