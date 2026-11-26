# ADR-0003：Archify workflow → flowchart 有损投影

## 状态

Accepted

## 背景

产品须支持导入 `"diagram_type": "workflow"`（F-21）。Archify workflow 含 `lanes`/`phases`/`groups`/`cards`/`mainPath`，本编辑器 flowchart 首期无泳道 UI。

## 决策

- **导入正式必做（P1）**：识别 workflow → 投影为 `flowchart`，`format_hints.source = "archify"`。  
- **保留完整源文档**于 `meta.editor.archify_workflow`，供 **Archify `finalize workflow` → HTML**（精美观感与 CLI 一致）。  
- **编辑态**：泳道带 + 语义色；`phases`/`groups`/`cards` 可不画，但导出 HTML 仍从源文档带出。  
- shape / 布局启发式见 DESIGN §3.9.1。  
- **导出 HTML**：flowchart 菜单可用；优先 merge 源文档后 finalize；无源则合成最小 workflow。

## 后果

- 黄金夹具：`test/fixtures/agent-tool-call.workflow.json`。  
- 编辑态 ≠ Archify HTML（预期）；交付物用「导出 HTML」对齐。  
- 禁止把 workflow JSON 当 architecture 打开。
