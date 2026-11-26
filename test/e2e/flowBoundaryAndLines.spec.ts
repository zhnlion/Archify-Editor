import { expect, test, type Dialog, type Page } from '@playwright/test'
import { fixturePath } from '../helpers/fixtures'

function acceptDialogs(page: Page) {
  page.on('dialog', async (dialog: Dialog) => {
    if (dialog.type() === 'confirm') await dialog.accept()
    else if (dialog.type() === 'prompt') await dialog.accept(dialog.defaultValue() || 'flowchart')
    else await dialog.dismiss()
  })
}

function paletteTile(page: Page, label: string) {
  return page.locator('aside.palette .palette-tile').filter({ hasText: label }).first()
}

function drawHint(page: Page) {
  return page.locator('.line-style .draw-hint')
}

async function dragOnCanvas(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator('svg.canvas-svg').boundingBox())!
  await page.mouse.move(box.x + from[0], box.y + from[1])
  await page.mouse.down()
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 10 })
  await page.mouse.up()
}

/** 模拟把符号库图块拖到画布指定位置（HTML5 拖放） */
async function dropTile(page: Page, label: string, at: [number, number]) {
  const svg = page.locator('svg.canvas-svg')
  const box = (await svg.boundingBox())!
  const dt = await page.evaluateHandle(() => new DataTransfer())
  await paletteTile(page, label).dispatchEvent('dragstart', { dataTransfer: dt })
  await svg.dispatchEvent('drop', {
    dataTransfer: dt,
    clientX: box.x + at[0],
    clientY: box.y + at[1],
  })
}

async function importFlowchart(page: Page) {
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '导入' }).click()
  await page.getByRole('menuitem', { name: /本编辑器 JSON/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(fixturePath('demoFlowchart'))
}

test.describe('符号库容器与连线', () => {
  test.beforeEach(async ({ page }) => {
    acceptDialogs(page)
    await page.goto('/')
    await page.getByRole('button', { name: '新建流程' }).click()
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
  })

  test('符号库区域框：点击后在画布拖拽绘制，可重命名', async ({ page }) => {
    await expect(page.locator('svg g.boundary')).toHaveCount(0)
    await paletteTile(page, '区域框').click()
    await expect(drawHint(page)).toContainText('拖拽绘制')

    await dragOnCanvas(page, [320, 160], [560, 300])
    await expect(page.locator('svg g.boundary')).toHaveCount(1)
    await expect(drawHint(page)).toHaveCount(0)
    const rect = page.locator('svg g.boundary rect.boundary-rect')
    expect(Number(await rect.getAttribute('width'))).toBeGreaterThan(100)
    expect(Number(await rect.getAttribute('height'))).toBeGreaterThan(80)

    await page.locator('aside label:text-is("名称") + input').fill('审批区')
    await expect(page.locator('svg g.boundary text').first()).toHaveText('审批区')
  })

  test('符号库区域框：拖到画布生成默认尺寸区域框', async ({ page }) => {
    await expect(page.locator('svg g.boundary')).toHaveCount(0)
    await dropTile(page, '区域框', [620, 420])
    await expect(page.locator('svg g.boundary')).toHaveCount(1)
    const rect = page.locator('svg g.boundary rect.boundary-rect')
    expect(Number(await rect.getAttribute('width'))).toBe(320)
    expect(Number(await rect.getAttribute('height'))).toBe(200)
  })

  test('符号库直线：点击后拖拽放置独立直线，删除生效', async ({ page }) => {
    await paletteTile(page, '直线').click()
    await expect(drawHint(page)).toContainText('拖拽绘制')
    await dragOnCanvas(page, [300, 220], [520, 220])
    await expect(page.locator('svg g.standalone-line')).toHaveCount(1)
    const d = await page.locator('svg g.standalone-line path.edge-line').getAttribute('d')
    expect((d?.match(/L/g) ?? []).length).toBe(1)

    const hit = (await page.locator('svg g.standalone-line path.edge-hit').boundingBox())!
    await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2)
    await page.keyboard.press('Delete')
    await expect(page.locator('svg g.standalone-line')).toHaveCount(0)
  })

  test('符号库折线：拖拽生成正交折线，端点可拖动改形', async ({ page }) => {
    await paletteTile(page, '折线').click()
    await dragOnCanvas(page, [300, 320], [540, 440])
    await expect(page.locator('svg g.standalone-line')).toHaveCount(1)
    const path = page.locator('svg g.standalone-line path.edge-line')
    const before = await path.getAttribute('d')
    expect((before?.match(/L/g) ?? []).length).toBe(3)

    const handle = (await page.locator('svg circle.line-point-handle').first().boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 - 60, handle.y + handle.height / 2 - 40, { steps: 8 })
    await page.mouse.up()
    const after = await path.getAttribute('d')
    expect(after).not.toBe(before)
  })

  test('符号库曲线：拖拽生成曲线独立线', async ({ page }) => {
    await paletteTile(page, '曲线').click()
    await dragOnCanvas(page, [300, 300], [560, 420])
    await expect(page.locator('svg g.standalone-line')).toHaveCount(1)
    const d = await page.locator('svg g.standalone-line path.edge-line').getAttribute('d')
    expect(d).toContain('C')
  })

  test('符号库直线：拖到画布直接放置', async ({ page }) => {
    await dropTile(page, '直线', [640, 380])
    await expect(page.locator('svg g.standalone-line')).toHaveCount(1)
    const d = await page.locator('svg g.standalone-line path.edge-line').getAttribute('d')
    expect((d?.match(/L/g) ?? []).length).toBe(1)
  })

  test('选中节点后右键可为流程图新建包裹区域框', async ({ page }) => {
    await importFlowchart(page)
    await expect(page.locator('svg g.node')).toHaveCount(6)
    await page.keyboard.press('Control+a')
    const box = (await page.locator('svg.canvas-svg').boundingBox())!
    // 可见空白区域（不能取 SVG 右下角：世界尺寸 2600×2000，大部分在视口外）
    await page.mouse.click(box.x + 700, box.y + 560, { button: 'right' })
    await page.getByRole('button', { name: /新建区域框/ }).click()
    await expect(page.locator('svg g.boundary')).toHaveCount(1)
    await expect(page.locator('svg g.boundary text').first()).toHaveText('新区域')
  })
})
