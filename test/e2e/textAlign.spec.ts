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

test.describe('过程框文字位置', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
    await importEditorJson(page, fixturePath('demoFlowchart'))
  })

  test('属性面板切换文字位置后，标题锚点与坐标随之变化', async ({ page }) => {
    const process = page.locator('svg g.node').filter({ hasText: '解析头' })
    await process.click()

    const title = process.locator('text.title').first()
    // 缺省居中
    await expect(title).toHaveAttribute('text-anchor', 'middle')

    const alignGrid = page.getByRole('group', { name: '文字位置' })
    await expect(alignGrid).toBeVisible()

    // 点「左上」：v=top, h=left → 按钮标题「上左」，锚点变为 start，x 靠左
    await alignGrid.getByRole('button', { name: '上左' }).click()
    await expect(title).toHaveAttribute('text-anchor', 'start')
    const x = Number(await title.getAttribute('x'))
    expect(x).toBeLessThan(20)

    // 点「右下」：v=bottom, h=right → 按钮标题「下右」，锚点 end，x 靠右
    await alignGrid.getByRole('button', { name: '下右' }).click()
    await expect(title).toHaveAttribute('text-anchor', 'end')
    const x2 = Number(await title.getAttribute('x'))
    expect(x2).toBeGreaterThan(x)
  })
})
