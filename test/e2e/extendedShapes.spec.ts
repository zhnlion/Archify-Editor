import { expect, test } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

test.describe('偶发 ANSI 扩形', () => {
  test('导入扩形夹具后画布出现 offpage/merge/multi_document', async ({ page }) => {
    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') await d.accept()
      else await d.dismiss()
    })
    await page.goto('/')
    await page.locator('select.type-select').first().selectOption('flowchart')

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '导入' }).click()
    await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
    await (await chooserPromise).setFiles(fixturePath('extendedShapes'))

    await expect(page.locator('footer.status')).toContainText(/已导入/)
    await expect(page.locator('svg g.node')).toHaveCount(8)
    await expect(page.getByRole('button', { name: '跨页符' })).toBeVisible()
    await expect(page.getByRole('button', { name: '合并' })).toBeVisible()
    await expect(page.getByRole('button', { name: '多文档' })).toBeVisible()
  })
})
