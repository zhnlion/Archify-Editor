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

async function importFlowchart(page: Page) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入' }).click()
  await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(fixturePath('demoFlowchart'))
}

test.describe('注释与续形', () => {
  test.beforeEach(async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/')
    await importFlowchart(page)
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
  })

  test('Palette 可插入注释与文本框', async ({ page }) => {
    await page.getByRole('button', { name: '注释' }).click()
    await expect(page.locator('footer.status')).toContainText(/已插入 note/)
    await page.getByRole('button', { name: '文本框' }).click()
    await expect(page.locator('footer.status')).toContainText(/已插入 text/)
    await expect(page.locator('footer.status')).toContainText(/nodes \d+/)
  })

  test('边柄拖到空白处落过程形并连线', async ({ page }) => {
    // demo.flowchart.json 起点标签是「收包」，不是「开始」
    const node = page.locator('svg g.node').filter({ hasText: '收包' }).first()
    await expect(node).toBeVisible()
    await node.click()
    const port = node.locator('.node-port').nth(1)
    await expect(port).toBeVisible()
    const box = await port.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return
    const before = await page.locator('footer.status').innerText()
    const nodesBefore = /nodes\s+(\d+)/.exec(before)?.[1]
    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // 向右拖出足够距离（≥28 世界坐标）落到空白，避免点在邻接节点上
    await page.mouse.move(startX + 220, startY, { steps: 12 })
    await page.mouse.up()
    await expect(page.locator('footer.status')).toContainText(/续形/)
    if (nodesBefore) {
      await expect(page.locator('footer.status')).toContainText(new RegExp(`nodes\\s+${Number(nodesBefore) + 1}`))
    }
    await expect(page.locator('svg g.node').filter({ hasText: '过程' }).first()).toBeVisible()
  })
})

