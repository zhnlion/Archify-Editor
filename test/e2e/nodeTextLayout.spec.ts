import { expect, test, type Dialog, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptConfirms(page: Page) {
  page.on('dialog', async (dialog: Dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept()
    else if (dialog.type() === 'prompt') await dialog.accept(dialog.defaultValue() || 'flowchart')
    else await dialog.dismiss()
  })
}

async function importEditorJson(page: Page, filePath: string) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入' }).click()
  await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(filePath)
}

test.describe('过程框多行文字', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('属性面板支持三行文字并在过程框中完整显示', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    const process = page.locator('svg g.node').filter({ hasText: '解析头' })
    await process.click()

    const titleEditor = page
      .locator('.inspector label', { hasText: /^标题（支持换行）$/ })
      .locator('xpath=following-sibling::textarea[1]')
    await titleEditor.fill('解析头\n第二行\n第三行')

    const selected = page.locator('svg g.node.selected')
    await expect(selected.locator('text.title')).toHaveText('解析头')
    await expect(selected.locator('text.sub')).toHaveCount(2)
    await expect(selected.locator('text.sub').nth(0)).toHaveText('第二行')
    await expect(selected.locator('text.sub').nth(1)).toHaveText('第三行')
  })

  test('超长单行标题在框内自动折行且内容完整', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    const longText = '用户请求经过网关鉴权后转发至后端服务集群继续处理'
    const process = page.locator('svg g.node').filter({ hasText: '解析头' })
    await process.click()

    const titleEditor = page
      .locator('.inspector label', { hasText: /^标题（支持换行）$/ })
      .locator('xpath=following-sibling::textarea[1]')
    await titleEditor.fill(longText)

    const selected = page.locator('svg g.node.selected')
    const titleLines = selected.locator('text.title')
    await expect(titleLines.count()).resolves.toBeGreaterThan(1)
    const rendered = await titleLines.allTextContents()
    expect(rendered.join('')).toBe(longText)
  })

  test('画布内双击编辑可输入多行并以 Ctrl+Enter 结束', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    const process = page.locator('svg g.node').filter({ hasText: '解析头' })
    await process.dblclick()

    const editor = page.locator('textarea.node-label-input')
    await expect(editor).toBeVisible()
    await editor.fill('画布标题\n画布第二行')
    await page.keyboard.press('Control+Enter')

    const selected = page.locator('svg g.node.selected')
    await expect(selected.locator('text.title')).toHaveText('画布标题')
    await expect(selected.locator('text.sub')).toHaveText('画布第二行')
    await expect(page.locator('textarea.node-label-input')).toHaveCount(0)
  })
})
