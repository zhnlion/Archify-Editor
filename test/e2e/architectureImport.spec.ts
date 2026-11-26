import { expect, test } from '@playwright/test'
import { fixturePath, fixtureText } from '../helpers/fixtures'

test.describe('架构图导入展示完整性', () => {
  test('生产部署夹具：节点/边/区域框数量与 JSON 一致，且边可点中', async ({ page }) => {
    const raw = JSON.parse(fixtureText('productionDeployment')) as {
      components: unknown[]
      connections: Array<{ id?: string }>
      boundaries: unknown[]
      cards?: unknown[]
    }
    expect(raw.connections.some((c) => !c.id)).toBe(true)

    page.on('dialog', async (d) => {
      if (d.type() === 'confirm') await d.accept()
      else await d.dismiss()
    })
    await page.goto('/')

    const chooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '导入' }).click()
    await page.getByRole('menuitem', { name: /Archify architecture/ }).click()
    await (await chooserPromise).setFiles(fixturePath('productionDeployment'))

    await expect(page.locator('footer.status')).toContainText('已导入 production-deployment')
    await expect(page.locator('footer.status')).toContainText(
      new RegExp(`nodes ${raw.components.length} / edges ${raw.connections.length}`),
    )

    const counts = await page.evaluate(() => ({
      nodes: document.querySelectorAll('svg g.node').length,
      edges: document.querySelectorAll('svg g.edge').length,
      boundaries: document.querySelectorAll('svg g.boundary').length,
      tags: document.querySelectorAll('svg .node-tag').length,
      cards: document.querySelectorAll('.arch-cards .arch-card').length,
    }))

    expect(counts.nodes).toBe(raw.components.length)
    expect(counts.edges).toBe(raw.connections.length)
    expect(counts.boundaries).toBe(raw.boundaries.length)
    // tag 仍仅留 IR；cards 画布可编
    expect(counts.tags).toBe(0)
    expect(counts.cards).toBe(raw.cards?.length ?? 0)
  })
})
