# 导入 / 导出 / 转换 — 可验证测试矩阵

> 对应 F-14 / F-15 / F-16 / F-17 / F-19 / F-21；门禁：`npm test`（`test/unit/io/ioMatrix.test.ts` + 既有 Codec 测）与 `npm run test:e2e`。  
> 用例 ID 稳定；改 Codec 时先补夹具再改行为。  
> 测试归档：[`../test/README.md`](../test/README.md)

## 夹具一览（SSOT：`test/fixtures/`）

| 夹具 | 路径 | FixtureId | 用途 |
|------|------|-----------|------|
| 本编辑器 flowchart | `test/fixtures/demo.flowchart.json` | `demoFlowchart` | 原生往返 |
| 纵向泳道 flowchart | `test/fixtures/demo.vertical-swimlane.flowchart.json` | `demoVerticalSwimlane` | 泳道 CRUD / 边格式刷 e2e |
| 本编辑器 architecture | `test/fixtures/demo.architecture.json` | `demoArchitecture` | 原生往返 |
| Archify workflow | `test/fixtures/agent-tool-call.workflow.json` | `agentWorkflow` | F-21 投影 / finalize 合并 |
| 嵌套 boundary + 非法 pad* | `test/fixtures/nested-boundaries.architecture.json` | `nestedBoundaries` | 导入 enrich + 导出剥离 |
| Mermaid 文本 | `test/fixtures/simple.mmd` | `simpleMermaid` | F-08 导入 |
| Mermaid C4 | `test/fixtures/simple-c4.mmd` | `simpleC4Mermaid` | F-08 C4→architecture |
| draw.io 子集 | `test/fixtures/subset.drawio` | `subsetDrawio` | F-09 / F-18 |
| draw.io 压缩（可解码） | `test/fixtures/compressed.drawio` | `compressedDrawio` | F-09 压缩导入 |
| draw.io 压缩损坏 | `test/fixtures/compressedBroken.drawio` | `compressedBrokenDrawio` | F-09 拒收引导 |
| 偶发 ANSI 扩形 | `test/fixtures/extended-shapes.flowchart.json` | `extendedShapes` | offpage/merge/multi_document |
| layered + cards | `test/fixtures/layered-cards.architecture.json` | `layeredCards` | 跨层规则 / 画布 cards |

加载：`import { fixtureText, fixtureJson, fixturePath } from '../helpers/fixtures'`（相对 `test/unit|e2e`）。

## TC-IMP — 导入（先选类型）

| ID | 选择类型 | 输入 | 期望 | 自动化 |
|----|----------|------|------|--------|
| TC-IMP-01 | `auto` | `demo.flowchart.json` | `diagram_type=flowchart`，标题保留 | ✅ unit + e2e |
| TC-IMP-02 | `auto` | `demo.architecture.json` | `diagram_type=architecture` | ✅ unit + e2e |
| TC-IMP-03 | `auto` | `agent-tool-call.workflow.json` | 投影为 flowchart；`format_hints.source=archify`；保留 `meta.editor.archify_workflow` | ✅ unit + e2e |
| TC-IMP-04 | `editor-json` | flowchart / architecture | 成功；workflow 被拒绝 | ✅ |
| TC-IMP-05 | `archify-architecture` | architecture JSON | 成功；workflow / flowchart 拒绝 | ✅ |
| TC-IMP-06 | `archify-workflow` | workflow JSON | 成功→flowchart；architecture 拒绝 | ✅ |
| TC-IMP-07 | `mermaid` | `simple.mmd` | flowchart；边标签「是/否」可读；`source=mermaid` | ✅ unit + e2e |
| TC-IMP-08 | `archify-architecture` | `nested-boundaries…` | 嵌套 pad 外层>内层；enrich 后均有 `pad`（分侧 pad* 可留编辑态） | ✅ |
| TC-IMP-09 | `drawio` | `subset.drawio` | 子集：矩形/菱形/边；厂商图标丢弃并提示 | ✅ unit + e2e |
| TC-IMP-10 | `drawio` | `compressed.drawio` | 解码压缩载荷并导入子集节点 | ✅ unit + e2e |
| TC-IMP-10b | `drawio` | `compressedBroken.drawio` | 无法解码时拒收；文案含「未压缩」与 Export as 引导 | ✅ unit + e2e |
| TC-IMP-11 | `mermaid` | `simple-c4.mmd` | `architecture`；有损 toast/dropped | ✅ unit |

## TC-EXP — 导出（先选格式）

| ID | 当前图 | 导出格式 | 期望 | 自动化 |
|----|--------|----------|------|--------|
| TC-EXP-01 | flowchart | 本编辑器 JSON | 可再 `openDocument`；类型不变 | ✅ |
| TC-EXP-02 | architecture | 本编辑器 JSON | 可再打开；可含 `meta.editor` | ✅ |
| TC-EXP-03 | architecture | Archify JSON | 无 `meta.editor` / `style` / `padBottom`；仅 `pad` | ✅ |
| TC-EXP-04 | flowchart（自 workflow 导入） | Archify workflow JSON | `fromSource=true`；lanes/phases 保留 | ✅ |
| TC-EXP-05 | flowchart（原生） | Archify workflow JSON | 合成 workflow；同 lane 内 col 唯一 | ✅ |
| TC-EXP-06 | flowchart | Mermaid `.mmd` | 含 `flowchart TD`、节点与边标签 | ✅ |
| TC-EXP-07 | architecture | Mermaid `.mmd` | 有损 `flowchart LR`；组件+连线在 | ✅ |
| TC-EXP-08 | 任一 | HTML | Bridge finalize（需 CLI）；CI 可选 | 手册 / 本地 |
| TC-EXP-09 | 任一 | SVG / PNG | 画布快照（需 DOM） | 手册 |
| TC-EXP-09b | 任一 | JPEG / WebP | 不透明底 + 质量钳制；`opaqueRasterFill` / `rasterQuality` unit | ✅ unit |
| TC-EXP-10 | 任一 | draw.io | 导出后可再导入；拓扑可读 | ✅ |

## TC-X — 类型转换 / 往返

| ID | 路径 | 期望 | 自动化 |
|----|------|------|--------|
| TC-X-01 | workflow → flowchart → workflow（merge） | 节点 id 集合 ⊆ 源；文案合并生效 | ✅ |
| TC-X-02 | flowchart → mermaid → flowchart | 节点数/边数一致；关键边标签保留 | ✅ |
| TC-X-07 | Mermaid 再导入合并几何 | 改过的 `pos`/`via`/锚点按 id 保留（F-22） | ✅ |
| TC-X-03 | architecture → strip → 再 parse | 仍为 architecture；无私有键 | ✅ |
| TC-X-04 | nested architecture → enrich → strip | finalize 载荷可过 schema 字段白名单（无 padBottom） | ✅ |
| TC-X-05 | flowchart ↔ architecture | **禁止**静默互转；仅用户切换编辑器类型 | ✅（负向：Codec 不自动转换） |
| TC-X-06 | workflow 误当 architecture 导入 | `TypeMismatch` | ✅ |

## 门禁命令

```bash
npm test
npm run test:e2e
npm run build
```

聚焦本矩阵：

```bash
npx vitest run test/unit/io/ioMatrix.test.ts
```
