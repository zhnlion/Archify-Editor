# Archify Editor — 产品与技术方案

> 归档位置：`docs/DESIGN.md`（原仓库根目录 `DESIGN.md` 已迁入本路径）  
> **规格入口（AI）**：`[SPEC-INDEX.md](./SPEC-INDEX.md)` · `[../AGENTS.md](../AGENTS.md)` · `[adr/](./adr/)`  
> 子方案：`[dual-type-editing-plan.md](./dual-type-editing-plan.md)`、`[layered-architecture-plan.md](./layered-architecture-plan.md)`  
> 部署：`[DEPLOY.md](./DEPLOY.md)`（硬件要求、Win/Linux 差异、一键部署、低资源占用）  
> 契约 Σ：`[../schemas/flowchart.schema.json](../schemas/flowchart.schema.json)`、`[../schemas/ARCHIFY-PIN.md](../schemas/ARCHIFY-PIN.md)`

---

## 目录

1. [产品定位](#1-产品定位)
2. [生态定位与差异化](#2-生态定位与差异化)
3. [需求文档](#3-需求文档)（§3.0→§3.10 顺序）
4. [软件方案](#4-软件方案)
5. [类型命名约定](#5-类型命名约定)
6. [用户旅程与信息架构](#6-用户旅程与信息架构)
7. [数据模型](#7-数据模型)
8. [在线编辑能力矩阵](#8-在线编辑能力矩阵)
9. [导入扩展](#9-导入扩展)
10. [实施分期](#10-实施分期)
11. [与 Archify 的边界](#11-与-archify-的边界)
12. [AI 友好规格治理（契约 / 可观测 / 门禁）](#12-ai-友好规格治理契约--可观测--门禁)

部署运维见独立文档 `[DEPLOY.md](./DEPLOY.md)`。

---

## 1. 产品定位

在统一编辑器中提供两类在线可视化编辑能力，类型名与业界习惯对齐，便于区分格式并扩展导入：


| `diagram_type`     | UI 中文名 | 用途               |
| ------------------ | ------ | ---------------- |
| `**flowchart**`    | 流程图    | 步骤、审批、分支、控制流     |
| `**architecture**` | 架构图    | 组件、边界、分层、部署/运行拓扑 |


**产品目标（格式互通）**：**支持主流流程图、架构图格式的导入与导出**——以本编辑器 JSON-IR 为编辑权威，与业界常用文本/图形格式双向兼容（有损允许，拓扑与文案优先）。首期必修：**Archify、Mermaid、draw.io（diagrams.net）**；后续按优先级扩展 PlantUML、Graphviz、Visio 等（见 §3.0）。

编辑结果落为 JSON-IR；`architecture` 优先对接 [Archify](https://github.com/tt-a1i/archify) `finalize` 出精美 HTML。`flowchart` 可映射 Archify `workflow` 或自研简易交付。

**编辑基线**：流程图 / 架构图提供行业常见的在线编辑操作（框体缩放、填色描边、对齐多选等），见 §3.7～§3.8；能力摘要见 [`CAPABILITIES.md`](./CAPABILITIES.md)。

**不做**：全量形状库与全品类图纸（脑图、甘特、circos、海量 clipart）；数值图表；无 schema 的自由涂鸦；非流程/架构类图纸的格式全集。交付 HTML 仍走 Archify，不自研第二套精美渲染引擎。

**目标用户**：防火墙/数据面等技术方案预研、架构评审、流程说明的工程师与文档作者；需要「可拖拽编辑 + 可版本化 JSON + **主流格式进出** + 可导出精美交付物」的本地/内网工具链。

---

## 2. 生态定位与差异化

> 本节只写**本产品定位与格式生态关系**。内部对照笔记放在本地 `docs/personal/local-rea/`（`docs/personal/` gitignore），不进入开源树。  
> 能力与非目标摘要：[`CAPABILITIES.md`](./CAPABILITIES.md)。

### 2.1 格式与生态角色


| 角色 | 代表 | 与本项目关系 |
| ---- | ---- | ------------ |
| 图形互换格式 | **draw.io / diagrams.net**（`.drawio` / mxGraph 子集） | **Codec 进出**（F-09/F-18）；不做全量形状库 |
| 文本流程图格式 | **Mermaid** | flowchart 互通；几何以编辑器 `pos/size` 为权威 |
| 交付引擎 | **Archify（CLI + Viewer）** | JSON → 精美 HTML；本编辑器是可视化编辑前端 |
| 架构建模 DSL | Archimate / Structurizr 等 | 建模更深；本项目轻量组件拓扑即可 |
| 通用白板 | 手绘风 / 云协作白板类产品 | 体验可参考；本项目偏本地 IR + finalize 交付，不做实时协作 |


### 2.2 能力维度（相对格式生态）


| 维度 | 通用图编辑 / 白板 | Mermaid 文本 | **Archify Editor** |
| ---- | ---------------- | ------------ | ------------------ |
| 拖拽编辑 | 强 | 弱（文本） | ✅ |
| 流程 / 架构分型 | 形状库混用或弱语义 | 语法分型 | `diagram_type` 强分型 |
| 结构化 JSON-IR | 弱或专有 | 文本 AST | ✅ 编辑权威 |
| 精美可分享 HTML | 弱 / 贴图 | 需自渲染 | ✅ Archify finalize |
| 分层泳道架构 | 手工 | 有限 | ✅ `layered` 子模式 |
| Mermaid / `.drawio` 互通 | 视产品 | 原生 / 有限 | 正式 Codec 需求 |
| 本地/离线 | 视产品 | ✅ | ✅ Vite 本地 |


### 2.3 本项目要补的生态缺口


| 常见短板 | 本项目应对 |
| -------- | ---------- |
| 通用图格式无 Archify schema，HTML 观感不一 | 编辑态 JSON 直连 `finalize`，交付统一 Viewer |
| Mermaid 难精确控布局 | 以 `pos/size` 为几何权威，再导出 `.mmd` |
| 纯白板缺组件语义 type | architecture 强制/引导语义类型 + boundaries |
| SaaS 难进内网预研环境 | 本地静态前端 + 可选本机 Node 调 Archify CLI |


### 2.4 差异化结论

1. **不是**全品类商业图示套件，而是「双类型 IR 编辑器 + Archify 交付」。
2. **flowchart / architecture 分型**，禁止用架构图冒充流程或反之（ADR-0001）。
3. **导出菜单覆盖 JSON / HTML / SVG / PNG**，贴合方案文档与评审场景。
4. **日常编辑基线**：框体可缩放、颜色可改、检查器可精调；形状库广度不做全量。
5. **模型出图是入口，不是产品本身**：生成结果必须可再编辑并落入现有 IR；交付仍走 Archify HTML，不做独立「聊天画布」演示站。

---

## 3. 需求文档

> 规格导航见 [SPEC-INDEX.md](./SPEC-INDEX.md)（F/Q/K/Σ）。

### 3.0 目标：主流流程图 / 架构图格式导入导出

**目标陈述**：产品须支持**主流流程图、架构图格式**的**导入与导出**，降低与文档仓、评审工具、既有资产的迁移成本。


| 类别       | 主流格式（业界常用）                             | 本产品定位           | 导入          | 导出  | 分期      |
| -------- | -------------------------------------- | --------------- | ----------- | --- | ------- |
| 自有 / 交付  | 本编辑器 JSON-IR                           | 编辑权威            | ✅           | ✅   | **P0**  |
| 架构交付     | **Archify** architecture JSON / HTML   | 一等公民            | ✅           | ✅   | **P0**  |
| 流程交付     | **Archify `diagram_type: "workflow"`** | 投影为 `flowchart` | ✅ **须支持导入** | ✅   | **P1**  |
| 文本流程     | **Mermaid** flowchart/graph            | 一等公民            | ✅           | ✅   | **P1**  |
| 文本架构     | Mermaid C4 / architecture-beta         | 有损兼容            | ✅           | 有限  | P1      |
| 图形通用     | **draw.io / diagrams.net**             | 一等公民（子集）        | ✅           | ✅   | **P0**  |
| 位图/矢量贴图  | SVG / PNG（及 JPEG/WebP）                 | 演示导出            | —           | ✅   | P1 / P2 |
| 文本流程（扩展） | PlantUML activity / flowchart          | backlog         | 规划          | 规划  | P3      |
| 文本图      | Graphviz DOT                           | backlog         | 规划          | 规划  | P3      |
| 办公图形     | Visio `.vsdx`（只读导入优先）                  | backlog         | 规划          | 可选  | P3+     |
| 架构建模     | Structurizr DSL / C4 PlantUML          | backlog         | 规划          | 规划  | P3+     |


**原则**：

1. **先进主流、再扩长尾**：P0～P2 必须覆盖 Archify + Mermaid + draw.io 的进出；P3+ 按用户反馈排期。
2. **导入导出成对**：任一正式支持的格式须同时规划导入与导出（贴图类 SVG/PNG 可仅导出）。
3. **有损透明**：跨格式往返可丢样式/图标，但须保留节点、连线与关键标签，并在 UI 提示「有损」。
4. **统一入口**：导入嗅探 + 导出菜单灰显（F-15 / F-19）；编解码器可插拔（`import/`、`export/`）。

需求 ID：**F-20**（本目标）；细则见 §3.9（导入）、§3.10（导出）。

### 3.1 应用场景说明

#### 场景 A — 数据面 / 防火墙 Single-Pass 预研

- **角色**：预研工程师、架构师  
- **活动**：绘制报文路径、检测点、慢/快路径分层；导出 HTML 给评审组、PNG 贴进预研 MD  
- **关键能力**：`architecture` + `layered`；boundaries；Finalize HTML；PNG

#### 场景 B — 跨厂商转发流程对照

- **角色**：方案作者  
- **活动**：用 flowchart 画 PA / Fortinet / 华为等「包的一生」分支；Mermaid 进出文档仓库  
- **关键能力**：`flowchart` 决策多出边；Mermaid 导入导出；JSON 进 Git

#### 场景 C — 组件拓扑快速建模 → 精美交付

- **角色**：开发 / 文档同学  
- **活动**：拖拽组件与连线，一键出 Archify showcase HTML，外发客户或内部 Wiki  
- **关键能力**：architecture 自由画布；应用内 HTML 导出；失败时 CLI 兜底

#### 场景 D — 从已有 Mermaid / draw.io 迁移

- **角色**：存量文档维护者  
- **活动**：粘贴 Mermaid 或打开 `.drawio`，确认类型后继续在线编辑  
- **关键能力**：导入路由 + 类型确认；`format_hints.source`

#### 场景 E — 评审材料多格式交付

- **角色**：汇报人  
- **活动**：同一张图导出 JSON（存档）+ HTML（可交互）+ SVG/PNG（PPT/邮件）  
- **关键能力**：统一导出菜单；SVG/PNG 拓扑与标签一致

### 3.2 用户与干系人


| 干系人         | 诉求                                        |
| ----------- | ----------------------------------------- |
| 编辑用户        | 拖得动、框体可改大小与颜色、存得下、导得出；手感接近 主流流程图编辑器   |
| 评审读者        | 打开 HTML 即懂，无需安装编辑器                        |
| 仓库维护者       | JSON 可 diff / 可 code review               |
| 平台（Archify） | schema 合法；finalize 输入干净（剥离 `meta.editor`） |


### 3.3 功能需求（摘要）


| ID   | 需求                                                                                                                  | 优先级                   |
| ---- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| F-20 | **目标：主流流程图/架构图格式导入导出**（首期 Archify + Mermaid + draw.io，见 §3.0）                                                       | P0～P2 必修 / P3+ 扩展     |
| F-01 | 支持 `flowchart` / `architecture` 新建、打开、保存 JSON                                                                       | P0                    |
| F-02 | 画布：选中、拖拽改坐标、增删节点/边、属性检查器                                                                                            | P0                    |
| F-03 | flowchart：起止/过程/判断等形状；决策多出边带标签                                                                                      | P0                    |
| F-04 | architecture：组件语义 type；可选 boundaries / layered                                                                      | P0                    |
| F-05 | **导出 HTML**（architecture 应用内 finalize 下载）                                                                           | P0                    |
| F-06 | 导出失败提示 + 复制 CLI 命令兜底                                                                                                | P0                    |
| F-11 | **框体大小可编辑**：画布八向缩放手柄 + 检查器宽/高数值；节点、边界/层带均适用                                                                         | P0                    |
| F-12 | **颜色可编辑**：填充、描边、文字色（取色器 + 预设色板）；边线颜色/线宽                                                                             | P0                    |
| F-13 | **日常编辑能力基线**（流程图/架构图同类操作，见 §3.8）                                                                             | P0 核心 / P1 对齐 / P2 增强 |
| F-07 | **导出 SVG / PNG**（1x/2x）；须反映用户设定的尺寸与颜色                                                                               | P1                    |
| F-08 | **Mermaid 导入/导出**（flowchart 为主；C4/architecture-beta → architecture）                                                 | P1                    |
| F-09 | **draw.io 导入**（确认类型；矩形/菱形/边/文字/填色；厂商图标丢弃并提示）                                                                    | **P0**                |
| F-14 | **Archify JSON 导入兼容**：`architecture`（P0）+ `**diagram_type: "workflow"` → flowchart（P1，正式必做）**                       | P0 / P1               |
| F-21 | **Archify workflow 导入**：识别 `"diagram_type": "workflow"`，投影为可编辑 flowchart，写入 `format_hints.source=archify`（见 §3.9.1） | **P1**                |
| F-15 | **统一导入入口**：文件选择 + 粘贴文本；按扩展名/内容嗅探并路由（见 §3.9）                                                                         | P1                    |
| F-16 | **Archify 导出兼容**：合法 `architecture` JSON（剥离私有字段）+ finalize HTML；flowchart→`workflow` 可选                              | P0 / P1               |
| F-17 | **Mermaid 导出兼容**：`flowchart TD` 文本 / `.mmd`；architecture 有限导出（组件+边）                                                 | P1                    |
| F-18 | **draw.io 导出兼容**：mxGraph 子集 `.drawio`/`.xml`（矩形/菱形/边/文字/填色描边）                                                       | **P0**                |
| F-19 | **统一导出菜单**：按当前 `diagram_type` 列出可用格式并灰显不可用项（见 §3.10）                                                                | P0                    |
| F-10 | 可选 JPEG / WebP                                                                                                      | P2                    |
| F-22 | **空坐标有限布局 + 再导入保留几何**：无 `pos` 时分层或网格摆开；已有 `pos` / `via` / `fromSide` / `toSide` / 色标引用不被下一次导入覆盖 | **P0**                |
| F-23 | **命名色标与图例**：`meta.editor.colorTags`；改一处定义，引用框一起变；架构 finalize 仍按组件类型着色                                         | **P0**                |
| F-24 | **判断出边默认「是」「否」**（细化 F-03；人可改）                                                                                          | **P0**                |
| F-25 | **架构边拐点 + boundary 成员**：架构边可拖 `via`；`wraps` 可增删；`curve` 仍在 finalize 时剥离                                              | **P0**                |


### 3.4 非功能需求


| ID   | 类别   | 要求                                                                 |
| ---- | ---- | ------------------------------------------------------------------ |
| N-01 | 运行环境 | 现代浏览器；开发 Node ≥ 18；finalize 依赖本机 Archify CLI                       |
| N-02 | 性能   | 百级节点拖拽流畅（60fps 非硬指标，交互无明显卡顿）                                       |
| N-03 | 数据安全 | 默认本地处理；不强制上传云端                                                     |
| N-04 | 可维护性 | 按 `diagram_type` 分模块；IR 与 UI 解耦                                    |
| N-05 | 兼容性  | architecture 导出须通过 Archify validate（剥离编辑器私有字段）                     |
| N-06 | 部署   | **支持一键部署**；生产以静态 `dist` 为主；**资源占用少**（见 `[DEPLOY.md](./DEPLOY.md)`） |
| N-07 | 跨平台  | Windows / Linux 部署路径与脚本差异见部署文档；产物与浏览器行为一致                          |


### 3.5 导出格式需求（正式纳入）

编辑器须提供「导出」菜单（F-19），覆盖交付物与 **Archify / Mermaid / draw.io 互通格式**（细节见 **§3.10**）：


| 格式                            | 优先级                                  | 实现路径                               | 说明                                         |
| ----------------------------- | ------------------------------------ | ---------------------------------- | ------------------------------------------ |
| **JSON（本编辑器 IR）**             | P0（已有）                               | 编辑器 IR 序列化                         | `*.flowchart.json` / `*.architecture.json` |
| **Archify architecture JSON** | **P0**                               | 剥离 `meta.editor` / 编辑态 `style` 后下载 | 可被 Archify CLI validate/finalize           |
| **HTML（Archify Viewer）**      | **P0（architecture）** / P1（flowchart） | 本机 `archify finalize` → 下载 `.html` | 精美交付；失败 CLI 兜底                             |
| **Archify workflow JSON**     | P1                                   | flowchart → workflow 投影            | 可选；便于 Archify workflow 链路                  |
| **Mermaid `.mmd`**            | **P1**                               | flowchart 编码器；architecture 有限      | 文本互通                                       |
| **draw.io `.drawio`/`.xml`**  | **P0**                               | mxGraph 子集                         | 矩形/菱形/边/文字/填色；厂商图标不在子集内                     |
| **SVG**                       | **P1**                               | 画布序列化；或经 Archify Viewer            | 矢量互通                                       |
| **PNG**                       | **P1**                               | 画布栅格化或 Viewer；可选 1x/2x             | 文档/PPT                                     |
| **JPEG / WebP**               | P2                                   | 同 PNG 管线                           | 可选                                         |


**原则**：

1. **JSON 永远可导出**（无损编辑态）。
2. **HTML** 以 Archify 交付链路为准；不自研第二套精美渲染。
3. **SVG/PNG** 允许与 finalize 视觉略有差异，但**拓扑、文案、框体尺寸与用户设定颜色**须与编辑态一致（finalize HTML 若受 Archify 主题限制，须在 UI 注明）。
4. 导出失败须提示原因，并保留「复制 CLI 命令」兜底。
5. **主流格式导出与导入成对规划**（§3.0 / §3.9 ↔ §3.10），往返允许有损但拓扑与文案优先保留。

### 3.6 明确不做

- 多人实时协作 / 云账号体系  
- 数值图表、看板、甘特、脑图、组织架构自动图  
- 主流流程图编辑器 **全量形状库、clipart、模板商城** 1:1  
- 无 schema 的任意矢量涂鸦、手绘笔刷为主的白板  
- 复杂渐变网格、3D 透视、动画关键帧（P2 以外不排期）

### 3.7 框体大小与颜色（正式纳入）

适用对象：flowchart **节点**；architecture **组件框**；architecture **boundaries / 分层泳道框**；连线（颜色与线宽，无「框体」）。

#### 3.7.1 大小


| 能力         | 要求                                                                                    | 优先级 |
| ---------- | ------------------------------------------------------------------------------------- | --- |
| 画布缩放手柄     | 选中后显示 **八向** 控制点（四角等比或自由、四边改单维）                                          | P0  |
| 检查器数值      | 宽、高可输入；单位 px；非法值钳制（最小宽高，如 40×24）                                                      | P0  |
| 写入 IR      | flowchart：`nodes[].size`；architecture：`components[].size`；边界/层带：`meta.editor` 几何或投影字段 | P0  |
| Shift / 约束 | 拖角时按比例缩放（按 Shift 锁定比例的习惯，实现时以文档快捷键表为准）                                     | P1  |
| 多选统一尺寸     | 将所选框体设为相同宽或高                                                                          | P1  |


#### 3.7.2 颜色


| 能力           | 要求                                         | 优先级 |
| ------------ | ------------------------------------------ | --- |
| 填充色 `fill`   | 取色器 + 8～16 色预设板（常见办公色板）            | P0  |
| 描边色 `stroke` | 同上                                         | P0  |
| 文字色 `text`   | 同上                                         | P0  |
| 透明 / 无填充     | 允许 `fill: none` 或 alpha                    | P1  |
| 边线颜色与线宽      | 连线 `stroke` / `strokeWidth`                | P0  |
| 主题默认色        | 未设置时按组件 `type` / 流程 `shape` 给默认色，可一键「恢复默认」 | P0  |
| 命名色标         | `meta.editor.colorTags`（id / label / fill / stroke / text）；节点记引用；改定义则一起变。图例由色标生成。架构导出仍按 `type`（F-23） | **P0** |
| 格式刷          | 将 A 的填色/描边/字色复制到 B                         | P2  |


#### 3.7.3 存储与 Finalize

```text
style: { fill?: string, stroke?: string, text?: string, strokeWidth?: number }
```

- flowchart：写在 `nodes[]` / `edges[]` 上（编辑器权威）。  
- architecture：优先 `components[].style`；若 Archify schema **拒绝 extra**，则放入 `meta.editor.styles[id]`，**finalize 前剥离**，精美 HTML 可能回落到类型默认色。  
- **编辑态、SVG/PNG 导出必须以用户颜色与尺寸为准**。  
- 色值存储为 CSS 十六进制或 `rgba()`，避免专有色名。

### 3.8 日常编辑能力基线

**范围**：仅 **流程图、软件/网络架构图** 日常操作。下表「行业常见」指同类图纸编辑器普遍具备的交互，**不是**外部产品功能抄录；`.drawio` 列仅表示互换格式场景下常见能力。


| 能力（用户可感知）                | 行业常见 | `.drawio` 互换相关 | 本编辑器      | 分期                 |
| ------------------------ | ------- | --- | --------- | ------------------ |
| 拖拽移动节点                   | ✅       | ✅   | ✅         | P0（已有/保持）          |
| 框体八向缩放                   | ✅       | ✅   | **✅ 必做**  | **P0**             |
| 检查器改宽高                   | ✅       | ✅   | **✅ 必做**  | **P0**             |
| 填充 / 描边 / 文字色            | ✅       | ✅   | **✅ 必做**  | **P0**             |
| 连线颜色、线宽、箭头               | ✅       | ✅   | ✅         | P0 色/宽；箭头样式 P1     |
| 双击改文案                    | ✅       | ✅   | ✅         | P0                 |
| **右键菜单（剪切/复制/粘贴/着色/层级）** | ✅       | ✅   | ✅         | **P0**             |
| **白天 / 黑夜画布主题**          | ✅       | ✅   | ✅         | **P0**             |
| 删除 / 复制粘贴 / 复制节点         | ✅       | ✅   | ✅         | P0                 |
| Undo / Redo              | ✅       | ✅   | ✅         | P0 单步；P1 多步        |
| 网格与吸附                    | ✅       | ✅   | ✅         | P1                 |
| 多选、对齐、分布                 | ✅       | ✅   | ✅         | P1                 |
| 层次（置于顶/底层）               | ✅       | ✅   | ✅         | P1                 |
| 折线/正交路由、拖拽拐点             | ✅       | ✅   | ✅         | P1（flowchart 正交优先） |
| 从左侧库拖入形状                 | ✅       | ✅   | ✅（有限形状集）  | P0                 |
| 海量行业形状 / 模板商城            | 常见      | 常见  | ❌         | 不做                 |
| 页面主题一键换肤                 | 常见      | 常见  | 有限（类型默认色 / 色标） | **不做**整图皮肤；色标见 F-23 |


**验收口径**：用户无需查阅帮助即可完成「拉框 → 改大小 → 改颜色 → 连线」；快捷键覆盖 Delete、Ctrl+Z、Ctrl+C/V（Windows；Linux 同 Ctrl）。

---

### 3.9 导入兼容需求（主流流程图 / 架构图格式）

**正式纳入**（呼应 §3.0）：须兼容从**主流流程图、架构图格式**导入，进入可继续在线编辑的 IR；首期覆盖 **Archify、Mermaid、draw.io**；导入后写入 `meta.format_hints.source`，便于往返导出。


| 来源                   | 典型输入                                       | 目标 IR                             | 优先级                   | 兼容范围                                          |
| -------------------- | ------------------------------------------ | --------------------------------- | --------------------- | --------------------------------------------- |
| **Archify**          | `"diagram_type": "architecture"` JSON；粘贴   | `architecture`                    | **P0**                | 识别 `components`/`connections`；合法字段进画布         |
| **Archify workflow** | `**"diagram_type": "workflow"`** JSON；粘贴   | `**flowchart`（投影）**               | **P1（正式必做，见 §3.9.1）** | `lanes`/`nodes`/`edges` → flowchart；有损处 toast |
| **Mermaid**          | `.mmd` / 粘贴 `flowchart`/`graph`            | `flowchart`                       | **P1**                | 节点形状、边标签、基础布局启发式坐标                            |
| **Mermaid**          | 粘贴 `C4`* / `architecture-beta`             | `architecture`                    | P1                    | 降级为组件 + 连线；无几何时自动排布                           |
| **draw.io**          | `.drawio` / `.xml`                         | 用户确认 `flowchart` 或 `architecture` | **P0**                | 矩形/菱形/边/文字/填色描边子集；厂商图标丢弃并提示；海量图标库不对齐           |
| **本编辑器 JSON**        | `*.flowchart.json` / `*.architecture.json` | 对应类型                              | **P0**                | 权威往返；与内容 `diagram_type` 冲突时以内容为准              |


**统一导入交互（F-15）**：

1. 顶栏「导入」支持：JSON / `.mmd` / `.drawio` / `.xml`；另提供「粘贴 Mermaid / JSON」。
2. JSON 嗅探须区分 `architecture` / `workflow` / 本编辑器 `flowchart`；`workflow` **自动进入 flowchart 编辑器**（可提示「已从 Archify workflow 转换」）。
3. 嗅探失败时弹窗让用户选择目标类型，禁止静默串味。
4. 导入失败给出可读原因（语法错误、不支持的 diagram 类型如 sequence/state）。
5. 成功后可选「保留源文件名」到 `format_hints.original_name`。

#### 3.9.1 Archify `workflow` 导入（正式纳入）

须支持打开 / 粘贴符合 Archify `[workflow.schema.json](https://github.com/tt-a1i/archify)` 的文档（`schema_version` 1|2，**必含** `lanes` / `nodes` / `edges`），并投影为编辑器 `diagram_type: "flowchart"`。

```json
{
  "schema_version": 2,
  "diagram_type": "workflow",
  "meta": { "title": "…", "output": "…" },
  "lanes": [ { "id": "ui", "label": "User Interface" } ],
  "nodes": [ { "id": "user", "lane": "ui", "col": 0, "type": "external", "label": "User" } ],
  "edges": [ { "id": "e1", "from": "user", "to": "…", "label": "…" } ]
}
```


| 源字段（Archify workflow）                                          | 目标 flowchart         | 规则                                                                                             |
| -------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `meta.title` / `locale` / `output` / `subtitle`                | `meta.*`             | 直拷；写 `format_hints.source = "archify"`                                                         |
| `nodes[]`（`id`/`label`/`sublabel`/`type`/`lane`/`col`/`width`） | `nodes[]`            | `label`(+可选 `sublabel`)；`type`→shape 启发式（缺省 `process`）；用 `lane`+`col` 算 `pos`，`width`→`size.w` |
| `lanes[]`                                                      | 布局 Y 轴               | 首期不做泳道 UI；按 lane 序排布行高                                                                         |
| `edges[]`（`from`/`to`/`label`/`variant`/`role`）                | `edges[]`            | 保留 `label`；`role=error                                                                         |
| `phases` / `groups` / `mainPath` / `cards`                     | — 或 `meta.editor` 备注 | 首期可忽略并 toast 汇总；不丢节点拓扑                                                                         |
| 无法识别的扩展字段                                                      | —                    | 忽略并汇总 toast，不阻断导入                                                                              |


**shape 启发式（可后续调表）**：无入边或 `mainPath` 首节点 → `start`；无出边或末节点 → `end`；边 `label` 含条件/`role=branch` 的源 → `decision`；其余 → `process`。

**验收口径（workflow）**：

- [ ] 导入 `test/fixtures/agent-tool-call.workflow.json`（或任意 `"diagram_type": "workflow"`），编辑器切到 Flowchart 且节点/边可见可拖  
- [ ] 边标签（如 `needs approval?` / `denied`）不丢失  
- [ ] `meta.format_hints.source === "archify"`  
- [ ] 再导出本编辑器 `*.flowchart.json` 可重新打开  

**验收口径（其余）**：

- [ ] 打开标准 Archify `architecture` 示例 JSON，节点/边可见且可拖拽  
- [ ] 粘贴一段 `flowchart TD` Mermaid，得到可编辑 flowchart  
- [ ] 导入简易 `.drawio`（矩形+边），经确认后进入对应类型画布  
- [ ] 导入后 `meta.format_hints.source` 分别为 `archify` / `mermaid` / `drawio`

细则与路由表见 §9 与 `[dual-type-editing-plan.md](./dual-type-editing-plan.md)` §5。

### 3.10 导出兼容需求（主流流程图 / 架构图格式）

**正式纳入**（呼应 §3.0）：须支持将当前图导出为**主流流程图、架构图格式**；首期与导入对称覆盖 **Archify、Mermaid、draw.io**，后续按 §3.0 表扩展。


| 目标格式                          | 源 IR                         | 优先级    | 产物与要求                                                                          |
| ----------------------------- | ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| **Archify architecture JSON** | `architecture`               | **P0** | 通过 validate；剥离 `meta.editor`、编辑器私有 `style`（或按约定投影）；文件名建议 `*.architecture.json` |
| **Archify HTML**              | `architecture`               | **P0** | 应用内 finalize 下载；失败提示 + 复制 CLI                                                  |
| **Archify workflow JSON**     | `flowchart`                  | P1     | step/lane 映射表；无法表达的分支标签尽量保留为 edge label                                        |
| **Archify HTML（workflow）**    | `flowchart`                  | P1     | 可选：投影后 finalize                                                                |
| **Mermaid `.mmd` / 文本**       | `flowchart`                  | **P1** | `flowchart TD`（或 LR）；决策 `{}`；边标签；可复制到剪贴板或下载文件                                  |
| **Mermaid 文本（有限）**            | `architecture`               | P1     | 组件+边降级为 flowchart/graph 或 C4 简式；须在 UI 标注「有损」                                   |
| **draw.io**                   | `flowchart` / `architecture` | **P0** | 矩形/菱形/边/文字；带 fill/stroke/pos/size；可用 diagrams.net 打开；厂商图标不导出                  |


**统一导出交互（F-19）**：

1. 顶栏「导出」菜单按类型列出：JSON / Archify JSON / HTML / Mermaid / draw.io / SVG / PNG…
2. 当前类型不支持的项**灰显**并 tooltip 说明分期（如 flowchart 下 Archify HTML 为 P1）。
3. 导出 Archify JSON 与「本编辑器完整 JSON」可分两项，或同一 JSON 在导出 Archify 时自动剥离私有字段。
4. Mermaid 支持「下载 `.mmd`」与「复制到剪贴板」。

**验收口径**：

- [ ] architecture：导出 Archify JSON 可被 `archify finalize` 成功生成 HTML  
- [ ] flowchart：导出 Mermaid 可在 Mermaid Live 渲染，节点与分支标签可读  
- [ ] 导出简易 draw.io，可在 diagrams.net 打开且拓扑不错乱  
- [ ] 导出菜单对不可用格式灰显，不静默失败  

与导入对称关系：

```text
导入主流流程/架构格式  →  编辑 IR（flowchart | architecture）  →  导出主流流程/架构格式
         §3.9 / §3.0                                              §3.10 / §3.0
首期：Archify · Mermaid · draw.io
```

### 3.11 P0 补充：AI 草稿可改（2026-10-16）

顺序固定。细则与取舍见 [`AI-DIAGRAM-TREND.md`](./AI-DIAGRAM-TREND.md)。符号对照里的其余「未做」不升为 P0。

| ID | 需求 | 验收 |
|----|------|------|
| F-22 | 导入得到的节点可以没有坐标。编辑器用有限布局（分层或网格）摆开，不实现通用图布局引擎。再次导入同一张图时，按 id 合并：已有 `pos`、`size`、`via`、`fromSide`、`toSide`、色标引用保持；文案和新增/删除的节点与边可以更新 | Mermaid 与 Archify workflow 导入都走这条规则。无 `pos` 的节点落在可见区域且互不重叠。带 `pos` 或 `via` 的节点和边在第二次导入后坐标不变 |
| F-23 | `meta.editor.colorTags[]`：`id`、`label`、`fill`、`stroke`、`text`。流程图节点与架构组件引用 `tagId`，改色标定义则引用者一起变，并写入现有 `style`。图例由色标生成。`ArchifyComponent.tag` 仍是角标文案 | 流程图色标留在编辑 JSON。架构 finalize 剥离 `meta.editor` 与自由 `style`，HTML 仍按组件 `type` 着色 |
| F-24 | 从判断节点拉出的第一条边默认文案「是」，第二条默认「否」。已有文案不覆盖 | 人可以改掉默认文案。非判断节点不自动写这两个字 |
| F-09 / F-18 | draw.io 子集进出。导入须确认 flowchart 或 architecture。矩形、圆角矩形、菱形、边、文字、填色、描边、坐标进入 IR。厂商图标与未识别形状丢弃并 toast | 夹具进 [`TEST-MATRIX.md`](./TEST-MATRIX.md)。导出的文件能在 diagrams.net 打开，拓扑与填色还在 |
| F-25 | 架构连线可拖拐点，写入 `via`。选中 boundary 时可增删 `wraps` 里的组件 id。`route: curve` 仍只留在编辑态，finalize 去掉 | 绕障后的拐点在保存再打开后还在。成员增删后 `wraps` 与画布分组一致 |

## 4. 软件方案

### 4.1 软件总体架构

#### 4.1.1 分层架构

自顶向下五层；依赖单向向下，禁止 UI 直接调用 CLI 细节（经桥接适配）：

```text
┌─────────────────────────────────────────────────────────┐
│  Presentation（表现层）                                  │
│  顶栏 / 组件板 / Canvas（缩放手柄）/ 检查器（尺寸·颜色）/ 导出 / Toast │
├─────────────────────────────────────────────────────────┤
│  Application（应用层）                                   │
│  命令：新建、打开、保存、Undo、切换类型、触发导出/导入     │
│  Use-case 编排（不持有几何细节）                          │
├─────────────────────────────────────────────────────────┤
│  Domain（领域层）                                        │
│  FlowchartDocument / ArchitectureDocument                │
│  校验规则、类型投影、层归属 / wraps 同步                   │
├─────────────────────────────────────────────────────────┤
│  Infrastructure（基础设施）                              │
│  File IO、localStorage 草稿、Mermaid/draw.io Codec       │
│  ArchifyBridge（spawn finalize / 复制命令）              │
│  ExportRaster（SVG→Canvas→PNG）                          │
├─────────────────────────────────────────────────────────┤
│  External（外部系统）                                    │
│  浏览器 File API · Node Archify CLI · 用户文件系统        │
└─────────────────────────────────────────────────────────┘
```


| 层    | 职责            | 技术落点（目标态）                           |
| ---- | ------------- | ----------------------------------- |
| 表现层  | 交互与渲染         | React 组件、`styles.css`               |
| 应用层  | 用例编排、菜单动作     | hooks / command handlers            |
| 领域层  | IR、不变量、投影     | `types` + store + validators        |
| 基础设施 | IO、编解码、进程桥    | `import/`、`export/`、`archifyBridge` |
| 外部   | OS / CLI / 文件 | Vite 开发态；可选本地小代理                    |


**architecture 图内「分层泳道」**（`mode: layered`）属于领域语义与画布策略，细则见 `[layered-architecture-plan.md](./layered-architecture-plan.md)`，与上表「软件分层」不是同一概念。

#### 4.1.2 开发视图

目标目录与职责（MVP 可仍集中在 `App.tsx`，按此拆分）：

```text
archify-editor/
├── docs/                      # 方案归档（本文件及子方案）
├── test/                      # 可验证门禁：fixtures / unit / e2e（见 test/README.md）
├── tools/
│   ├── archify/               # 自包含 Archify CLI 归档（finalize 优先）
│   └── archify-patches/       # 本地补丁记录（升级 CLI 时重放）
├── public/
├── src/
│   ├── main.tsx               # 入口
│   ├── App.tsx                # 壳（过渡期）
│   ├── app/                   # 应用壳：类型选择、全局布局、命令栏
│   ├── shared/                # Canvas 壳、Undo、文件对话框、Toast
│   ├── flowchart/             # FlowchartStore、Palette、ShapeRenderer、mermaidCodec
│   ├── architecture/          # ArchitectureStore、Palette、Boundary/Layer 渲染
│   ├── import/                # mermaidParse、drawioParse、detectType
│   ├── export/                # json / svg / png / html 导出实现
│   ├── bridge/                # ArchifyBridge（finalize、命令模板）
│   ├── types.ts               # 共用信封与类型
│   ├── sample.ts              # 示例文档
│   └── styles.css
├── package.json
└── README.md
```

**运行时拓扑（开发）**：

```text
  Browser (Vite :5173)
       │  编辑 IR
       ▼
  Editor Domain Store
       │  export HTML
       ▼
  ArchifyBridge ──spawn/CLI──► archify.mjs finalize
       │                              │
       ▼                              ▼
  下载 .html ◄─────────────── showcase Viewer HTML
```

无 Node / CLI 不可用时：Bridge 返回错误 → UI 展示原因 → 提供「复制 finalize 命令」。

#### 4.1.3 模块功能说明


| 模块                 | 功能                                     | 主要输入/输出                        |
| ------------------ | -------------------------------------- | ------------------------------ |
| **app/**           | 双类型壳、顶栏、导出菜单、类型切换确认                    | `diagram_type`、全局命令            |
| **shared/canvas**  | 平移缩放、选中、拖拽写回 `pos`、**八向改 `size`**、连线手势 | 指针事件 → 领域命令                    |
| **shared/style**   | 填色/描边/字色、色板、格式刷                        | `style` → IR                   |
| **shared/undo**    | 命令栈（P0 至少单步）                           | 快照或 inverse ops                |
| **flowchart/**     | 流程形状板、决策多出边、flowchart IR               | `FlowchartDocument`            |
| **architecture/**  | 组件 type、connections、boundaries、layered | Archify `architecture` JSON    |
| **import/**        | Mermaid/draw.io 解析与类型路由                | 文本/文件 → IR + `format_hints`    |
| **export/**        | JSON/SVG/PNG/HTML 文件下载                 | IR → Blob / 下载                 |
| **bridge/**        | 调用 finalize、剥离 `meta.editor`、命令兜底      | architecture JSON → HTML 路径或错误 |
| **types / sample** | 信封 schema、示例图                          | 启动默认文档                         |


### 4.2 系统流程

#### 4.2.1 新建与编辑主流程

```text
开始
  → 选择 diagram_type（flowchart | architecture）
  → 加载空白模板或示例
  → [循环] 拖拽节点 / 缩放框体 / 改颜色 / 连线 / 改属性 / Undo
  → 用户保存或导出
结束
```

类型切换：二次确认 → 尝试字段投影 → 失败则清空不兼容字段（见双类型方案）。

#### 4.2.2 打开 / 导入流程

```text
用户选择文件或粘贴
  → 按扩展名/内容嗅探
       ├─ *.flowchart.json / *.architecture.json → 信文件名，校验内容 diagram_type
       ├─ .mmd / 粘贴 Mermaid → import/mermaidParse → 路由类型
       └─ .drawio / .xml → 启发式建议类型 → 【用户确认】→ 解析
  → 写入 meta.format_hints.source
  → 载入对应 Store → 刷新画布
```

冲突：文件名与内容 `diagram_type` 不一致时以**内容为准**并 Toast。

#### 4.2.3 导出流程

```text
用户打开「导出」菜单
  ├─ JSON  → 序列化当前 IR → 下载（P0）
  ├─ HTML  →（architecture）Bridge.finalize → 成功则下载 .html
  │            失败 → Toast 原因 + 「复制 CLI」
  │         （flowchart）P1：workflow 映射或简易 HTML
  ├─ SVG   → 画布/Viewer 序列化 → 下载（P1）
  └─ PNG   → 栅格化（1x/2x）→ 下载（P1）
```

#### 4.2.4 Finalize（HTML）桥接子流程

```text
exportHtml(architectureDoc)
  → 深拷贝并剥离 meta.editor 等非法字段
  → 可选：Ajv / Archify validate
  → 调用本机 archify finalize architecture <tmp.json> <out.html> --quality showcase
  → 读取 out.html → 触发浏览器下载
  → 清理临时文件
失败路径：捕获 stderr → 用户可读错误 → 展示等价 CLI 字符串
```

#### 4.2.5 分层架构编辑子流程（architecture + layered）

```text
进入 layered 模式
  → 渲染层带；组件拖拽钳制在所属层
  → 维护 meta.editor.layers 与 boundaries.wraps 同步
  → 导出 / finalize 前投影为合法 Archify JSON（空层策略见分层方案）
```

---

## 5. 类型命名约定

```text
diagram_type: "flowchart" | "architecture"
```

- 文件建议：`*.flowchart.json` / `*.architecture.json`，或统一 `*.diagram.json` + 内嵌 `diagram_type`
- UI 显示中文；**存储与 API 只用英文枚举**（完整拼写 `architecture`，不用 `arch`）
- 分层不是第三类型：`architecture` + `meta.editor.mode: "layered" | "free"`


| 类型             | 对齐生态                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `flowchart`    | Mermaid `flowchart` / `graph`；draw.io Flowchart 库                        |
| `architecture` | Archify `architecture`；Mermaid C4 / `architecture-beta`；draw.io 软件/网络类用法 |


---

## 6. 用户旅程与信息架构

### 6.1 用户旅程

1. 新建时选择 **Flowchart** 或 **Architecture**（或导入后自动识别）
2. 按类型加载组件板 / 模板（流程形状 vs 架构组件；架构可选手动分层）
3. 画布拖拽、**缩放框体**、连线、**颜色与属性**编辑
4. 导出：JSON（必选）；Architecture **HTML**（P0）；**SVG / PNG**（P1）；Flowchart 另可导出 Mermaid（P1）或映射 workflow → HTML（可选）

### 6.2 信息架构（双类型共用壳）


| 区域  | Flowchart                | Architecture                               |
| --- | ------------------------ | ------------------------------------------ |
| 顶栏  | 类型切换（谨慎）、导入导出、Undo       | 同左 + Finalize / 导出 HTML                    |
| 左侧板 | 起止/过程/判断/子流程等            | external/frontend/backend/… + 层列表（layered） |
| 画布  | 自由节点 + 折线/正交边            | free：自由拓扑；layered：泳道层带                     |
| 检查器 | 文案、**宽高、填色/描边/字色**、边条件   | 组件语义、**宽高与颜色**、boundary/层归属                |
| 底栏  | `diagram_type=flowchart` | `diagram_type=architecture` + mode         |


---

## 7. 数据模型

### 7.1 共用信封

```json
{
  "schema_version": 1,
  "diagram_type": "flowchart | architecture",
  "meta": {
    "title": "string",
    "output": "portable.html",
    "locale": "zh-CN",
    "editor": { },
    "format_hints": {
      "source": "native | mermaid | drawio | archify",
      "original_name": "optional"
    }
  }
}
```

### 7.2 `architecture`（已对接 Archify）

- Schema 钉扎：`[schemas/ARCHIFY-PIN.md](../schemas/ARCHIFY-PIN.md)`（参考 Archify **3.0.1**）
- 字段：`components` / `connections` / `boundaries` / `cards` / 可选 `layout`
- 几何权威：`components[].pos` / `size`（画布手柄与检查器双向写回）
- 样式：`style` 或 `meta.editor.styles`（见 §3.7.3）
- 分层：见 `[layered-architecture-plan.md](./layered-architecture-plan.md)`
- 交付：`archify finalize architecture …`

### 7.3 `flowchart`（编辑器一等公民）

**机器可读权威**：`[schemas/flowchart.schema.json](../schemas/flowchart.schema.json)`（ADR-0001）。示意：

```json
{
  "diagram_type": "flowchart",
  "meta": { "title": "…", "output": "flow.html" },
  "nodes": [
    {
      "id": "n1",
      "shape": "start|process|decision|end|subprocess",
      "label": "…",
      "pos": [x, y],
      "size": [w, h],
      "style": { "fill": "#E8F1FF", "stroke": "#3B6FD8", "text": "#1A1A1A", "strokeWidth": 1.5 }
    }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "是", "route": "ortho", "style": { "stroke": "#5A5A5A", "strokeWidth": 1.5 } }
  ]
}
```


| 策略                           | 说明                    |
| ---------------------------- | --------------------- |
| **A. 独立 flowchart IR（已采纳）**  | 见 ADR-0001；schema 在本仓 |
| **B. 映射 Archify `workflow`** | 导入正式必做（F-21）；导出可选     |
| **C. 仅用 architecture 冒充流程**  | **禁止**                |


交付（分期）：P0 导出 JSON；P1 导出 Mermaid / SVG / PNG，可选映射 `workflow` finalize → HTML。详见 §3.5。

---

## 8. 在线编辑能力矩阵


| 能力                          | flowchart        | architecture (free)      | architecture (layered) |
| --------------------------- | ---------------- | ------------------------ | ---------------------- |
| 拖拽节点改坐标                     | ✅                | ✅                        | ✅（层内钳制）                |
| **框体缩放（八向手柄 + 宽高）**         | **P0**           | **P0**                   | **P0**（层带可改高）          |
| **填充 / 描边 / 文字色**           | **P0**           | **P0**                   | **P0**                 |
| 增删节点/连线                     | ✅                | ✅                        | ✅                      |
| 属性检查器                       | ✅ + 尺寸颜色         | ✅ + 尺寸颜色                 | ✅ + 层归属 + 尺寸颜色         |
| 导入/导出 JSON                  | ✅                | ✅                        | ✅                      |
| 决策节点多出边                     | ✅                | —                        | —                      |
| 组件语义 type                   | —                | ✅                        | ✅                      |
| boundaries / 层带             | —                | 可选                       | ✅                      |
| **导出 Archify JSON**         | —（workflow 为 P1） | **P0**                   | **P0**                 |
| **导出 HTML（finalize）**       | P1（workflow 映射）  | **P0**                   | **P0**                 |
| **导出 Mermaid**              | **P1**           | P1（有限/有损）                | P1（有限）                 |
| **导出 draw.io**              | **P0**           | **P0**                   | **P0**                 |
| **导出 SVG / PNG**            | P1               | P1                       | P1                     |
| **导入 Archify architecture** | —                | **P0**                   | **P0**                 |
| **导入 Archify workflow**     | **P1（正式必做）**     | —                        | —                      |
| **导入 Mermaid**              | **P1**           | P1（C4/architecture-beta） | P1                     |
| **导入 draw.io**              | **P0**           | **P0**                   | **P0**                 |


---

## 9. 导入扩展（主流流程图 / 架构图格式）

目标见 **§3.0**；需求总表见 **§3.9 / §3.10**。实现细则见 `[dual-type-editing-plan.md](./dual-type-editing-plan.md)` §5。

摘要路由：

```text
.json / 粘贴 JSON
  ├─ diagram_type=architecture 或含 components[]     → architecture（source=archify|native）
  ├─ diagram_type=workflow（Archify）                 → flowchart 投影（P1 正式必做，source=archify）
  ├─ diagram_type=flowchart 或含 nodes[]+edges[]      → flowchart（source=native）
  └─ 无法识别                                         → 弹窗确认 / 拒绝并提示

.mmd / 粘贴 Mermaid
  ├─ flowchart|graph     → flowchart（source=mermaid）
  ├─ C4*|architecture*   → architecture（source=mermaid）
  └─ sequence|state…     → 拒绝并提示

.drawio / .xml
  ├─ 库名含 Flowchart / 菱形决策占优 → 建议 flowchart（须用户确认）
  └─ 云/软件形状或用户选择         → 建议 architecture（须用户确认）
```

导入后写入 `meta.format_hints.source`（`archify` | `mermaid` | `drawio` | `native`），便于往返导出。

---

## 10. 实施分期

### 已完成（MVP）

- [x] architecture 自由画布：拖拽 / 导入导出 / 连线 / 检查器
- [x] Finalize 命令提示

### P0 — 双类型在线编辑 + HTML 导出

- [x] 顶栏/新建：`flowchart` | `architecture` 类型选择与切换确认
- [x] flowchart IR + 形状板（起止/过程/判断/结束）+ 同款拖拽编辑
- [x] 按类型切换组件板与导出文件名后缀
- [x] architecture：boundaries 可视化；分层模式启动（见分层方案 P0）
- [x] **框体大小可编辑**（八向手柄 + 检查器宽高）
- [x] **颜色可编辑**（填充/描边/文字 + 边线色宽；色板 + 取色器）
- [x] JSON 导出 + architecture 应用内 Finalize HTML；失败回退「复制命令」
- [ ] **统一导出菜单灰显**（F-19 未完全收口；现为分散按钮）
- [ ] **导出「剥离私有字段的 Archify JSON」独立项**（F-16 部分：finalize 已剥离，单独下载项待补）

### P0.5 — 编辑基线补洞（见 [`EDITING-GAP.md`](./EDITING-GAP.md) Slice A）

- [x] **快捷键**：Ctrl+C/V/X/D；Redo（Ctrl+Y / Ctrl+Shift+Z）
- [x] **双击节点**内联改文案；箭头键微调（Shift=10px）
- [x] flowchart **检查器切换 shape**
- [x] architecture **区域框填色/描边**（`meta.editor.boundaryStyles`，finalize 剥离）

### P1 — 互通、对齐能力与位图/矢量导出

- [ ] 网格吸附、多选对齐/分布、格式刷（复制粘贴右键已有，缺多选与快捷键见上）
- [x] **导出 SVG / PNG**（画布快照；含当前主题色）
- [x] **导出 Mermaid**（flowchart `.mmd`；architecture 有损）
- [x] **导入 Mermaid**（简易 flowchart；C4 仍待）
- [x] **导入 Archify `diagram_type: "workflow"`** → flowchart（F-21：投影 + 泳道编辑态 + 保留源文档）
- [x] **flowchart / 导入 workflow → Archify `finalize workflow` 导出 HTML**（优先用保留源文档保真；无源则合成）
- [x] **统一导入/导出入口**（格式下拉；draw.io 仍灰显，需求已是 P0，见 §3.11）
- [x] flowchart → 独立下载 Archify `workflow` JSON（导出菜单）
- [ ] architecture layered 完整 P0/P1（层高拖拽等见 EDITING-GAP E-A5）

### P0 补充 — AI 草稿可改（§3.11，顺序固定）

- [x] **F-22** 空坐标有限布局；再导入保留 `pos` / `via` / 锚点 / 色标引用（Mermaid 与 workflow 共用）
- [x] **F-23** 命名色标与图例（`meta.editor.colorTags`；架构导出仍按类型）
- [x] **F-24** 判断出边默认「是 / 否」
- [x] **F-09 / F-18** draw.io 子集进出（矩形、菱形、边、文字、填色；厂商图标丢弃并提示）
- [x] **F-25** 架构边拐点；boundary 成员可增删

### P2 — 更多栅格格式

draw.io 子集已升为 P0（§3.11），不再放在本档。

- [ ] 可选导出 JPEG / WebP（复用 PNG 管线）

### P3+ — 长尾主流格式（按需）

- [ ] PlantUML / Graphviz DOT 导入导出（规划）
- [ ] Visio `.vsdx` 只读导入（规划）
- [ ] Structurizr DSL / C4 PlantUML（规划）

---

## 11. 与 Archify 的边界


| 能力                                         | Archify       | Editor                    |
| ------------------------------------------ | ------------- | ------------------------- |
| architecture 校验与精美 HTML                    | ✅             | 调用 finalize               |
| workflow 精美 HTML                           | ✅             | flowchart 可选映射            |
| flowchart 一等编辑                             | ❌             | ✅ Editor                  |
| 拖拽 / 框体缩放 / 颜色 / 分层泳道                      | ❌             | ✅（日常编辑基线）      |
| Mermaid / draw.io / Archify JSON **导入与导出** | 交付侧 JSON/HTML | ✅ 编辑器进出（分期见 §3.9 / §3.10） |
| SVG / PNG 导出                               | Viewer 具备     | 编辑器菜单 P1 对接或自研画布导出        |


---

## 12. AI 友好规格治理（契约 / 可观测 / 门禁）

> 对齐「规格优先 · 边界显式 · 契约完备 · 上下文可检索 · 生成可验证 · 可观测可回滚」。导航见 `[SPEC-INDEX.md](./SPEC-INDEX.md)`。

### 12.1 Codec 契约（Σ）

可插拔编解码统一实现：

```ts
interface DiagramCodec {
  detect(input: string, fileName?: string): ImportRoute | null
  parse(input: string, fileName?: string): ParseResult
  encode?(diagram: AnyDiagram): { text: string; mime: string; lossy?: LossyReport }
}
```


| Codec id           | 输入                            | 输出 IR                    | 分期            |
| ------------------ | ----------------------------- | ------------------------ | ------------- |
| `native`           | flowchart / architecture JSON | 同类型                      | P0            |
| `archify-workflow` | `"diagram_type":"workflow"`   | flowchart 投影             | **P1（已落地核心）** |
| `mermaid`          | `.mmd` / 粘贴                   | flowchart 或 architecture | P1            |
| `drawio`           | `.drawio` / `.xml`            | 用户确认类型                   | P2            |


类型定义：`[src/import/types.ts](../src/import/types.ts)`。workflow 投影：`[src/import/workflowProjection.ts](../src/import/workflowProjection.ts)`。

### 12.2 错误码


| code                 | 含义                 | 用户动作             |
| -------------------- | ------------------ | ---------------- |
| `ParseError`         | 语法 / JSON 解析失败     | 修正文件后重试          |
| `ValidateError`      | 缺字段 / schema 不合法   | 对照 schema        |
| `TypeMismatch`       | 文件名与内容类型冲突         | 以内容为准并 Toast     |
| `UnsupportedFormat`  | sequence/state 等拒绝 | 换格式或手动画          |
| `BridgeError`        | finalize / CLI 失败  | 看原因或复制 CLI       |
| `LossyImportWarning` | 有损投影（非阻断）          | Toast 列出 dropped |


### 12.3 Finalize 状态机

```text
idle → validating → running → success → cleanup → idle
                 ↘ failed → cleanup → idle（保留错误文案 + CLI 兜底）
```

Bridge 负责状态迁移；UI 只订阅 `idle|validating|running|success|failed`。

### 12.4 导入快照与回滚

1. 用户确认导入前：深拷贝当前 `AnyDiagram` 为 `importSnapshot`。
2. 解析失败：不替换画布，展示 `ParseError`/`ValidateError`。
3. 有损成功：替换画布 + `LossyImportWarning`；提供「撤销导入」（一步 Undo 或恢复 snapshot）。
4. localStorage 草稿：键 `archify-editor:draft:{diagram_type}`；启动时若脏草稿则提示恢复（P1）。

### 12.5 Current vs Target 模块


| 区域       | Current（过渡）                         | Target                                     |
| -------- | ----------------------------------- | ------------------------------------------ |
| 壳 / 命令   | `App.tsx` 集中                        | `src/app/` 命令栏 + use-cases                 |
| IR / 不变量 | `domain/document.ts`                | 保持；校验对齐 `schemas/`                         |
| 导入       | `import/openDocument` + workflow 投影 | 全 Codec 注册表 + 统一入口 UI                      |
| 导出       | `export/download.ts`                | `export/` 分格式 + 菜单灰显                       |
| Bridge   | finalize 已有                         | 显式状态机 + 错误码                                |
| UI       | `ui/*`                              | `shared/` + `flowchart/` + `architecture/` |


**约束**：新增 Codec、校验、Bridge **不得**继续堆进 Canvas；可暂时从 `App` 接线。

### 12.6 生成可验证 / CI 门禁

本地与 CI 最小门禁：

```bash
npm test
npm run build
```


| 门禁      | 要求                                          |
| ------- | ------------------------------------------- |
| 单元 / 夹具 | workflow 黄金文件、`demo.flowchart.json` 打开路径    |
| 类型检查    | `tsc --noEmit`（含在 build）                    |
| 可选      | 本机 `archify validate` 对剥离后的 architecture 样例 |


Agent / PR：改 Codec 或投影须更新或保持 `test/fixtures/` + `test/unit` / `test/e2e` 绿色。