import { expect, test, type Dialog, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fixturePath, fixtureText } from '../helpers/fixtures'

async function openImportMenu(page: Page) {
  await page.getByRole('button', { name: '导入' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  // 几何可见：避免仅靠 a11y 漏检 topbar overflow 裁切
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThan(120)
}

async function importFile(page: Page, menuLabel: RegExp, filePath: string) {
  const chooserPromise = page.waitForEvent('filechooser')
  await openImportMenu(page)
  await page.getByRole('menuitem', { name: menuLabel }).click()
  const chooser = await chooserPromise
  await chooser.setFiles(filePath)
}

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

function statusBar(page: Page) {
  return page.locator('footer.status')
}

test.describe('导入 e2e', () => {
  test.beforeEach(async ({ page }) => {
    acceptConfirms(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: '导入' })).toBeVisible()
  })

  test('本编辑器 JSON：flowchart', async ({ page }) => {
    await importFile(page, /本编辑器 JSON/, fixturePath('demoFlowchart'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText('已导入 demo.flowchart.json')
    await expect(statusBar(page)).toContainText(/nodes 6 \/ edges 5/)
  })

  test('同类型再次导入按文件恢复排版（拖动后重导入回到原始坐标）', async ({ page }) => {
    const node = page.locator('svg g.node').filter({ hasText: '收包' }).first()
    const transform = () => node.getAttribute('transform')

    await importFile(page, /本编辑器 JSON/, fixturePath('demoFlowchart'))
    await expect(transform()).resolves.toBe('translate(80, 40)')

    // 手动把「收包」拖到别处
    const box = (await node.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 40, { steps: 8 })
    await page.mouse.up()
    await expect(transform()).resolves.not.toBe('translate(80, 40)')

    // 再次导入同一历史 JSON：应完全按文件恢复到原始坐标
    await importFile(page, /本编辑器 JSON/, fixturePath('demoFlowchart'))
    await expect(transform()).resolves.toBe('translate(80, 40)')
  })

  test('历史导出文件重叠坐标：重导入保持文件中的坐标不变', async ({ page }) => {
    const node = (label: string) => page.locator('svg g.node').filter({ hasText: label }).first()
    const expected = ['translate(120, 100)', 'translate(140, 120)', 'translate(1080, 640)']

    await importFile(page, /本编辑器 JSON/, fixturePath('historicalOverlap'))
    await expect(node('甲')).toHaveAttribute('transform', expected[0]!)
    await expect(node('乙')).toHaveAttribute('transform', expected[1]!)
    await expect(node('丙')).toHaveAttribute('transform', expected[2]!)

    // 手动拖动后再导入同一历史文件，仍应逐点回到文件坐标
    const box = (await node('乙').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 8 })
    await page.mouse.up()
    await expect(node('乙')).not.toHaveAttribute('transform', expected[1]!)

    await importFile(page, /本编辑器 JSON/, fixturePath('historicalOverlap'))
    await expect(node('甲')).toHaveAttribute('transform', expected[0]!)
    await expect(node('乙')).toHaveAttribute('transform', expected[1]!)
    await expect(node('丙')).toHaveAttribute('transform', expected[2]!)
  })

  test('Archify architecture JSON', async ({ page }) => {
    await importFile(page, /Archify architecture/, fixturePath('demoArchitecture'))
    await expect(page.getByRole('combobox').first()).toHaveValue('architecture')
    await expect(statusBar(page)).toContainText('已导入 demo.architecture.json')
    await expect(statusBar(page)).toContainText(/nodes \d+ \/ edges/)
  })

  test('Archify workflow → flowchart 投影', async ({ page }) => {
    await importFile(page, /Archify workflow/, fixturePath('agentWorkflow'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText('已导入 agent-tool-call.workflow.json')
    await expect(statusBar(page)).toContainText('已从 Archify workflow 转换')
    await expect(statusBar(page)).toContainText(/nodes \d+ \/ edges/)
  })

  test('Mermaid 流程图文件', async ({ page }) => {
    await importFile(page, /^Mermaid/, fixturePath('simpleMermaid'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText('已导入 simple.mmd')
    await expect(statusBar(page)).toContainText('已从 Mermaid 转换')
    await expect(statusBar(page)).toContainText(/nodes 6 \/ edges 5/)
  })

  test('Mermaid 复杂流程图：所有形状和并行目标均导入', async ({ page }) => {
    await importFile(page, /^Mermaid/, fixturePath('complexMermaid'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText(/nodes 13 \/ edges 14/)
    await expect(page.locator('svg g.node')).toHaveCount(13)
  })

  test('压缩 draw.io 可解码并导入', async ({ page }) => {
    await importFile(page, /^draw\.io/, fixturePath('compressedDrawio'))
    await expect(statusBar(page)).toContainText(/已导入 compressed\.drawio|已从 draw\.io/)
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
  })

  test('无法解码的压缩 draw.io 提示另存未压缩', async ({ page }) => {
    await importFile(page, /^draw\.io/, fixturePath('compressedBrokenDrawio'))
    await expect(statusBar(page)).toContainText(/未压缩/)
  })

  test('draw.io 子集 → flowchart', async ({ page }) => {
    await importFile(page, /^draw\.io/, fixturePath('subsetDrawio'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText('已导入 subset.drawio')
    await expect(statusBar(page)).toContainText('已从 draw.io 子集转换')
  })

  test('粘贴 JSON：architecture', async ({ page }) => {
    const json = fixtureText('demoArchitecture')

    page.removeAllListeners('dialog')
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        await dialog.accept(json)
        return
      }
      if (dialog.type() === 'confirm') {
        await dialog.accept()
        return
      }
      await dialog.dismiss()
    })

    await openImportMenu(page)
    await page.getByRole('menuitem', { name: /粘贴 JSON/ }).click()
    await expect(page.getByRole('combobox').first()).toHaveValue('architecture')
    await expect(statusBar(page)).toContainText('已导入 剪贴板')
  })

  test('自动识别 workflow JSON', async ({ page }) => {
    await importFile(page, /自动识别/, fixturePath('agentWorkflow'))
    await expect(page.getByRole('combobox').first()).toHaveValue('flowchart')
    await expect(statusBar(page)).toContainText('已从 Archify workflow 转换')
  })

  test('夹具可读（回归：helpers 与磁盘一致）', () => {
    expect(readFileSync(fixturePath('demoFlowchart'), 'utf8')).toContain('flowchart')
    expect(fixtureText('simpleMermaid')).toContain('flowchart TD')
  })
})
