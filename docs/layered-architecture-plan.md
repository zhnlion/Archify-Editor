# 分层架构图支持方案

> 本方案仅作用于 **`diagram_type: "architecture"`** 的子模式 `layered`。  
> 流程图请使用顶层类型 **`flowchart`**（见 [`dual-type-editing-plan.md`](./dual-type-editing-plan.md) / [`DESIGN.md`](./DESIGN.md)），二者不要混用 IR。

## 0. 现状澄清

| 层级 | 现状 |
|------|------|
| **产品类型** | 编辑器将同时支持 **`flowchart`** 与 **`architecture`**（命名对齐 Mermaid/draw.io/Archify） |
| **本文件范围** | 只描述 architecture 的 **分层（layered）** 编辑，不是 flowchart |
| **数据模型** | Archify **`architecture`** IR（`components` / `connections` / `boundaries`） |
| **编辑器交互** | MVP 为扁平自由节点图；分层需补泳道与 wraps |
| **交付渲染** | `finalize` 后的 Archify HTML 才有精美边界框 |

结论：分层能力缺口在 **层语义 + 画布约束 + 与 `boundaries` 映射**；流程图用独立 `flowchart` 类型解决，而不是继续把 architecture 画布当流程图用。

Archify 原生相关能力：

- `boundaries[]`：`kind: region | security-group`，`wraps: componentId[]`（按成员外包矩形，**不是显式泳道几何**）
- `layout.mode: grid` + `row`/`col`（可选网格放置）
- `connections`：跨组件连线（跨层边用同一模型）

分层架构图要在此之上增加 **「层」一等公民** 与 **纵向分层约束**。

---

## 1. 目标体验（分层架构图）

典型场景：展示 / 接入 / 业务 / 领域 / 数据 / 基础设施 等**水平层**自上而下排列。

用户可：

1. 新建「分层架构」模板（预设 N 层泳道）
2. 把组件拖进某一层；层内可左右拖，**默认不可拖出层带**（或拖到另一层即改归属）
3. 跨层连线（实线调用 / 虚线依赖）
4. 增删层、重命名层、调整层序  
5. **层带高度、底色/描边可编辑**；层内组件框大小与颜色同总案 §3.7（日常编辑基线）  
6. 导出仍为合法 Archify `architecture` JSON；可应用内 `finalize` → **HTML**（P0）；**SVG / PNG** 与总案导出菜单对齐（P1，见 [`DESIGN.md`](./DESIGN.md) §3.5）

非目标（首期）：任意倾斜层、自由多边形容器、C4 全套、替换 Archify 交付渲染器。

---

## 2. 概念模型

```text
LayeredDiagram
  ├── layers[]          # 编辑态一等公民（有序）
  │     id, label, order, height?, style?
  ├── components[]      # = Archify components（增加 layerId 归属）
  ├── connections[]     # = Archify connections
  └── boundaries?       # 导出时由 layers 生成 / 与 security-group 并存
```

### 2.1 编辑态扩展（建议）

在 **不破坏 Archify 主 schema** 的前提下，用「旁路元数据」存层定义：

**方案 A（推荐）— `meta.editor` 扩展 + 导出时投影**

```json
{
  "meta": {
    "title": "…",
    "output": "…",
    "editor": {
      "mode": "layered",
      "layers": [
        { "id": "L-access", "label": "接入层", "order": 0, "height": 140 },
        { "id": "L-biz", "label": "业务层", "order": 1, "height": 160 },
        { "id": "L-data", "label": "数据层", "order": 2, "height": 140 }
      ]
    }
  },
  "components": [
    { "id": "api", "type": "backend", "label": "API", "pos": [200, 180], "tag": "layer:L-biz" }
  ],
  "boundaries": [
    { "kind": "region", "label": "接入层", "wraps": ["gw", "lb"] },
    { "kind": "region", "label": "业务层", "wraps": ["api", "worker"] },
    { "kind": "region", "label": "数据层", "wraps": ["db", "cache"] }
  ]
}
```

- 归属：`tag: "layer:<id>"` **或** 仅由 `boundaries.wraps` 反推（二选一，推荐 **wraps 为权威**，tag 作缓存）
- `meta.editor` 若 Archify validate 因 `additionalProperties: false` 拒绝：导出 finalize 前 **剥离 `meta.editor`**，仅保留标准字段；编辑器本地用完整文档

**方案 B — 仅用 `boundaries` + 约定层序**

- 每个 `region` = 一层；`order` 用 label 前缀 `01_` 或编辑器侧独立 index 表
- 优点：零扩展；缺点：层高/空层/层序难表达，空层无 wraps 时 boundary 不合法（schema `wraps.minItems: 1`）

**方案 C — 扩展官方 schema（长期）**

- 向 Archify 提 `boundary.kind: "layer"` + `order` + 可空层；周期长，不阻塞 MVP

**决策：MVP 用 A（本地 editor 元数据 + 导出剥离）；权威归属用 `boundaries.wraps`；空层用占位 invisible stub 组件或允许本地空层、导出时丢弃空层。**

---

## 3. 布局与交互规则

### 3.1 几何

| 规则 | 说明 |
|------|------|
| 层带 | 画布纵向切分为 `order` 递增的水平条带：`y ∈ [bandTop, bandTop+height)` |
| 层内 | 节点 `pos.y` 钳制在层内（可垂直微调有限 padding）；`pos.x` 自由 |
| 拖出层 | 落入目标层 → 更新 `wraps`；未落入 → 弹回 |
| 层高 | 可拖层分隔条；或按内容自动 `max(minHeight, content+pad)` |
| 跨层边 | 仍直线/正交；可选要求「只允许向下依赖」校验（可关） |

### 3.2 画布结构（编辑器）

```
┌──────── palette ────────┬──────── canvas ─────────┬── inspector ──┐
│ Components              │ ░░ 接入层 ░░░░░░░░░░░░░ │ Layer / Node  │
│ Layers（层列表）         │   [gw] [lb]             │ 层序/改名     │
│                         │ ░░ 业务层 ░░░░░░░░░░░░░ │ 节点归属      │
│                         │   [api] …               │ 依赖方向规则  │
└─────────────────────────┴─────────────────────────┴───────────────┘
```

### 3.3 与「自由架构模式」切换

| 模式 | 用途 |
|------|------|
| `free`（现 MVP） | 拓扑探索、非分层 |
| `layered` | 分层架构图 |

同一 JSON 可切换：切入 layered 时按现有 `boundaries` 推断层；冲突时向导「按 Y 坐标聚类成层」。

---

## 4. 与 Archify 交付链路

```text
编辑态 LayeredDocument
    │  投影（strip meta.editor，补全 boundaries.wraps）
    ▼
Archify architecture.json  ──validate──►  finalize ──► HTML Viewer
```

- 精美层框仍由 Archify 按 `boundaries` 外包绘制（与现网一致）
- 编辑器层带是**交互脚手架**；finalize 不读 `meta.editor`
- 可选：finalize 前跑「分层卫生检查」（跨层边方向、孤立节点无层）

---

## 5. 实现分期

### P0 — 分层可编可导出（2～3 天量级）

1. `editor.mode = layered` + `layers[]` 本地状态  
2. 画布绘制层带；节点拖拽 Y 钳制 / 换层改 `wraps`  
3. 层列表：增删改名、调序（重算 Y）  
4. 模板：「三层 Web」「四层企业」  
5. 导出：生成/同步 `boundaries`；剥离非法字段后可 finalize  

### P1 — 体验与校验

- 层分隔条调高、对齐辅助线  
- 「仅允许上层→下层」依赖规则 + 违规高亮  
- 从自由模式「按 Y 聚类成层」向导  
- 跨层边正交路由（`route: orthogonal-v`）  

### P2 — 增强

- 层内嵌套 `security-group`  
- 与 Archify `layout.grid` 双向同步 `row=order`  
- 官方 schema 提案 `kind: layer`  

---

## 6. 数据示例（三层）

```json
{
  "schema_version": 1,
  "diagram_type": "architecture",
  "meta": {
    "title": "示例分层架构",
    "output": "layered-demo.html",
    "quality_profile": "showcase"
  },
  "components": [
    { "id": "web", "type": "frontend", "label": "Web", "pos": [120, 50], "size": [120, 56] },
    { "id": "api", "type": "backend", "label": "API", "pos": [120, 200], "size": [120, 56] },
    { "id": "db", "type": "database", "label": "DB", "pos": [120, 350], "size": [120, 56] }
  ],
  "boundaries": [
    { "kind": "region", "label": "展示层", "wraps": ["web"] },
    { "kind": "region", "label": "服务层", "wraps": ["api"] },
    { "kind": "region", "label": "数据层", "wraps": ["db"] }
  ],
  "connections": [
    { "id": "e1", "from": "web", "to": "api", "label": "HTTPS" },
    { "id": "e2", "from": "api", "to": "db", "label": "SQL" }
  ]
}
```

编辑器在此基础上增加层带 UI；层序 = boundaries 数组序或 `meta.editor.layers`。

---

## 7. 风险与取舍

| 风险 | 缓解 |
|------|------|
| `meta.editor` 无法过 Archify validate | 导出/finalize 前剥离；本地存 `.editor.json` 侧车亦可 |
| 空层无法写入 `boundaries` | 编辑器允许空层；导出省略或插入隐藏 stub（不推荐 stub，优先省略） |
| 层框与节点双源几何冲突 | **节点 pos 权威**；层带由 order+height 推导；boundary 外包仅交付用 |
| 用户以为要换 flowchart 引擎 | 文档强调：仍是 architecture，只加分层编辑模式 |

---

## 8. 建议结论

1. **不必**新做「流程图引擎」；应做 **`architecture` + Layered 编辑模式**。  
2. **层**用编辑器一等公民表达，**投影**为 Archify `boundaries(region)+wraps`。  
3. P0 即可让「分层架构图」可编、可导出、可 finalize；与现有自由画布模式并存。

下一步若落地：先实现 P0（层带 + wraps 同步 + 三层模板 + 导出剥离）。
