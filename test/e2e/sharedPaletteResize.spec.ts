import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptConfirms(page: Page) {
  page.on('dialog', async (dialog: Dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept()
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

async function paletteSnapshot(page: Page) {
  return {
    groups: await page.locator('.palette-group-title').allTextContents(),
    shapes: await page.locator('.palette-tile > span').allTextContents(),
  }
}

async function dragHandle(page: Page, handle: Locator, dx: number, dy: number) {
  const box = await handle.boundingBox()
  if (!box) throw new Error('resize handle has no bounding box')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
}

async function insertProcessAndResize(page: Page) {
  await page
    .locator('.palette-tile')
    .filter({ has: page.getByText('过程', { exact: true }) })
    .click()

  const node = page.locator('svg g.node.selected')
  await expect(node).toHaveCount(1)
  const box = node.locator('.box').first()
  await expect(box).toBeVisible()

  const before = await box.boundingBox()
  if (!before) throw new Error('process box has no bounding box')

  await dragHandle(page, node.locator('.handle').nth(4), 70, 0)
  const wider = await box.boundingBox()
  if (!wider) throw new Error('resized process box has no bounding box')
  expect(wider.width).toBeGreaterThan(before.width + 50)
  expect(Math.abs(wider.height - before.height)).toBeLessThan(2)

  await dragHandle(page, node.locator('.handle').nth(6), 0, 40)
  const taller = await box.boundingBox()
  if (!taller) throw new Error('height-resized process box has no bounding box')
  expect(taller.height).toBeGreaterThan(wider.height + 25)
  expect(Math.abs(taller.width - wider.width)).toBeLessThan(2)
}

test.describe('统一符号库与过程框缩放', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('架构图与流程图符号库一致，过程框均可独立拉宽拉高', async ({ page }) => {
    const architecturePalette = await paletteSnapshot(page)

    await importEditorJson(page, fixturePath('demoFlowchart'))
    await expect(page.locator('footer.status')).toContainText(/nodes 6/)
    const flowchartPalette = await paletteSnapshot(page)
    expect(flowchartPalette).toEqual(architecturePalette)

    await insertProcessAndResize(page)

    await importEditorJson(page, fixturePath('demoArchitecture'))
    await expect(page.locator('footer.status')).toContainText(/nodes 5/)
    expect(await paletteSnapshot(page)).toEqual(architecturePalette)

    await insertProcessAndResize(page)
    const shapeSelect = page
      .locator('.inspector label', { hasText: /^框体形状$/ })
      .locator('xpath=following-sibling::select[1]')
    await expect(shapeSelect).toHaveValue('process')
  })
})
