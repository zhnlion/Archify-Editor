# Flowchart + Architecture 双类型在线编辑方案

> 上位文档：[`DESIGN.md`](./DESIGN.md)  
> 分层架构（architecture 子模式）：[`layered-architecture-plan.md`](./layered-architecture-plan.md)

## 1. 目标

编辑器同时支持：

| 枚举值 | 中文 | 在线编辑 |
|--------|------|----------|
| `flowchart` | 流程图 | ✅ 拖拽节点/边、流程形状、分支标签 |
| `architecture` | 架构图 | ✅ 拖拽组件/边；可选 `layered` 分层 |

**格式互通目标**：支持**主流流程图、架构图格式的导入与导出**（上位 [`DESIGN.md`](./DESIGN.md) §3.0）。首期闭环：**Archify · Mermaid · draw.io**；P3+ 扩展 PlantUML / Graphviz / Visio 等。

类型名固定为英文 **`flowchart` / `architecture`**，便于：

- 与 Mermaid / draw.io / Archify 等主流格式语义对齐  
- 文件与 API 稳定扩展  
- 导入时按格式路由到正确编辑器

---

## 2. 类型判别与切换

### 2.1 权威字段

```json
{ "diagram_type": "flowchart" }
```

或

```json
{ "diagram_type": "architecture" }
```

### 2.2 切换规则

- **新建**：向导二选一，加载对应空白模板。  
- **已有图切换类型**：二次确认；尝试字段投影（见 §4），失败则仅改类型并清空不兼容字段。  
- **禁止**静默把 architecture 当 flowchart 打开（避免形状语义丢失）。

### 2.3 UI

- 顶栏类型徽章：`Flowchart` / `Architecture`  
- 新建菜单、示例菜单分类型  
- 底栏：`diagram_type=…` +（architecture 时）`mode=free|layered`

---

## 3. 编辑能力对照

### 3.1 共用能力（同一 Canvas 壳）

- 平移/缩放画布  
- 选中、拖拽改 `pos`  
- **框体大小**：八向缩放手柄 + 检查器宽高（日常编辑基线）  
- **颜色**：填充 / 描边 / 文字色；连线色与线宽  
- 连线模式、删除、Undo（P0 至少单步）  
- 导入/导出 JSON  
- **导出 Archify / Mermaid / draw.io / HTML / SVG / PNG**（分期见 §7；总表见 `DESIGN.md` §3.5、§3.10）  
- 检查器编辑 label、尺寸、样式

### 3.2 Flowchart 专有

| 能力 | 说明 |
|------|------|
| 形状 | `start` / `end` / `process` / `decision` / `subprocess`（可扩展） |
| 决策出边 | 允许多出边；边 `label` 表示「是/否/条件」 |
| 组件板 | 流程形状，而非 cloud/db 语义 type |
| 框体 / 颜色 | 节点 `size` + `style.fill|stroke|text`；边 `style.stroke` |
| 导出 JSON | `*.flowchart.json`（本编辑器 IR） |
| 导出 Archify | P1：`workflow` JSON；可选 finalize HTML |
| 导出 Mermaid | **P1**：`.mmd` / 复制 `flowchart TD` |
| 导出 draw.io | **P0**（F-18）：mxGraph 子集 |
| 导出 SVG / PNG | P1：画布矢量/栅格化 |

### 3.3 Architecture 专有

| 能力 | 说明 |
|------|------|
| 组件 `type` | external / frontend / backend / database / cloud / security / messagebus |
| `boundaries` | region / security-group；编辑器可视化框；**框体可缩放、可着色** |
| `mode: layered` | 泳道层带，见分层方案；层带高度/底色可编 |
| 框体 / 颜色 | 组件 `size` + `style`（或 `meta.editor.styles`，finalize 前剥离） |
| 导出 JSON | `*.architecture.json`（完整编辑态） |
| 导出 Archify | **P0**：剥离私有字段的 architecture JSON + **finalize HTML** |
| 导出 Mermaid | P1：有限/有损（组件+边） |
| 导出 draw.io | **P0**（F-18）：mxGraph 子集 |
| 导出 SVG / PNG | P1：画布或 Viewer 导出 |

---

## 4. IR 与投影

### 4.1 Flowchart IR（编辑器权威）

```typescript
interface FlowchartDocument {
  schema_version: 1
  diagram_type: 'flowchart'
  meta: { title: string; output: string; locale?: string; editor?: object; format_hints?: FormatHints }
  nodes: Array<{
    id: string
    shape: 'start' | 'process' | 'decision' | 'end' | 'subprocess'
    label: string
    pos?: [number, number]
    size?: [number, number]
    style?: { fill?: string; stroke?: string; text?: string; strokeWidth?: number }
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    label?: string
    route?: 'straight' | 'ortho'
    style?: { stroke?: string; strokeWidth?: number }
  }>
}
```

### 4.2 Architecture IR（Archify 权威）

沿用 `architecture.schema.json`：`components` / `connections` / `boundaries` / …

### 4.3 与 Archify / Mermaid 投影

| 方向 | 规则 |
|------|------|
| flowchart → Mermaid | `shape`→节点语法；`edges`→`-->`/`-->>`；决策用 `{}` |
| Mermaid flowchart → flowchart | 解析 `flowchart`/`graph` 块生成 nodes/edges |
| Archify `workflow` → flowchart | **P1 正式必做**；见 §5.1 / DESIGN §3.9.1 |
| flowchart → Archify workflow | 可选对称导出；step/lane 映射表单独维护（P1） |
| architecture ↔ Archify | 直接 validate/finalize；`meta.editor` 导出前剥离 |
| architecture ← Mermaid C4 / architecture-beta | P1 启发式 |

---

## 5. 导入兼容：主流流程图 / 架构图格式

> 上位需求：[`DESIGN.md`](./DESIGN.md) §3.0、§3.9（F-08 / F-09 / F-14 / F-15 / F-20 / **F-21**）  
> 导出对称：§3.10（F-16 / F-17 / F-18 / F-19）

### 5.0 总览与 Codec

统一接口：[`DESIGN.md`](./DESIGN.md) §12.1、[`src/import/types.ts`](../src/import/types.ts)；打开入口 `openDocument()`。

| 来源 | 入口 | 目标 | 分期 |
|------|------|------|------|
| Archify `architecture` JSON | 文件 / 粘贴 | `architecture` | **P0** |
| Archify **`"diagram_type": "workflow"`** | 文件 / 粘贴 | `flowchart` 投影 | **P1（核心已落地，F-21）** |
| Mermaid flowchart/graph | `.mmd` / 粘贴 | `flowchart` | **P1** |
| Mermaid C4 / architecture-beta | 粘贴 | `architecture` | P1 |
| draw.io | `.drawio` / `.xml` | 用户确认类型 | **P0**（F-09） |
| 本编辑器 IR | `*.flowchart.json` / `*.architecture.json` | 原类型 | **P0** |

### 5.1 Archify

1. **architecture**：校验 `schema_version` / `components`；`meta.editor` 可保留作编辑态；无效文档拒绝并提示。  
2. **workflow（F-21）**：`projectWorkflowToFlowchart`（[`src/import/workflowProjection.ts`](../src/import/workflowProjection.ts)）；黄金夹具 `test/fixtures/agent-tool-call.workflow.json`；细则 DESIGN §3.9.1 / ADR-0003。  
3. 与 finalize 对称：architecture 导入后可再导出 JSON 并 finalize；workflow 导入后以 flowchart IR 存盘。

### 5.2 Mermaid

| 源语法 | 目标 `diagram_type` |
|--------|---------------------|
| `flowchart` / `graph` | `flowchart` |
| `C4Context` / `C4Container` / … | `architecture`（降级为组件+边） |
| `architecture-beta` | `architecture` |
| `sequenceDiagram` / `stateDiagram` / … | 拒绝并提示「后续类型」 |

写入 `meta.format_hints = { source: "mermaid" }`。

### 5.3 draw.io（`.drawio` / `.xml`）

draw.io **无标准 diagram_type 字段**，采用：

1. 启发式：Flowchart 形状库、菱形决策占比 → 建议 `flowchart`  
2. AWS/Azure/Cisco/软件组件库 → 建议 `architecture`  
3. **始终弹出确认**：导入为 Flowchart / Architecture  
4. 尽量保留：位置、尺寸、文字、填充/描边；复杂样式可降级  

往返：P2 导出 mxGraph 子集（矩形/菱形 + edge）；写 `format_hints.source = "drawio"`。

### 5.4 文件名与统一入口

- `*.flowchart.json` / `*.architecture.json` 优先信文件名  
- 与内容 `diagram_type` 冲突时以**内容为准**并 toast 提示  
- 顶栏导入接受多扩展名；提供「粘贴 Mermaid / JSON」二次入口（F-15）  

---

## 6. 模块划分（实现）

```text
src/
  app/          # 壳：类型选择、路由式 Store 切换
  shared/       # Canvas 壳、Undo、文件 IO
  flowchart/    # FlowchartStore、Palette、ShapeRenderer、mermaidCodec
  architecture/ # ArchitectureStore（现有）、Palette、Boundary/Layer
  import/       # mermaidParse、drawioParse、detectType
```

现有 `App.tsx` 单文件可拆：先抽 `architecture/`，再加 `flowchart/` 并行。

---

## 7. 分期（与 DESIGN §10 对齐）

### P0

1. `diagram_type` 状态机 + 新建/示例分栏  
2. Flowchart 完整在线编辑（形状板 + 拖拽 + JSON 进出）  
3. Architecture 保持现能力；导出文件名带类型后缀  
4. **框体大小、填充/描边/文字色可编辑**（手柄 + 检查器；日常编辑核心操作）  
5. **导出 HTML（architecture）**：UI 一键 finalize → 下载 `.html`；失败提示 + 复制 CLI 兜底  
6. 文档与夹具各一份：`test/fixtures/demo.flowchart.json`、`test/fixtures/demo.architecture.json`  

### P1

1. 网格吸附、多选对齐/分布、格式刷、复制粘贴  
2. **导出 SVG、PNG**（共用导出菜单；支持 1x/2x PNG；含用户尺寸与颜色）  
3. **Mermaid 导入 + 导出**（`.mmd` / 剪贴板）+ **统一导入/导出入口**  
4. **Archify `workflow` 导入 → flowchart**（F-21）；导出 workflow 可选对称  

5. Architecture layered P0  
6. （可选）flowchart → workflow finalize → HTML  

### P2

1. **draw.io 导入 + 导出兼容**（确认流；几何/填色子集；可被 diagrams.net 打开）  
2. 可选 JPEG / WebP  

---

## 8. 验收标准（P0）

- [ ] 可新建并保存 `diagram_type=flowchart` 与 `architecture` 两种文档且互不串味  
- [ ] Flowchart：添加判断节点并拉出两条带标签的边，刷新/再导入后保留  
- [ ] 选中框体可拖角改大小，检查器宽高与画布一致；改填充/描边/文字色后刷新仍保留  
- [ ] Architecture：现有拖拽与导出 JSON 仍可用；组件框同样可改尺寸与颜色  
- [ ] **Architecture：导出 HTML 可下载可打开；无 Node/finalize 失败时有明确错误与命令兜底**  
- [ ] 错误打开类型时有明确提示，不静默损坏数据  

### 验收标准（P1 导出补充）

- [ ] 导出 SVG 可在浏览器或矢量软件打开，节点标签可读  
- [ ] 导出 PNG 在 1x/2x 下拓扑完整、背景与主题可接受  
- [ ] 导出菜单同时列出：JSON / HTML / SVG / PNG（按类型灰显不可用项）  

---

## 9. 决议摘要

| 议题 | 决议 |
|------|------|
| 流程图类型名 | **`flowchart`** |
| 架构图类型名 | **`architecture`** |
| 分层 | architecture 子模式，不新增顶层类型 |
| flowchart 是否共用 architecture IR | **否**，独立 IR，便于 Mermaid/draw.io |
| Archify finalize / HTML | architecture：**P0 应用内导出 HTML**；flowchart：P1 可选映射 workflow |
| SVG / PNG 导出 | **P1 正式需求**；JPEG/WebP 为 P2 |
| 导出菜单 | JSON / Archify / HTML / Mermaid / draw.io / SVG / PNG（见 DESIGN §3.10） |
| 框体大小 / 颜色 | **P0 正式需求**；存储见节点 `size` + `style` |
| 编辑基线 | 流程/架构日常操作覆盖行业常见交互；全量形状库不做 |
| 格式互通目标 | **主流流程图/架构图格式导入导出**（DESIGN §3.0 / F-20） |
| 导入兼容 | Archify architecture（P0）+ **workflow→flowchart（P1 必做）** / Mermaid（P1）/ draw.io 子集（**P0**，F-09）；§3.9 |
| Archify workflow 导入 | 识别 `"diagram_type": "workflow"`，投影 flowchart（F-21） |
| 导出兼容 | 首期 Archify（P0）/ Mermaid（P1）/ draw.io 子集（**P0**，F-18）；§3.10。另见 DESIGN §3.11（F-22～F-25） |
