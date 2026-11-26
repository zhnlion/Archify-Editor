import { describe, expect, it } from 'vitest'
import { resolveNodeStyle, resolveSubFontSize } from '../../../src/domain/style'
import { getBoundaryStyle } from '../../../src/domain/boundaryStyle'
import type { ArchifyDiagram } from '../../../src/types'

describe('theme-aware styles (Archify-like)', () => {
  it('architecture defaults flip fill/text between dark and light', () => {
    const dark = resolveNodeStyle('architecture', 'frontend', undefined, 'dark')
    const light = resolveNodeStyle('architecture', 'frontend', undefined, 'light')
    expect(dark.text.toLowerCase()).not.toBe(light.text.toLowerCase())
    expect(dark.fill).not.toBe(light.fill)
    expect(light.text).toBe('#1F2329')
    expect(light.fill.toLowerCase()).toMatch(/#f0f5ff|#ffffff|#f7f8fa/)
    expect(light.stroke.toLowerCase()).toMatch(/#1677ff|#4e5969|#3491fa/)
    expect(dark.text.toLowerCase()).toMatch(/f8fafc|e7eef6|ffffff/)
  })

  it('treats baked dark #1e2731 as theme-default when switching to light', () => {
    const light = resolveNodeStyle(
      'architecture',
      'backend',
      { fill: '#1e2731', text: '#e7eef6' },
      'light',
    )
    expect(light.fill).not.toBe('#1e2731')
    expect(light.text).toBe('#1F2329')
  })

  it('light architecture stays in gray-blue palette (no rainbow accents)', () => {
    const types = ['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'] as const
    for (const t of types) {
      const st = resolveNodeStyle('architecture', t, undefined, 'light')
      expect(st.stroke.toLowerCase()).not.toMatch(/#059669|#7c3aed|#d97706|#e11d48|#ea580c/)
    }
  })

  it('preserves explicit custom colors across themes', () => {
    const custom = { fill: '#ff00aa', text: '#00ff88', stroke: '#123456' }
    const light = resolveNodeStyle('architecture', 'frontend', custom, 'light')
    const dark = resolveNodeStyle('architecture', 'frontend', custom, 'dark')
    expect(light.fill).toBe('#ff00aa')
    expect(dark.fill).toBe('#ff00aa')
    expect(light.text).toBe('#00ff88')
  })

  it('preserves explicit white node fill in dark theme', () => {
    const dark = resolveNodeStyle('architecture', 'frontend', { fill: '#FFFFFF' }, 'dark')
    expect(dark.fill).toBe('#FFFFFF')
  })

  it('boundary defaults follow theme', () => {
    const doc: ArchifyDiagram = {
      schema_version: 1,
      diagram_type: 'architecture',
      meta: { title: 't', output: 't.html' },
      components: [{ id: 'a', type: 'frontend', label: 'A' }],
      boundaries: [{ kind: 'region', label: '区', wraps: ['a'] }],
    }
    const dark = getBoundaryStyle(doc, '区', 'dark')
    const light = getBoundaryStyle(doc, '区', 'light')
    expect(dark.text).not.toBe(light.text)
    expect(light.text).toBe('#4E5969')
  })

  it('resolveSubFontSize: explicit wins; else ~85% of title', () => {
    expect(resolveSubFontSize(13)).toBe(11)
    expect(resolveSubFontSize(20, 14)).toBe(14)
    expect(resolveSubFontSize(13, 8)).toBe(8)
  })

  it('resolveNodeStyle keeps subFontSize from style', () => {
    const st = resolveNodeStyle('flowchart', 'process', { fontSize: 16, subFontSize: 10 }, 'light')
    expect(st.fontSize).toBe(16)
    expect(st.subFontSize).toBe(10)
  })
})
