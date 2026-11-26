import { expect, test } from '@playwright/test'

/**
 * 回归：顶栏 overflow 曾把导入/导出下拉裁成不可见。
 * a11y 树仍能找到 menuitem，必须额外断言几何可见与可点中。
 */
test.describe('FormatMenu 可见性', () => {
  test('导入下拉不被 topbar 裁切，且中心可命中菜单', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '导入' }).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    const metrics = await page.evaluate(() => {
      const el = document.querySelector('.format-dropdown')
      const topbar = document.querySelector('.topbar')
      if (!el || !topbar) return null
      const mr = el.getBoundingClientRect()
      const tr = topbar.getBoundingClientRect()
      const cx = mr.left + mr.width / 2
      const cy = mr.top + Math.min(80, mr.height / 2)
      const hit = document.elementFromPoint(cx, cy)
      // 被 overflow 裁切时：几何高度很大，但落在 topbar 外的可见部分 ≈ 0，且中心命中画布
      const visibleBelowTopbar = Math.max(0, mr.bottom - tr.bottom)
      return {
        menuHeight: mr.height,
        visibleBelowTopbar,
        hitIsMenu: !!(hit && (hit === el || el.contains(hit))),
        portal: el.classList.contains('format-dropdown--portal'),
      }
    })

    expect(metrics).not.toBeNull()
    expect(metrics!.portal).toBe(true)
    expect(metrics!.menuHeight).toBeGreaterThan(120)
    expect(metrics!.visibleBelowTopbar).toBeGreaterThan(120)
    expect(metrics!.hitIsMenu).toBe(true)
    // 仍应能点到具体项
    await expect(page.getByRole('menuitem', { name: /本编辑器 JSON/ })).toBeVisible()
  })

  test('导出下拉同样可见', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '导出' }).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const box = await menu.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThan(80)
  })
})
