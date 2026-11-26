import { describe, expect, it } from 'vitest'
import {
  ANCHORS_PER_SIDE,
  boxAnchorPoints,
  nearestAnchor,
  nearestSide,
  sideAnchorPoints,
} from '../../../src/domain/anchorPoints'

describe('anchorPoints 连线候选锚点', () => {
  it('每条边均布 3 个点，共 12 个', () => {
    const anchors = boxAnchorPoints([0, 0], [120, 60])
    expect(anchors).toHaveLength(12)
    for (const side of ['n', 'e', 's', 'w']) {
      expect(anchors.filter((a) => a.side === side)).toHaveLength(ANCHORS_PER_SIDE)
    }
  })

  it('候选点落在边上且不含角点', () => {
    const top = sideAnchorPoints([0, 0], [120, 60], 'n')
    expect(top.map((a) => a.point[0])).toEqual([30, 60, 90])
    expect(top.every((a) => a.point[1] === 0)).toBe(true)
    const right = sideAnchorPoints([0, 0], [120, 60], 'e')
    expect(right.map((a) => a.point[1])).toEqual([15, 30, 45])
    expect(right.every((a) => a.point[0] === 120)).toBe(true)
  })

  it('最近锚点吸附到光标所在边', () => {
    const anchors = boxAnchorPoints([100, 100], [120, 60])
    // 光标在顶边偏左 -> 最近点应在 n 边
    const near = nearestAnchor(anchors, [130, 102])
    expect(near?.side).toBe('n')
    expect(near?.point).toEqual([130, 100])
    // 光标在右边中点附近 -> e 边中间那个点
    const nearRight = nearestAnchor(anchors, [221, 130])
    expect(nearRight?.side).toBe('e')
    expect(nearRight?.point).toEqual([220, 130])
  })

  it('空候选集返回 null', () => {
    expect(nearestAnchor([], [0, 0])).toBeNull()
  })

  it('nearestSide 按相对中心判边', () => {
    expect(nearestSide([0, 0], [100, 100], [50, -5])).toBe('n')
    expect(nearestSide([0, 0], [100, 100], [105, 50])).toBe('e')
    expect(nearestSide([0, 0], [100, 100], [50, 105])).toBe('s')
    expect(nearestSide([0, 0], [100, 100], [-5, 50])).toBe('w')
  })
})
