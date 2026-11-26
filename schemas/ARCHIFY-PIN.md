# Archify schema 钉扎

本编辑器 **不复制** Archify 官方 schema 全文；导出/校验时对接本机或技能包内的 Archify。

| 项 | 钉扎值 |
|----|--------|
| 包名 | `archify` |
| **本仓库归档** | [`../tools/archify`](../tools/archify)（编辑器优先使用） |
| 参考版本 | **3.0.1**（以 `tools/archify/package.json` 为准） |
| 本地补丁 | workflow `col`/`fromCol`/`toCol` **maximum 63**（见 [`../tools/archify-patches/`](../tools/archify-patches/)） |
| architecture schema | `tools/archify/schemas/architecture.schema.json` |
| workflow schema | `tools/archify/schemas/workflow.schema.json` |
| 兼容回退 | `%USERPROFILE%\.cursor\skills\archify\` 或 `ARCHIFY_BIN` |

## 规则

1. 导出给 Archify 的 JSON：**禁止**带 `meta.editor` 及 schema `additionalProperties: false` 拒绝的私有字段（见 ADR-0002）。  
2. 导入 `diagram_type: "workflow"`：按 workflow schema 识别，再投影为本仓 [`flowchart.schema.json`](./flowchart.schema.json)（ADR-0003）。  
3. 升级 Archify 大版本时：更新本文件版本号，并跑 `test/fixtures/` + finalize 冒烟。  

## 本仓自有 Σ

| IR | Schema |
|----|--------|
| flowchart | [`flowchart.schema.json`](./flowchart.schema.json) |
| architecture（编辑态超集） | 以 Archify architecture 为准 + 旁路 `meta.editor` |
