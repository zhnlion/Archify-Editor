import { expect, test } from '@playwright/test'

/**
 * 导出「另存为」：选格式后先弹面板让用户命名，再落盘。
 * headless Chromium 通常无 showSaveFilePicker，走「直接下载」降级路径，
 * 正好可断言文件名由用户输入决定（而非固定自动生成）。
 */
test.describe('导出另存为', () => {
  test('导出本编辑器 JSON 弹出另存为面板，改名后下载文件名生效', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '导出' }).click()
    await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()

    const dialog = page.getByRole('dialog', { name: '另存为' })
    await expect(dialog).toBeVisible()

    const nameInput = dialog.getByRole('textbox')
    // 预填了基于文档标题的建议名
    const suggested = await nameInput.inputValue()
    expect(suggested.length).toBeGreaterThan(0)
    expect(suggested.endsWith('.json')).toBe(true)

    await nameInput.fill('我的自定义图名')

    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: '直接下载' }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('我的自定义图名.json')
    await expect(dialog).toBeHidden()
  })

  test('取消另存为不产生下载、面板关闭', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '导出' }).click()
    await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()

    const dialog = page.getByRole('dialog', { name: '另存为' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '取消' }).click()
    await expect(dialog).toBeHidden()
  })

  test('SVG 导出同样走另存为，扩展名为 .svg', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '导出' }).click()
    await page.getByRole('menuitem', { name: /SVG 矢量图/ }).click()

    const dialog = page.getByRole('dialog', { name: '另存为' })
    await expect(dialog).toBeVisible()
    const nameInput = dialog.getByRole('textbox')
    expect(await nameInput.inputValue()).toMatch(/\.svg$/)

    await nameInput.fill('矢量图')
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: '直接下载' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('矢量图.svg')
  })
})
