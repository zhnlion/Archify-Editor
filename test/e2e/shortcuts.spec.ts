import { expect, test } from '@playwright/test'

test.describe('快捷键帮助浮层', () => {
  test('顶栏按钮与 ? 可打开关闭', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '快捷键' }).click()
    const dialog = page.getByRole('dialog', { name: '快捷键一览' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('微调')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    await page.keyboard.press('F1')
    await expect(page.getByRole('dialog', { name: '快捷键一览' })).toBeVisible()
    await page.getByRole('button', { name: '关闭' }).click()
    await expect(page.getByRole('dialog', { name: '快捷键一览' })).toHaveCount(0)
  })
})
