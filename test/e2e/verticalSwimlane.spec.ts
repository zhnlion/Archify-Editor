import { expect, test, type Dialog, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptDialogs(page: Page) {
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

test.describe('纵向泳道', () => {
  test.beforeEach(async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('导入纵向泳道夹具：纵列渲染 + 可增删改', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoVerticalSwimlane'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(page.locator('svg g.layer-band.vertical')).toHaveCount(2)
    await expect(page.getByLabel('泳道方向')).toHaveValue('vertical')

    await page.getByRole('button', { name: '新增泳道' }).click()
    await expect(page.locator('footer.status')).toContainText(/已新增泳道/)
    await expect(page.locator('svg g.layer-band.vertical')).toHaveCount(3)

    const rename = page.locator('.palette .layer-row input').nth(2)
    await rename.fill('列 C')
    await expect(page.locator('svg g.layer-band.vertical').nth(2)).toContainText('列 C')

    await page.locator('.palette .layer-row').nth(2).getByRole('button', { name: '×' }).click()
    await expect(page.locator('svg g.layer-band.vertical')).toHaveCount(2)
  })

  test('Palette 可从横向切到纵向', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await page.getByRole('button', { name: '新增泳道' }).click()
    await page.getByRole('button', { name: '新增泳道' }).click()
    await expect(page.locator('svg g.layer-band')).toHaveCount(2)
    await expect(page.locator('svg g.layer-band.vertical')).toHaveCount(0)

    await page.getByLabel('泳道方向').selectOption('vertical')
    await expect(page.locator('footer.status')).toContainText(/纵向泳道/)
    await expect(page.locator('svg g.layer-band.vertical')).toHaveCount(2)
    await expect(page.getByLabel('泳道方向')).toHaveValue('vertical')
  })
})
