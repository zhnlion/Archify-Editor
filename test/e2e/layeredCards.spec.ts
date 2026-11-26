import { expect, test } from '@playwright/test'
import { fixturePath, fixtureText } from '../helpers/fixtures'

test.describe('layered 跨层规则与画布 cards', () => {
  test('导入分层夹具：摘要卡可见；开启规则后违规边高亮', async ({ page }) => {
    const raw = JSON.parse(fixtureText('layeredCards')) as {
      cards: unknown[]
      connections: Array<{ id: string }>
    }

    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') await d.accept()
      else await d.dismiss()
    })
    await page.goto('/')

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '导入' }).click()
    await page.getByRole('menuitem', { name: /Archify architecture/ }).click()
    await (await chooserPromise).setFiles(fixturePath('layeredCards'))

    await expect(page.locator('footer.status')).toContainText(/已导入/)
    await expect(page.locator('select.type-select').first()).toHaveValue('layered')
    await expect(page.locator('.arch-cards .arch-card')).toHaveCount(raw.cards.length)

    await expect(page.getByLabel('跨层连线规则')).toHaveValue('downward')
    await expect(page.locator('svg g.edge[data-layer-violation="1"]')).toHaveCount(1)

    await page.getByRole('button', { name: '+ 卡' }).click()
    await expect(page.locator('.arch-cards .arch-card')).toHaveCount(raw.cards.length + 1)
  })
})
