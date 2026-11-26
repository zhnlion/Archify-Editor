import { expect, test, type Dialog, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptConfirms(page: Page) {
  page.on('dialog', async (dialog: Dialog) => {
    if (dialog.type() === 'confirm') {
      await dialog.accept()
      return
    }
    if (dialog.type() === 'prompt') {
      await dialog.accept(dialog.defaultValue() || 'flowchart')
      return
    }
    await dialog.dismiss()
  })
}

async function importEditorJson(page: Page, filePath: string) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入' }).click()
  await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(filePath)
}

test.describe('多选统一尺寸', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('Ctrl+A 后检查器统一宽应用到全部节点', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await expect(page.locator('footer.status')).toContainText(/nodes 6/)

    await page.locator('.canvas-scroll').click({ position: { x: 16, y: 16 } })
    await page.keyboard.press('Control+a')
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(/已选 6 个图形/)

    const widthInput = page.locator('.inspector label', { hasText: '统一宽' }).locator('..').locator('input')
    await widthInput.fill('180')
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形尺寸')

    // 清空多选后点选核对；判断节点为 polygon，用 g.node 强制点击
    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })
    await page.locator('svg g.node').filter({ hasText: '收包' }).click({ force: true })
    await expect(page.locator('.inspector label', { hasText: /^宽$/ }).locator('..').locator('input')).toHaveValue(
      '180',
    )
    await page.locator('svg g.node').filter({ hasText: '命中策略?' }).click({ force: true })
    await expect(page.locator('.inspector label', { hasText: /^宽$/ }).locator('..').locator('input')).toHaveValue(
      '180',
    )
  })
})
