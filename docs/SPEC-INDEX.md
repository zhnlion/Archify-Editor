# 规格索引（AI 友好 / SGRM 裁剪）

> 本文件是 Agent 与人类的**规格入口**。权威细节仍在各子文档；此处只做 F/Q/K/Σ 导航与门禁。  
> 总案：[`DESIGN.md`](./DESIGN.md) · 能力摘要：[`CAPABILITIES.md`](./CAPABILITIES.md) · Agent：[`../AGENTS.md`](../AGENTS.md)  
> 内部对照笔记**不入库**（本地目录 `docs/personal/local-rea/`，见 `docs/personal/README.md`；`docs/personal/` 已被 `.gitignore`）。

## 四元组（项目裁剪）

| 符号 | 含义 | 本仓落点 |
|------|------|----------|
| **F** | 功能需求 | [`DESIGN.md`](./DESIGN.md) §3.3（F-01～F-25）；场景 §3.1；摘要 [`CAPABILITIES.md`](./CAPABILITIES.md) |
| **Q** | 质量属性 | [`DESIGN.md`](./DESIGN.md) §3.4（N-01～N-07）；[`DEPLOY.md`](./DEPLOY.md) |
| **K** | 约束与知识 | §3.6 不做；§11 与 Archify 边界；[`adr/`](./adr/)；外部 Archify schema 钉扎 |
| **Σ** | 可执行规格 | [`../schemas/`](../schemas/)；Codec 契约（DESIGN §12）；黄金夹具 + `npm test` |

## 必读顺序（改代码前）

1. 本索引（确认触及的 F / Σ）  
2. [`DESIGN.md`](./DESIGN.md) 对应章节（勿整篇吞读）  
3. 相关 ADR / 子方案  
4. 改 Codec / IR 时：先对齐 `schemas/*.schema.json`，再写实现与夹具测试  

## F → 文档切片

| ID | 摘要 | 主文档 |
|----|------|--------|
| F-20 | 主流格式导入导出目标 | DESIGN §3.0 |
| F-01～F-04 | 双类型编辑核心 | DESIGN §3.3；[`dual-type-editing-plan.md`](./dual-type-editing-plan.md) |
| F-05/F-06/F-16 | Archify HTML / JSON 导出 | DESIGN §3.5、§3.10、§4.2.4 |
| F-11/F-12/F-13 | 框体/颜色/日常编辑基线 | DESIGN §3.7、§3.8；[`EDITING-GAP.md`](./EDITING-GAP.md)；[`SYMBOL-COMPARE.md`](./SYMBOL-COMPARE.md)；色标见 F-23；主题分层见 [`CAPABILITIES.md`](./CAPABILITIES.md) |
| F-14/F-21 | Archify architecture + **workflow 导入** | DESIGN §3.9、§3.9.1 |
| F-08/F-15/F-17 | Mermaid 进出 + 统一导入 | DESIGN §3.9、§3.10 |
| F-09/F-18 | draw.io 子集进出（互换格式） | DESIGN §3.9、§3.10、§3.11（**P0**） |
| F-22～F-25 | 空坐标布局与几何合并、命名色标、判断默认是/否、架构拐点与 boundary 成员 | DESIGN §3.11；[`AI-DIAGRAM-TREND.md`](./AI-DIAGRAM-TREND.md) |
| F-07/F-10/F-19 | SVG/PNG/JPEG + 导出菜单 | DESIGN §3.5、§3.10 |

## Σ — 机器可读契约

| 契约 | 路径 | 说明 |
|------|------|------|
| Flowchart IR | [`../schemas/flowchart.schema.json`](../schemas/flowchart.schema.json) | 编辑器权威；`schema_version: 1` |
| Architecture 钉扎 | [`../schemas/ARCHIFY-PIN.md`](../schemas/ARCHIFY-PIN.md) | 外部 Archify schema 版本与路径 |
| Codec 接口 | DESIGN §12.1；[`../src/import/types.ts`](../src/import/types.ts) | detect / parse / encode |
| 错误码 | DESIGN §12.2 | Parse / Validate / Bridge / Lossy |
| Finalize 状态机 | DESIGN §12.3 | idle → … → cleanup |
| 黄金夹具 | [`../test/fixtures/`](../test/fixtures/) + [`../test/helpers/fixtures.ts`](../test/helpers/fixtures.ts) | 往返 / 投影门禁（SSOT） |
| 单测 / e2e | [`../test/unit/`](../test/unit/) · [`../test/e2e/`](../test/e2e/) | 见 [`../test/README.md`](../test/README.md) |
| **导入导出矩阵** | [`TEST-MATRIX.md`](./TEST-MATRIX.md) + [`../test/unit/io/ioMatrix.test.ts`](../test/unit/io/ioMatrix.test.ts) | TC-IMP / TC-EXP / TC-X |

## 生成可验证门禁（合并前）

```bash
npm test          # vitest：test/unit（领域 + Codec + ioMatrix）
npm run test:e2e  # Playwright：test/e2e（导入等 UI）
npm run build     # tsc --noEmit && vite build
```

Codec / 投影 / 导入导出类改动额外要求：

- [ ] 触及的 `test/fixtures/` 黄金文件仍可 parse  
- [ ] workflow→flowchart、native JSON 往返测通过  
- [ ] architecture 导出剥离 `meta.editor` 后字段不回写私有键（有测则跑）  
- [ ] [`TEST-MATRIX.md`](./TEST-MATRIX.md) 中已自动化的 TC-*（`npx vitest run test/unit/io/ioMatrix.test.ts`）全绿  

## ADR 一览

| ADR | 标题 |
|-----|------|
| [0001](./adr/0001-independent-flowchart-ir.md) | flowchart 独立 IR，不冒充 architecture |
| [0002](./adr/0002-meta-editor-bypass.md) | 编辑态旁路 `meta.editor`，finalize 前剥离 |
| [0003](./adr/0003-workflow-lossy-projection.md) | Archify workflow → flowchart 有损投影策略 |
