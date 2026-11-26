import { describe, expect, it } from 'vitest'
import {
  buildEdgeGeometry,
  collapseOrthoPoints,
  ensureOrthoPolyline,
  listOrthoSegmentHandles,
  mapWorkflowRouteToFlow,
  moveOrthoCorner,
  moveOrthoSegment,
  orthoPoints,
  resolveFlowRoute,
} from '../../../src/domain/edgeRoute'

function assertOrtho(points: [number, number][]) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const shareX = Math.abs(a[0] - b[0]) < 1.5
    const shareY = Math.abs(a[1] - b[1]) < 1.5
    expect(shareX || shareY).toBe(true)
  }
}

describe('edgeRoute', () => {
  it('defaults flow route to ortho', () => {
    expect(resolveFlowRoute(undefined)).toBe('ortho')
    expect(resolveFlowRoute('curve')).toBe('curve')
  })

  it('maps Archify workflow routes to ortho except straight', () => {
    expect(mapWorkflowRouteToFlow('straight')).toBe('straight')
    expect(mapWorkflowRouteToFlow('auto')).toBe('ortho')
    expect(mapWorkflowRouteToFlow('outside-right')).toBe('ortho')
    expect(mapWorkflowRouteToFlow(undefined)).toBe('ortho')
  })

  it('builds HVH ortho polyline', () => {
    const pts = orthoPoints([0, 10], [100, 50], 'h')
    expect(pts).toEqual([
      [0, 10],
      [50, 10],
      [50, 50],
      [100, 50],
    ])
  })

  it('buildEdgeGeometry uses ortho for flowchart default', () => {
    const g = buildEdgeGeometry({
      kind: 'flowchart',
      start: [100, 20],
      end: [200, 80],
      fromPos: [0, 0],
      fromSize: [100, 40],
      toPos: [200, 60],
      toSize: [100, 40],
    })
    expect(g.d.startsWith('M ')).toBe(true)
    expect(g.d.includes(' L ')).toBe(true)
    expect(g.points.length).toBeGreaterThanOrEqual(3)
  })

  it('lists mid-segment handles for HVH ortho', () => {
    const pts = orthoPoints([0, 10], [100, 50], 'h')
    const handles = listOrthoSegmentHandles(pts)
    expect(handles.length).toBe(3)
    expect(handles.map((h) => h.axis)).toEqual(['h', 'v', 'h'])
    expect(handles[1]!.mid).toEqual([50, 30])
  })

  it('moveOrthoSegment shifts middle vertical segment and keeps anchors', () => {
    const pts: [number, number][] = [
      [0, 50],
      [50, 50],
      [50, 100],
      [100, 100],
    ]
    const via = moveOrthoSegment(pts, 1, [70, 80])
    const full = [pts[0]!, ...via, pts[pts.length - 1]!]
    assertOrtho(full)
    expect(full[0]).toEqual([0, 50])
    expect(full[full.length - 1]).toEqual([100, 100])
    // 竖直中段平移到 x≈70
    expect(via.some((p) => Math.abs(p[0] - 70) < 1)).toBe(true)
  })

  it('moveOrthoSegment on first stub inserts vertical from fixed start', () => {
    const pts: [number, number][] = [
      [0, 50],
      [50, 50],
      [50, 100],
      [100, 100],
    ]
    const via = moveOrthoSegment(pts, 0, [25, 20])
    const full = [pts[0]!, ...via, pts[pts.length - 1]!]
    assertOrtho(full)
    expect(full[0]).toEqual([0, 50])
    expect(full[1]).toEqual([0, 20])
  })

  it('moveOrthoCorner keeps polyline ortho after free drag', () => {
    const pts: [number, number][] = [
      [0, 50],
      [50, 50],
      [50, 100],
      [100, 100],
    ]
    const via = moveOrthoCorner(pts, 0, [40, 30])
    const full = [pts[0]!, ...via, pts[pts.length - 1]!]
    assertOrtho(full)
    expect(full[0]).toEqual([0, 50])
    expect(full[full.length - 1]).toEqual([100, 100])
  })

  it('collapseOrthoPoints removes colinear middles', () => {
    expect(
      collapseOrthoPoints([
        [0, 0],
        [10, 0],
        [20, 0],
        [20, 10],
      ]),
    ).toEqual([
      [0, 0],
      [20, 0],
      [20, 10],
    ])
  })

  it('ensureOrthoPolyline inserts L on diagonal', () => {
    const pts = ensureOrthoPolyline([
      [0, 0],
      [10, 20],
    ])
    assertOrtho(pts)
    expect(pts.length).toBeGreaterThanOrEqual(3)
  })

  it('imported via edges still expose segment handles via buildEdgeGeometry', () => {
    const g = buildEdgeGeometry({
      kind: 'flowchart',
      route: 'ortho',
      start: [10, 40],
      end: [200, 120],
      fromPos: [0, 20],
      fromSize: [20, 40],
      toPos: [200, 100],
      toSize: [40, 40],
      fromSide: 'e',
      toSide: 'w',
      via: [
        [80, 40],
        [80, 120],
      ],
    })
    expect(g.points[0]).toEqual([10, 40])
    expect(g.points[g.points.length - 1]).toEqual([200, 120])
    const handles = listOrthoSegmentHandles(g.points)
    expect(handles.length).toBeGreaterThanOrEqual(2)
    expect(handles.every((h) => h.axis === 'h' || h.axis === 'v')).toBe(true)
  })

  it('top-corridor multi-via: vertical first segment can move horizontally', () => {
    // 模拟 tcp-proxy→d_auth：东出 → 顶走廊 → 北入（含 0.1 精度端点）
    const start: [number, number] = [416, 784]
    const end: [number, number] = [589.5, 69.9]
    const via: [number, number][] = [
      [416, 44],
      [589.5, 44],
    ]
    const g = buildEdgeGeometry({
      kind: 'flowchart',
      route: 'ortho',
      start,
      end,
      fromPos: [301, 752],
      fromSize: [115, 64],
      toPos: [520, 68],
      toSize: [140, 64],
      fromSide: 'e',
      toSide: 'n',
      via,
    })
    assertOrtho(g.points)
    const handles = listOrthoSegmentHandles(g.points)
    const vert = handles.filter((h) => h.axis === 'v')
    expect(vert.length).toBeGreaterThanOrEqual(1)
    const firstV = vert[0]!
    const moved = moveOrthoSegment(g.points, firstV.segIndex, [350, 400])
    const g2 = buildEdgeGeometry({
      kind: 'flowchart',
      route: 'ortho',
      start,
      end,
      fromPos: [301, 752],
      fromSize: [115, 64],
      toPos: [520, 68],
      toSize: [140, 64],
      fromSide: 'e',
      toSide: 'n',
      via: moved,
    })
    assertOrtho(g2.points)
    expect(g2.points[0]).toEqual(start)
    expect(g2.points[g2.points.length - 1]).toEqual(end)
    // 长竖段已平移到 x≈350
    expect(g2.points.some((p, i) => i > 0 && i < g2.points.length - 1 && Math.abs(p[0] - 350) < 1)).toBe(
      true,
    )
    expect(listOrthoSegmentHandles(g2.points).some((h) => h.axis === 'v')).toBe(true)
  })
})
