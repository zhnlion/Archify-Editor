import type { AnyDiagram, BoxStyle, ColorTag, FlowchartNode, ArchifyComponent } from '../types'
import { isArchitecture, isFlowchart } from './document'
import { isNoneFill } from './style'

function isNoneLike(fill: string | undefined): boolean {
  return isNoneFill(fill)
}

type Tagged = { id: string; tagId?: string; style?: BoxStyle }

export function colorTagsOf(diagram: AnyDiagram): ColorTag[] {
  return diagram.meta.editor?.colorTags ?? []
}

function withEditorTags(diagram: AnyDiagram, colorTags: ColorTag[]): AnyDiagram {
  return {
    ...diagram,
    meta: {
      ...diagram.meta,
      editor: { ...diagram.meta.editor, colorTags },
    },
  } as AnyDiagram
}

function paintStyle(style: BoxStyle | undefined, tag: ColorTag): BoxStyle {
  return { ...style, fill: tag.fill, stroke: tag.stroke, text: tag.text }
}

function mapTagged<T extends Tagged>(nodes: T[], fn: (node: T) => T): T[] {
  return nodes.map(fn)
}

function repaintTag(diagram: AnyDiagram, tag: ColorTag): AnyDiagram {
  if (isFlowchart(diagram)) {
    return {
      ...diagram,
      nodes: mapTagged(diagram.nodes, (n) =>
        n.tagId === tag.id ? { ...n, style: paintStyle(n.style, tag) } : n,
      ),
    }
  }
  if (isArchitecture(diagram)) {
    return {
      ...diagram,
      components: mapTagged(diagram.components, (n) =>
        n.tagId === tag.id ? { ...n, style: paintStyle(n.style, tag) } : n,
      ),
    }
  }
  return diagram
}

export function upsertColorTag(diagram: AnyDiagram, tag: ColorTag): AnyDiagram {
  const tags = [...colorTagsOf(diagram)]
  const index = tags.findIndex((item) => item.id === tag.id)
  if (index >= 0) tags[index] = tag
  else tags.push(tag)
  return repaintTag(withEditorTags(diagram, tags), tag)
}

export function bindColorTag(diagram: AnyDiagram, ids: string[], tagId: string | null): AnyDiagram {
  const idset = new Set(ids)
  const tag = tagId ? colorTagsOf(diagram).find((item) => item.id === tagId) : undefined
  const apply = <T extends Tagged>(node: T): T => {
    if (!idset.has(node.id)) return node
    if (!tag) {
      const next = { ...node }
      delete next.tagId
      return next
    }
    return { ...node, tagId: tag.id, style: paintStyle(node.style, tag) }
  }
  if (isFlowchart(diagram)) return { ...diagram, nodes: diagram.nodes.map(apply) }
  if (isArchitecture(diagram)) return { ...diagram, components: diagram.components.map(apply) }
  return diagram
}

/** 改填充/描边/字色。选中项共用一个色标时改色标定义；否则只改这些框并脱离色标。 */
export function paintNodes(diagram: AnyDiagram, ids: string[], patch: BoxStyle): AnyDiagram {
  const nodes: Tagged[] = isFlowchart(diagram)
    ? diagram.nodes
    : isArchitecture(diagram)
      ? diagram.components
      : []
  const selected = nodes.filter((node) => ids.includes(node.id))
  const tagIds = new Set(selected.map((node) => node.tagId).filter((id): id is string => !!id))
  const shared = tagIds.size === 1 && selected.length > 0 && selected.every((node) => node.tagId)
  if (shared) {
    const tag = colorTagsOf(diagram).find((item) => item.id === [...tagIds][0])
    if (tag) {
      const next: ColorTag = {
        ...tag,
        ...(patch.fill !== undefined && !isNoneLike(patch.fill) ? { fill: patch.fill } : {}),
        ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}),
        ...(patch.text !== undefined ? { text: patch.text } : {}),
      }
      const painted = upsertColorTag(diagram, next)
      const local: BoxStyle = {}
      if (patch.fill !== undefined && isNoneLike(patch.fill)) local.fill = patch.fill
      if (patch.strokeWidth != null) local.strokeWidth = patch.strokeWidth
      if (patch.fontSize != null) local.fontSize = patch.fontSize
      if (patch.subFontSize != null) local.subFontSize = patch.subFontSize
      if (patch.fontWeight != null) local.fontWeight = patch.fontWeight
      if (patch.fontStyle != null) local.fontStyle = patch.fontStyle
      if (patch.strokeDasharray !== undefined) local.strokeDasharray = patch.strokeDasharray
      if (!Object.keys(local).length) return painted
      return applyLocal(painted, ids, local, true)
    }
  }
  return applyLocal(diagram, ids, patch, false)
}

function applyLocal(diagram: AnyDiagram, ids: string[], patch: BoxStyle, keepTag: boolean): AnyDiagram {
  const idset = new Set(ids)
  const apply = <T extends Tagged>(node: T): T => {
    if (!idset.has(node.id)) return node
    const next = { ...node, style: { ...node.style, ...patch } }
    if (!keepTag) delete next.tagId
    return next
  }
  if (isFlowchart(diagram)) return { ...diagram, nodes: diagram.nodes.map(apply) }
  if (isArchitecture(diagram)) return { ...diagram, components: diagram.components.map(apply) }
  return diagram
}

export function createColorTag(id: string, label: string, style?: BoxStyle): ColorTag {
  return {
    id,
    label: label.trim() || '色标',
    fill: style?.fill || '#E8F1FF',
    stroke: style?.stroke || '#3D9CF0',
    text: style?.text || '#0F172A',
  }
}

export function nodeById(diagram: AnyDiagram, id: string): FlowchartNode | ArchifyComponent | undefined {
  if (isFlowchart(diagram)) return diagram.nodes.find((node) => node.id === id)
  if (isArchitecture(diagram)) return diagram.components.find((node) => node.id === id)
  return undefined
}
