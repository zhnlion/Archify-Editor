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

function parseTranslate(transform: string | null): { x: number; y: number } {
  const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(transform ?? '')
  if (!m) throw new Error(`no translate in ${transform}`)
  return { x: Number(m[1]), y: Number(m[2]) }
}

async function nodeTranslate(page: Page, label: string) {
  const g = page.locator('svg g.node').filter({ hasText: label }).first()
  return parseTranslate(await g.getAttribute('transform'))
}

test.describe('方向键多选微调', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('Ctrl+A 后方向键整组平移；Shift 为大步', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await expect(page.locator('footer.status')).toContainText(/nodes 6/)

    await page.locator('.canvas-scroll').click({ position: { x: 16, y: 16 } })
    await page.keyboard.press('Control+a')
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(/已选 6 个图形/)

    const beforeA = await nodeTranslate(page, '收包')
    const beforeB = await nodeTranslate(page, '丢弃')

    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await nodeTranslate(page, '收包')).x).toBe(beforeA.x + 1)
    expect(await nodeTranslate(page, '丢弃')).toEqual({ x: beforeB.x + 1, y: beforeB.y })

    const midA = await nodeTranslate(page, '收包')
    const midB = await nodeTranslate(page, '丢弃')
    await page.keyboard.press('Shift+ArrowDown')
    await expect.poll(async () => (await nodeTranslate(page, '收包')).y).toBe(midA.y + 10)
    expect(await nodeTranslate(page, '丢弃')).toEqual({ x: midB.x, y: midB.y + 10 })
  })

  test('选中区域框后方向键平移 wraps（对齐鼠标拖 boundary）', async ({ page }) => {
    await importEditorJson(page, fixturePath('nestedBoundaries'))
    await expect(page.locator('footer.status')).toContainText(/architecture/)

    await page.locator('.canvas-scroll').click({ position: { x: 16, y: 16 } })
    // 节点叠在区域框之上：点选框体底部留白（padBottom），避免点到 DB 节点
    const boundary = page.locator('svg g.boundary').filter({ hasText: '基础设施底座' })
    const box = await boundary.boundingBox()
    expect(box).toBeTruthy()
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 6)
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(/区域框/)

    const beforeDb = await nodeTranslate(page, 'DB')
    const beforeWeb = await nodeTranslate(page, 'Web')

    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await nodeTranslate(page, 'DB')).x).toBe(beforeDb.x + 1)
    // 未包裹的 Web 不应移动
    expect(await nodeTranslate(page, 'Web')).toEqual(beforeWeb)
  })
})
