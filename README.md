# Archify Editor

基于统一 JSON-IR 的在线图编辑器，支持两类顶层格式：

| `diagram_type` | 说明 |
|----------------|------|
| **`flowchart`** | 流程图（步骤/分支）— 方案已定，P0 落地中 |
| **`architecture`** | 架构图（组件/边界/分层）— MVP 已可用 |

**目标**：支持**主流流程图、架构图格式的导入与导出**。首期闭环 **Archify · Mermaid · draw.io**；后续可扩展 PlantUML / Graphviz / Visio 等（见 [`docs/DESIGN.md`](./docs/DESIGN.md) §3.0）。

## 快速开始（开发）

```bash
# 克隆本仓库后，在仓库根目录：
npm install
npm run dev
```

默认 http://127.0.0.1:5180/ （端口固定为 5180，`strictPort` 防止被占用时漂移）。

### 本地服务（多浏览器窗口）

开发服务固定在 **5180**，可同时用多个浏览器窗口打开同一个地址，互不干扰：

- Windows：双击 `scripts/serve.cmd`，或运行 `npm run serve`
- Linux/macOS：`bash scripts/serve.sh`，或运行 `npm run serve`
- 然后每个浏览器窗口都访问 http://127.0.0.1:5180/

`serve` 不会自动弹出浏览器窗口；端口被占用会直接报错（而非换端口），以保证所有窗口始终指向同一实例。按 `Ctrl+C` 停止服务。

## 一键部署（低占用预览）

详见 [`docs/DEPLOY.md`](./docs/DEPLOY.md)（硬件要求、Windows/Linux 差异、Nginx 生产托管）。

```powershell
# Windows
.\scripts\deploy.ps1
# 或
scripts\deploy.cmd
```

Windows 启动日志保存在 `logs\deploy-*.log`，失败现场不会被删除。

```bash
# Linux / macOS
chmod +x scripts/deploy.sh
./scripts/deploy.sh
# 仅构建、不启服务（便于拷到 Nginx）：
./scripts/deploy.sh --no-serve
```

默认预览 http://127.0.0.1:4173/ 。生产建议只同步 `dist/` 到 Nginx，资源占用最少。

## 能力（当前 / P0）

- 顶栏切换 **Flowchart / Architecture / Layered**
- 流程图形状板与架构组件板；导入导出对应 `*.flowchart.json` / `*.architecture.json`
- 拖拽、八向缩放、属性宽高；填充/描边/文字色与连线色宽
- 流程图与架构图均支持**区域框**：符号库「容器 → 区域框」点击后拖拽绘制、或拖到画布直接放置；也可选中节点后右键“新建区域框”
- 符号库「连线」提供**直线 / 折线 / 曲线**：点击进入绘制模式后在空白处拖拽放置独立线段（无需连接节点），或直接把图块拖到画布；端点/拐点可拖，Delete 可删
- 顶栏“连线样式”分段控件（直线 / 折线 / 曲线）对标 draw.io / 亿图：决定新连线默认样式；选中已有连线时点击可立即改线路由。节点端口拖线连接仍然保留
- architecture 边界框可视化；分层泳道模板
- 导出 JSON；architecture **导出 HTML**（开发/预览服调用 Archify CLI；失败可复制命令）

## 导出 / 导入兼容（方案已纳入）

| 格式 | 导出 | 导入 |
|------|------|------|
| 本编辑器 JSON | **P0** | **P0** |
| **Archify** architecture JSON | **P0**（剥离私有字段） | **P0** |
| Archify **`diagram_type: "workflow"`** | P1（flowchart→workflow，可选） | **P1 正式必做**（→ flowchart） |
| Archify HTML（finalize） | **P0** architecture / P1 flowchart | — |
| **Mermaid** | **P1** | **P1** |
| **draw.io** | **P2** | **P2** |
| SVG / PNG | P1 | — |
| JPEG / WebP | P2（可选） | — |

详见 [`docs/DESIGN.md`](./docs/DESIGN.md) §3.5、**§3.9 导入**、**§3.10 导出**、[`docs/dual-type-editing-plan.md`](./docs/dual-type-editing-plan.md)。

## 方案文档

| 文档 | 内容 |
|------|------|
| [`docs/SPEC-INDEX.md`](./docs/SPEC-INDEX.md) | **规格入口（F/Q/K/Σ）**、门禁、ADR 索引 |
| [`AGENTS.md`](./AGENTS.md) | Agent 必读边界与验证命令 |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | **总案**：定位、需求、软件方案、§12 契约/可观测/CI |
| [`docs/CAPABILITIES.md`](./docs/CAPABILITIES.md) | 能力与非目标摘要 |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | **部署**：硬件要求、Win/Linux、一键部署、CI 门禁 |
| [`docs/dual-type-editing-plan.md`](./docs/dual-type-editing-plan.md) | 双类型在线编辑、IR、导入路由 |
| [`docs/layered-architecture-plan.md`](./docs/layered-architecture-plan.md) | architecture 分层泳道子模式 |
| [`docs/adr/`](./docs/adr/) | 架构决策记录 |
| [`schemas/`](./schemas/) | flowchart JSON Schema + Archify 钉扎 |
| Archify 架构图 HTML | `.archify/.../review-2/archify-editor.html` |

## 验证

```bash
npm test          # test/unit
npm run test:e2e  # test/e2e（Playwright）
npm run build
```

夹具与用例统一在 [`test/`](./test/)（见 [`test/README.md`](./test/README.md)、[`docs/TEST-MATRIX.md`](./docs/TEST-MATRIX.md)）。

## Finalize（本仓库自带 CLI）

Archify CLI 与补丁已归档在本仓库 [`tools/archify`](./tools/archify)、[`tools/archify-patches`](./tools/archify-patches)（见 [`tools/archify/VENDORED.md`](./tools/archify/VENDORED.md)）。克隆本仓库即可独立 `finalize`，**不必**再依赖并列目录或 Cursor skill。

```powershell
# 在 Archify-Editor 根目录
node .\tools\archify\bin\archify.mjs finalize architecture .\examples\demo.architecture.json .\out.html --quality showcase --json
node .\tools\archify\bin\archify.mjs finalize workflow .\tools\archify\examples\agent-tool-call.workflow.json .\out.html --quality showcase --json
```

可选覆盖：`$env:ARCHIFY_BIN = "...\archify.mjs"`
