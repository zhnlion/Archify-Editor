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

function colorTextInput(page: Page, label: string) {
  return page
    .locator('.inspector .color-picker')
    .filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.color-row input')
    .nth(1)
}

function edgeByLabel(page: Page, label: string) {
  return page.locator('svg g.edge').filter({ hasText: label }).first()
}

test.describe('边标签背景与边线格式刷', () => {
  test.beforeEach(async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('默认标签无底，Inspector 可设标签背景', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await expect(page.locator('footer.status')).toContainText(/nodes 6/)

    const yes = edgeByLabel(page, '是')
    await yes.click()
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(/e3|边/)

    const bg = yes.locator('rect.edge-label-bg')
    await expect(bg).toHaveAttribute('fill', 'none')

    await colorTextInput(page, '标签背景').fill('#FEF3C7')
    await expect(bg).toHaveAttribute('fill', '#FEF3C7')

    await page.locator('.inspector .none-fill-btn').filter({ hasText: '无填充' }).click()
    await expect(bg).toHaveAttribute('fill', 'none')
  })

  test('格式刷把源边线色/标签底刷到目标边', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoVerticalSwimlane'))
    await expect(page.locator('footer.status')).toContainText(/nodes 3/)

    const source = edgeByLabel(page, '跨列')
    await source.click()
    await page.getByRole('button', { name: '格式刷' }).click()
    await expect(page.locator('footer.status')).toContainText(/格式刷：点击其它连线/)

    const target = edgeByLabel(page, '同列')
    await target.click()
    await expect(page.locator('footer.status')).toContainText(/已应用连线格式刷/)

    await expect(target.locator('path.edge-line')).toHaveAttribute('stroke', '#DC2626')
    await expect(target.locator('rect.edge-label-bg')).toHaveAttribute('fill', '#FEF3C7')
  })
})
