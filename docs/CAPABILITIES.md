# 产品能力摘要

> 权威细节：[`DESIGN.md`](./DESIGN.md) F-* / §3.6；导航：[`SPEC-INDEX.md`](./SPEC-INDEX.md)。  
> 本文只陈述**本产品做什么 / 不做什么**；格式名仅表示互换，不作外部产品归因。

## 做什么

| 域 | 能力 | 映射 |
|----|------|------|
| 双类型 | `flowchart` \| `architecture`（分层为 architecture 子模式） | F-01～F-04 |
| 日常编辑 | 拖放、八向缩放、填色描边、多选对齐、网格吸附、正交连线与拐点、泳道 CRUD | F-11～F-13 |
| 语义差异化 | 空坐标布局与再导入保几何；命名色标图例；判断边默认「是/否」；架构 `via` / boundary `wraps` | F-22～F-25 |
| 格式互通 | Archify JSON/HTML、Mermaid、draw.io（`.drawio` / mxGraph **子集**）进出；有损须提示 | F-08/09/14～21 |
| 交付 | Bridge finalize → Archify HTML；导出前剥离 `meta.editor` | F-05/F-16；ADR-0002 |

## 不做什么（非目标）

- 全量商业形状库 / clipart / 模板商城 / 皮肤商城 / 整图一键换肤
- 实时多人协作、IM 内文档权限与水印套餐
- 商业级全自动连接器绕障引擎；厂商图标整库
- 用 architecture 冒充 flowchart；自由填色进入架构交付 HTML
- 自研第二套精美 HTML 引擎（交付走 Archify）
- 闭源办公套件专有格式全量对等（Visio `.vsdx` 仅作远期 backlog 格式名）

## 主题分层（防混淆）

| 层 | 本仓态度 |
|----|----------|
| 编辑壳昼夜 | 有（编辑舒适度） |
| 命名色标 + 图例 | 有（F-23；语义色） |
| 整图主题皮肤 / sketch 手绘包 | **不做** |

## 格式名（可保留）

`draw.io` / `.drawio`、Mermaid、Archify、PlantUML、Graphviz、Visio（扩展 backlog）——仅作**业界互换格式**名称，不表示本产品 UI 源自对应产品。
