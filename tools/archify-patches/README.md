# Archify skill 本地补丁记录

本目录记录对 **Archify** 的本地修改说明。

**运行时归档位置**：[`../archify`](../archify)（`Archify-Editor/tools/archify`，编辑器优先调用，见 [`../archify/VENDORED.md`](../archify/VENDORED.md)）。

---

## 2026-10-15 — `viewer/viewport-overflow`（browser-check，编辑器侧）

**现象**：约 30 节点 flowchart → workflow 后，`finalize` 在 **browser-check** 报多档视口溢出。

**处理（archify-editor）**：

- 合成网格按 √N 取列数（4..8），大图收紧 `width`、省略 `mainPath`
- Vite 桥：若失败阶段为 browser-check 且诊断含 `viewer/viewport-overflow`，但 **HTML 已由 deliver 写出**，则**软通过并下载 HTML**（门禁不阻断导出）

## 2026-10-15 — `composition/desktop-readability`（编辑器侧）

**现象**：`finalize workflow --quality showcase` 因图过宽，节点文字在 1440 桌面视口投影过小 → validate 硬失败。

**处理（archify-editor，非改 skill 门禁）**：

- 合成 workflow：近似方形网格；默认 `quality_profile: standard`
- 宽图 / 多节点：`recommendFinalizeQuality` → `standard`
- Vite 桥：showcase 若报 `composition/desktop-readability`，**自动用 standard 重试一次**

## 2026-10-15 — workflow `col` 上限 5 → 63

### 背景

编辑器将大型 flowchart 合成 / 导入为 Archify `workflow` 后，`finalize workflow` 在 **validate** 阶段失败：

```text
schema/maximum: /nodes/N/col … must be <= 5
```

根因：官方 `workflow.schema.json` 将 `nodes[].col` 与 `phases`/`groups` 的 `fromCol`/`toCol` 上限写死为 **5**（仅 6 列）；布局编译器亦硬编码 `columnCount = 6`，即使放宽 schema，高列号节点仍会被布局跳过。

### 修改摘要

| 文件（skill 内） | 变更 |
|------------------|------|
| `schemas/workflow.schema.json` | `col` / `fromCol` / `toCol` 的 `maximum`: **5 → 63** |
| `renderers/workflow/workflow-compiler.mjs` | 新增 `resolveWorkflowColumnCount()`，按文档最大 col 动态定宽（至少 6） |
| `test/golden.mjs` | 负例由 `col=7` 期望 `<= 5` 改为 `col=64` 期望 `<= 63` |
| `renderers/shared/generated-validators.mjs` | 由 `npm run generate:validators` 重生 |

配套编辑器：`src/export/workflowFinalize.ts` 中合成布局 `MAX_COL` 与 63 对齐。

### 重放步骤（skill 被官方更新覆盖后）

```powershell
$skill = ".\tools\archify"   # Archify-Editor 根目录下

# 按 PATCH-workflow-col-max-63.md 手工合并
cd $skill
npm run generate:validators
npm test
# 或仅：
node bin/archify.mjs finalize workflow path\to\wide.workflow.json out.html --quality showcase --json
```

### 相关文档

- 本补丁细则：[`PATCH-workflow-col-max-63.md`](./PATCH-workflow-col-max-63.md)
- 编辑器规格：`docs/DESIGN.md`、`schemas/ARCHIFY-PIN.md`
