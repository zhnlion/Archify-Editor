# ADR-0001：flowchart 使用独立 IR

## 状态

Accepted

## 背景

编辑器需同时支持流程图与架构图。若用 Archify `architecture` 冒充流程，形状语义、Mermaid/draw.io 互通、决策多出边都会扭曲。

## 决策

- 顶层 `diagram_type: "flowchart"` 为**编辑器一等公民**，权威 schema 在 `schemas/flowchart.schema.json`。  
- 不把 flowchart 存成 `architecture` + 特殊约定。  
- 与 Archify `workflow` 的关系是**投影**（导入正式必做；导出可选），不是同一 IR。

## 后果

- 需维护 flowchart↔Mermaid、flowchart↔workflow 映射表。  
- architecture 继续直连 Archify finalize。  
- 类型切换须二次确认，禁止静默串味。
