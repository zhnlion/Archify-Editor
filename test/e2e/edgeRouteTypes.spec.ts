import { expect, test, type Dialog, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptDialogs(page: Page) {
  page.on('dialog', async (dialog: Dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept()
    else if (dialog.type() === 'prompt') await dialog.accept(dialog.defaultValue() || 'flowchart')
    else await dialog.dismiss()
  })
}

async function importFlowchart(page: Page) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入' }).click()
  await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(fixturePath('demoFlowchart'))
}

/** 从「收包」南边端口拖到「解析头」，新建一条连线 */
async function connectFromPacketToParse(page: Page) {
  const src = page.locator('svg g.node').filter({ hasText: '收包' }).first()
  await src.click()
  const port = src.locator('.node-port').nth(2) // n,e,s,w -> s
  const box = await port.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return
  const target = page.locator('svg g.node').filter({ hasText: '解析头' }).first()
  const tb = await target.boundingBox()
  expect(tb).toBeTruthy()
  if (!tb) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 12 })
  await page.mouse.up()
}

test.describe('连线样式与吸附光点', () => {
  test.beforeEach(async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/')
    await importFlowchart(page)
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
  })

  test('连线样式切换直线后新建连线为直线路由', async ({ page }) => {
    const toggle = page.getByRole('group', { name: '连线样式' })
    await expect(toggle).toBeVisible()
    // 默认是折线
    await expect(toggle.getByRole('button', { name: '折线' })).toHaveAttribute('aria-pressed', 'true')
    await toggle.getByRole('button', { name: '直线' }).click()
    await expect(toggle.getByRole('button', { name: '直线' })).toHaveAttribute('aria-pressed', 'true')

    const edgesBefore = await page.locator('svg g.edge').count()
    await connectFromPacketToParse(page)

    await expect(page.locator('svg g.edge')).toHaveCount(edgesBefore + 1)
    // 直线路由：edge-line 的 d 只有一段 M..L（一个 L），折线会有多个 L
    const newEdgeD = await page.locator('svg g.edge').last().locator('path.edge-line').getAttribute('d')
    const lCount = (newEdgeD?.match(/L/g) ?? []).length
    expect(lCount).toBe(1)
  })

  test('连线样式切换曲线后新建连线为曲线路由', async ({ page }) => {
    const toggle = page.getByRole('group', { name: '连线样式' })
    await toggle.getByRole('button', { name: '曲线' }).click()
    await expect(toggle.getByRole('button', { name: '曲线' })).toHaveAttribute('aria-pressed', 'true')

    const edgesBefore = await page.locator('svg g.edge').count()
    await connectFromPacketToParse(page)
    await expect(page.locator('svg g.edge')).toHaveCount(edgesBefore + 1)
    const newEdgeD = await page.locator('svg g.edge').last().locator('path.edge-line').getAttribute('d')
    expect(newEdgeD).toContain('C')
  })

  test('选中已有连线后切换样式立即应用', async ({ page }) => {
    const toggle = page.getByRole('group', { name: '连线样式' })
    const edge = page.locator('svg g.edge').filter({ hasText: '是' }).first()
    await edge.click()
    await toggle.getByRole('button', { name: '直线' }).click()
    const d = await edge.locator('path.edge-line').getAttribute('d')
    expect((d?.match(/L/g) ?? []).length).toBe(1)
  })

  test('拖线经过目标框显示每边多个候选光点且最近点高亮', async ({ page }) => {
    const src = page.locator('svg g.node').filter({ hasText: '收包' }).first()
    await src.click()
    const port = src.locator('.node-port').nth(1) // e
    const box = await port.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return
    const target = page.locator('svg g.node').filter({ hasText: '解析头' }).first()
    const tb = await target.boundingBox()
    expect(tb).toBeTruthy()
    if (!tb) return

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    // 停在目标框顶边附近，触发 hover 吸附点
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height * 0.2, { steps: 10 })
    await expect(page.locator('circle.snap-anchor')).toHaveCount(12)
    await expect(page.locator('circle.snap-anchor.nearest')).toHaveCount(1)
    await page.mouse.up()
    await expect(page.locator('circle.snap-anchor')).toHaveCount(0)
  })
})
