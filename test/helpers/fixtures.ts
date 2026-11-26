/**
 * 共享黄金夹具加载 — unit / e2e / 矩阵共用。
 * 权威路径：test/fixtures/
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** 仓库根目录（archify-editor/） */
export const repoRoot = join(here, '../..')

/** 夹具目录 test/fixtures/ */
export const fixturesDir = join(here, '../fixtures')

/** 稳定夹具 ID（与 docs/TEST-MATRIX.md 对齐） */
export const FIXTURES = {
  demoFlowchart: 'demo.flowchart.json',
  historicalOverlap: 'historical-overlap.flowchart.json',
  demoVerticalSwimlane: 'demo.vertical-swimlane.flowchart.json',
  demoArchitecture: 'demo.architecture.json',
  agentWorkflow: 'agent-tool-call.workflow.json',
  nestedBoundaries: 'nested-boundaries.architecture.json',
  productionDeployment: 'production-deployment.architecture.json',
  simpleMermaid: 'simple.mmd',
  simpleC4Mermaid: 'simple-c4.mmd',
  complexMermaid: 'complex.mmd',
  subsetDrawio: 'subset.drawio',
  compressedDrawio: 'compressed.drawio',
  compressedBrokenDrawio: 'compressedBroken.drawio',
  extendedShapes: 'extended-shapes.flowchart.json',
  layeredCards: 'layered-cards.architecture.json',
  controlPlaneArchitecture: 'control-plane.architecture.json',
} as const

export type FixtureId = keyof typeof FIXTURES

export function fixturePath(idOrFile: FixtureId | string): string {
  const file = idOrFile in FIXTURES ? FIXTURES[idOrFile as FixtureId] : idOrFile
  return join(fixturesDir, file)
}

export function fixtureText(idOrFile: FixtureId | string): string {
  return readFileSync(fixturePath(idOrFile), 'utf8')
}

export function fixtureJson<T = unknown>(idOrFile: FixtureId | string): T {
  return JSON.parse(fixtureText(idOrFile)) as T
}
