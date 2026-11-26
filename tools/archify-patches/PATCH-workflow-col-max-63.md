# PATCH: workflow column maximum 5 → 63

- **Date**: 2026-10-15  
- **Skill**: Archify `3.0.1`（`%USERPROFILE%\.cursor\skills\archify`）  
- **Trigger**: `finalize workflow` → `validate` → `schema/maximum: /nodes/*/col must be <= 5`（例：`l_xx` col>5）

## Intent

允许宽流程图（单泳道多列 / 编辑器合成 workflow）通过 schema 校验，并由 layout 按实际最大 `col` 扩展网格，而不是静默丢弃 `col >= 6` 的节点。

## File-level changes

### 1. `schemas/workflow.schema.json`

以下字段 `maximum` 从 `5` 改为 `63`：

- `phases[].fromCol` / `phases[].toCol`
- `groups[].fromCol` / `groups[].toCol`
- `nodes[].col`

`minimum` 仍为 `0`。

### 2. `renderers/workflow/workflow-compiler.mjs`

在 `createReadableLayout` 前增加：

```js
function resolveWorkflowColumnCount(workflow) {
  let maxCol = 5;
  for (const node of asArray(workflow.nodes)) {
    if (Number.isInteger(node.col)) maxCol = Math.max(maxCol, node.col);
  }
  for (const phase of asArray(workflow.phases)) {
    if (Number.isInteger(phase.fromCol)) maxCol = Math.max(maxCol, phase.fromCol);
    if (Number.isInteger(phase.toCol)) maxCol = Math.max(maxCol, phase.toCol);
  }
  for (const group of asArray(workflow.groups)) {
    if (Number.isInteger(group.fromCol)) maxCol = Math.max(maxCol, group.fromCol);
    if (Number.isInteger(group.toCol)) maxCol = Math.max(maxCol, group.toCol);
  }
  return maxCol + 1;
}
```

并将：

```js
const columnCount = 6;
```

改为：

```js
const columnCount = resolveWorkflowColumnCount(workflow);
```

### 3. `test/golden.mjs`

```diff
-expectFailure('column beyond layout maximum', 'workflow',
-  (d) => { d.nodes[0].col = 7; }, '<= 5');
+expectFailure('column beyond raised layout maximum', 'workflow',
+  (d) => { d.nodes[0].col = 64; }, '<= 63');
```

### 4. Regenerate validators

```bash
cd %USERPROFILE%\.cursor\skills\archify
npm run generate:validators
```

更新产物：`renderers/shared/generated-validators.mjs`（勿手改）。

## Editor side (archify-editor)

- `src/export/workflowFinalize.ts`：`MAX_COL = 63`，合成时仍保证同 lane 内 col 唯一。

## Verification

```powershell
$bin = "$env:USERPROFILE\.cursor\skills\archify\bin\archify.mjs"
# 任意含 nodes[].col >= 6 且 <= 63 的 workflow JSON
node $bin finalize workflow .\wide.workflow.json .\out.html --quality showcase --json
```

期望：`ok: true`，不再出现 `/nodes/*/col must be <= 5`。

## Upgrade caution

官方 Archify skill 更新到 3.1.x+ 时可能还原本补丁；请按 [`README.md`](./README.md) 重放，或向上游提 PR 将默认 `maximum` 提高。
