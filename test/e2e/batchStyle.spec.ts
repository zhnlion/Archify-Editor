import { expect, test, type Dialog, type Locator, type Page } from '@playwright/test'
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

async function ctrlASelectAll(page: Page, expectText: RegExp) {
  await page.locator('.canvas-scroll').click({ position: { x: 16, y: 16 } })
  await page.keyboard.press('Control+a')
  await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(expectText)
}

/** FontBorderControls：label 与控件为兄弟节点 */
function inspectorAfterLabel(page: Page, label: string, tag: 'input' | 'select') {
  return page.locator('.inspector label', { hasText: new RegExp(`^${label}$`) }).locator(`xpath=following-sibling::${tag}[1]`)
}

function colorTextInput(page: Page, label: string) {
  return page
    .locator('.inspector .color-picker')
    .filter({ has: page.locator('label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('.color-row input')
    .nth(1)
}

async function expectSolidStroke(box: Locator) {
  const dash = await box.getAttribute('stroke-dasharray')
  expect(dash == null || dash.trim() === '', `expected solid, got stroke-dasharray=${dash}`).toBe(true)
}

async function expectDashedStroke(box: Locator) {
  await expect(box).toHaveAttribute('stroke-dasharray', '6 4')
}

async function toggleDashRoundTrip(page: Page, statusRe: RegExp) {
  const lineType = inspectorAfterLabel(page, '边框线型', 'select')
  await lineType.selectOption('dash')
  await expect(page.locator('footer.status')).toContainText(statusRe)
  await lineType.selectOption('solid')
  await expect(page.locator('footer.status')).toContainText(statusRe)
  await lineType.selectOption('dash')
  await expect(page.locator('footer.status')).toContainText(statusRe)
}

test.describe('多选统一边框/字体', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('Ctrl+A 后字号/文字色/描边宽/虚线应用到全部流程图节点', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await expect(page.locator('footer.status')).toContainText(/nodes 6/)

    await ctrlASelectAll(page, /已选 6 个图形/)

    await inspectorAfterLabel(page, '标题字号', 'input').fill('22')
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形')

    await colorTextInput(page, '文字').fill('#DC2626')
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形')

    await inspectorAfterLabel(page, '描边宽度', 'input').fill('3.2')
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形')

    await toggleDashRoundTrip(page, /已统一修改 6 个图形/)

    await page.getByRole('button', { name: 'B', exact: true }).click()
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形')

    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    const nodes = page.locator('svg g.node')
    await expect(nodes).toHaveCount(6)

    for (let i = 0; i < 6; i++) {
      const node = nodes.nth(i)
      const box = node.locator('.box').first()
      await expect(box).toHaveAttribute('stroke-width', '3.2')
      await expectDashedStroke(box)
      const title = node.locator('text.title')
      await expect(title).toHaveCSS('font-size', '22px')
      await expect(title).toHaveCSS('font-weight', '700')
      await expect(title).toHaveAttribute('fill', '#DC2626')
    }
  })

  test('Ctrl+A 流程图：虚线→实线→虚线覆盖全部节点', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoFlowchart'))
    await ctrlASelectAll(page, /已选 6 个图形/)

    await toggleDashRoundTrip(page, /已统一修改 6 个图形/)
    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    const nodes = page.locator('svg g.node')
    await expect(nodes).toHaveCount(6)
    for (let i = 0; i < 6; i++) {
      await expectDashedStroke(nodes.nth(i).locator('.box').first())
    }

    await ctrlASelectAll(page, /已选 6 个图形/)
    await inspectorAfterLabel(page, '边框线型', 'select').selectOption('solid')
    await expect(page.locator('footer.status')).toContainText('已统一修改 6 个图形')
    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    for (let i = 0; i < 6; i++) {
      await expectSolidStroke(nodes.nth(i).locator('.box').first())
    }
  })

  test('Ctrl+A 架构图：节点+区域框同步填充/字号/描边/粗体/虚实线', async ({ page }) => {
    await importEditorJson(page, fixturePath('demoArchitecture'))
    await expect(page.locator('footer.status')).toContainText(/nodes 5/)

    await ctrlASelectAll(page, /已选 5 个图形/)

    await inspectorAfterLabel(page, '标题字号', 'input').fill('18')
    await expect(page.locator('footer.status')).toContainText(/已统一修改 5 个图形、1 个区域框/)

    await colorTextInput(page, '填充').fill('#FDE68A')
    await expect(page.locator('footer.status')).toContainText(/已统一修改 5 个图形、1 个区域框/)

    await inspectorAfterLabel(page, '描边宽度', 'input').fill('4')
    await expect(page.locator('footer.status')).toContainText(/已统一修改 5 个图形、1 个区域框/)

    await page.getByRole('button', { name: 'B', exact: true }).click()
    await expect(page.locator('footer.status')).toContainText(/已统一修改 5 个图形、1 个区域框/)

    await toggleDashRoundTrip(page, /已统一修改 5 个图形、1 个区域框/)

    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    const nodes = page.locator('svg g.node')
    await expect(nodes).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const node = nodes.nth(i)
      const box = node.locator('.box').first()
      await expect(box).toHaveAttribute('fill', '#FDE68A')
      await expect(box).toHaveAttribute('stroke-width', '4')
      await expectDashedStroke(box)
      await expect(node.locator('text.title')).toHaveCSS('font-size', '18px')
      await expect(node.locator('text.title')).toHaveCSS('font-weight', '700')
    }

    const boundary = page.locator('svg g.boundary').first()
    await expect(boundary.locator('rect').first()).toHaveAttribute('fill', '#FDE68A')
    await expect(boundary.locator('rect').first()).toHaveAttribute('stroke-width', '4')
    await expectDashedStroke(boundary.locator('rect').first())
    await expect(boundary.locator('text').first()).toHaveCSS('font-size', '18px')
    await expect(boundary.locator('text').first()).toHaveCSS('font-weight', '700')
    // 区域框标题无独立底色块，文字叠在框体填充上
    await expect(boundary.locator('.boundary-label-bg')).toHaveCount(0)

    await ctrlASelectAll(page, /已选 5 个图形/)
    await inspectorAfterLabel(page, '边框线型', 'select').selectOption('solid')
    await expect(page.locator('footer.status')).toContainText(/已统一修改 5 个图形、1 个区域框/)
    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    for (let i = 0; i < 5; i++) {
      await expectSolidStroke(nodes.nth(i).locator('.box').first())
    }
    await expectSolidStroke(boundary.locator('rect').first())
  })

  test('Ctrl+A 嵌套架构图：父框/子框与节点统一填充及实线', async ({ page }) => {
    await importEditorJson(page, fixturePath('nestedBoundaries'))
    await expect(page.locator('footer.status')).toContainText(/nodes 3/)

    await ctrlASelectAll(page, /已选 3 个图形/)
    await expect(page.locator('footer.status')).toContainText(/已全选 3 个组件、3 个区域框/)
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(
      '已选 3 个图形、3 个区域框',
    )
    await expect(page.locator('svg g.boundary.selected')).toHaveCount(3)
    await expect(page.locator('svg g.boundary.selected').first().locator('rect').first()).toHaveCSS(
      'stroke',
      'rgb(34, 211, 238)',
    )

    await colorTextInput(page, '填充').fill('#FDE68A')
    await expect(page.locator('footer.status')).toContainText(
      /已统一修改 3 个图形、3 个区域框/,
    )

    await inspectorAfterLabel(page, '边框线型', 'select').selectOption('solid')
    await expect(page.locator('footer.status')).toContainText(
      /已统一修改 3 个图形、3 个区域框/,
    )

    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })

    const nodes = page.locator('svg g.node')
    await expect(nodes).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const box = nodes.nth(i).locator('.box').first()
      await expect(box).toHaveAttribute('fill', '#FDE68A')
      await expectSolidStroke(box)
    }

    const boundaries = page.locator('svg g.boundary')
    await expect(boundaries).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const box = boundaries.nth(i).locator('rect').first()
      await expect(box).toHaveAttribute('fill', '#FDE68A')
      await expectSolidStroke(box)
    }
  })

  test('用户的控制面架构样例：Ctrl+A 明确选中区域框并统一为填充+实线', async ({ page }) => {
    await importEditorJson(page, fixturePath('controlPlaneArchitecture'))
    await expect(page.locator('footer.status')).toContainText(/nodes 2/)

    await page.locator('.canvas-scroll').click({ position: { x: 16, y: 16 } })
    await page.keyboard.press('Control+a')
    await expect(page.locator('.inspector input[readonly]').first()).toHaveValue(
      '已选 2 个图形、1 个区域框',
    )
    await expect(page.locator('svg g.boundary.selected')).toHaveCount(1)

    await colorTextInput(page, '填充').fill('#FFFFFF')
    await inspectorAfterLabel(page, '边框线型', 'select').selectOption('solid')
    await expect(page.locator('footer.status')).toContainText(
      /已统一修改 2 个图形、1 个区域框/,
    )

    await page.locator('.canvas-scroll').click({ position: { x: 8, y: 8 } })
    const boundary = page.locator('svg g.boundary').first().locator('rect').first()
    await expect(boundary).toHaveAttribute('fill', '#FFFFFF')
    await expectSolidStroke(boundary)
  })
})
