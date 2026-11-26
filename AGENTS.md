# Agent 指南 — Archify Editor

## 先读什么

1. [`docs/SPEC-INDEX.md`](./docs/SPEC-INDEX.md) — F/Q/K/Σ 入口与门禁  
2. 按任务切片打开 [`docs/DESIGN.md`](./docs/DESIGN.md)（不要整篇无目的通读）；能力摘要 [`docs/CAPABILITIES.md`](./docs/CAPABILITIES.md)  
3. 改 IR/Codec：[`schemas/`](./schemas/)、[`docs/adr/`](./docs/adr/)  
4. `docs/personal/local-rea/` 为本地内部笔记（`docs/personal/` 被 gitignore），**勿**写入开源文档或提交  
 

## 硬边界

- **双类型**：`flowchart` | `architecture`；分层是 architecture 子模式，不是第三类型。  
- **禁止**用 architecture 冒充 flowchart（ADR-0001）。  
- **Finalize**：只经 Bridge；导出前剥离 `meta.editor`（ADR-0002）。  
- **workflow 导入**：投影为 flowchart，有损须提示（ADR-0003 / F-21）。  
- **不做**：全量商业流程图工具形状库、实时协作、自研第二套精美 HTML 引擎。  
- **自包含 CLI**：`tools/archify` + `tools/archify-patches` 随仓库；勿再依赖并列 `../archify`。  

## 分层依赖

`Presentation → Application → Domain → Infrastructure → External`  
禁止 UI 直接 spawn Archify CLI。

## 验证

```bash
npm test
npm run build
```

Codec/投影/导入导出改动须覆盖 [`test/fixtures/`](./test/fixtures/) 与 [`docs/TEST-MATRIX.md`](./docs/TEST-MATRIX.md)（`test/unit/io/ioMatrix.test.ts`）；UI 导入走 `npm run test:e2e`。详见 [`test/README.md`](./test/README.md) 与 SPEC-INDEX「生成可验证门禁」。

## 现状 vs 目标

过渡期大量逻辑可在 `src/App.tsx`；**新增** Codec、校验、Bridge 应落到 `src/import/`、`src/export/`、`src/bridge/`、`src/domain/`（见 DESIGN §12.5）。
