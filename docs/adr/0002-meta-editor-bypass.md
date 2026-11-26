# ADR-0002：编辑态旁路 `meta.editor`，finalize 前剥离

## 状态

Accepted

## 背景

Archify `architecture.schema.json` 对未知字段较严；分层泳道、部分 `style`、编辑器私有几何无法全部写入官方字段。

## 决策

- 编辑态扩展写入 `meta.editor`（如 `mode`、`layers`、`styles`）。  
- 导出「本编辑器 JSON」保留完整编辑态。  
- 导出 Archify JSON / 调用 `finalize` 前：**深拷贝并剥离** `meta.editor` 及约定私有键。  
- 精美 HTML 可能回落到类型默认色；编辑态 SVG/PNG 必须以用户色为准。

## 后果

- Bridge 层必须统一走剥离函数，禁止 UI 直接拼 CLI 入参。  
- 往返：Archify HTML ≠ 编辑器色，须在 UI 注明（见 DESIGN §3.7.3）。
