# Archify Editor — 部署文档

> 上位文档：[`DESIGN.md`](./DESIGN.md)  
> 目标：**一键部署**、**资源占用少**、Windows / Linux 均可落地；编辑器本体为静态前端，Finalize（HTML）为可选本机能力。

---

## 1. 部署形态总览

| 形态 | 说明 | 资源占用 | 适用 |
|------|------|----------|------|
| **A. 静态站点（推荐生产）** | `npm run build` → 托管 `dist/` | 极低（仅静态文件服务） | 内网 Nginx / 文件服务器 / 对象存储 |
| **B. 一键本地服务** | 脚本安装依赖、构建并拉起轻量预览服 | 低（单 Node 进程） | 开发机、临时演示 |
| **C. 开发热更新** | `npm run dev`（Vite） | 中（含编译缓存） | 日常开发，非生产 |
| **D. 完整能力（含 HTML 导出）** | A/B + 本机 Node + Archify CLI | 低～中（导出瞬间升高） | 需要应用内 Finalize 的环境 |

**原则**：默认只部署 **静态前端**；不强制常驻数据库、消息队列或重型后端。Archify Finalize 按需调用，用完即退，避免常驻占用。

```text
[浏览器]
    │  HTTP 静态资源
    ▼
[轻量 Web 服务]  ← nginx / vite preview / 一键脚本
    │  dist/*
    │
    └─（可选）本机 Archify CLI ← 仅导出 HTML 时短时拉起
```

---

## 2. 硬件与环境要求

### 2.1 最低配置（仅浏览 / 编辑 / 导出 JSON·SVG·PNG）

| 项 | 要求 |
|----|------|
| CPU | 1 核（x86_64 或 aarch64） |
| 内存 | **512 MB** 可用（推荐 1 GB） |
| 磁盘 | **200 MB**（含 Node 工具链与 `node_modules` 构建时约 300～500 MB；纯 `dist` 部署可 **&lt; 20 MB**） |
| 显示 | 现代浏览器（Chrome / Edge / Firefox 近两年版本） |
| 网络 | 可离线使用已构建的 `dist/`；首次 `npm install` 需能访问 npm 源 |

### 2.2 推荐配置（含本机 Finalize HTML）

| 项 | 要求 |
|----|------|
| CPU | 2 核 |
| 内存 | **2 GB** 可用（Finalize 峰值建议留 1 GB 余量） |
| 磁盘 | 1 GB（含 Node ≥ 18、Archify skill/CLI） |
| Node.js | **≥ 18**（构建与 Finalize 共用） |

### 2.3 资源占用预期（设计目标）

| 进程 | 空闲 RSS（约） | 峰值 | 备注 |
|------|----------------|------|------|
| 静态 Nginx 托管 `dist` | &lt; 20 MB | 低 | **生产首选，占用最少** |
| `vite preview` / 一键 Node 静态服 | 40～80 MB | &lt; 150 MB | 单用户演示足够 |
| `vite` 开发服 | 150～300 MB | 更高 | 仅开发 |
| `archify finalize` | 0（不常驻） | 数百 MB 级短时 | 导出结束后退出 |

控制手段：生产不跑 `dev`；Finalize 不做成常驻 Worker；避免为编辑器单独起 Java/重型中间件。

---

## 3. Windows 与 Linux 部署差异

| 主题 | Windows | Linux |
|------|---------|-------|
| 一键入口 | `scripts\deploy.ps1` 或 `scripts\deploy.cmd` | `scripts/deploy.sh` |
| 包管理 / Node | winget / 官网安装包；路径含空格需引号 | apt/yum/fnm/nvm；`nodejs` ≥ 18 |
| 路径分隔 | `\`；用户目录用 `%USERPROFILE%` | `/`；`$HOME` |
| 静态托管 | IIS（可选）、Nginx for Windows、或脚本内 `npm run preview` | **Nginx / Caddy** 最常见 |
| 防火墙 | 放行预览端口（默认 `4173`）或 80/443 | `firewalld` / `ufw` 放行同理 |
| 权限 | 普通用户即可跑预览；系统服务需管理员 | 建议专用用户跑服务；Nginx 用 www-data |
| Finalize CLI | 优先本仓库 `tools\archify\bin\archify.mjs`；可选 `ARCHIFY_BIN` | 同左（POSIX 路径） |
| 行尾 / 脚本 | PowerShell 执行策略可能拦截 → `RemoteSigned` 或用 `.cmd` | `chmod +x scripts/deploy.sh` |
| 服务常驻 | NSSM / 计划任务挂 `preview`（可选） | systemd unit 挂 Nginx 或 `preview` |

**行为一致部分**：同一套 `package.json` 脚本；产物同为 `dist/`；浏览器侧无 OS 差异。

**能力差异部分**：浏览器无法直接 `spawn` 本机 CLI——应用内一键 HTML 若需真正跑 Finalize，需配套「本机桥」（如本机小代理或 Tauri/Electron 壳）。当前 MVP 以「复制 CLI / 开发机执行」为兜底；一键部署**不阻塞**在无桥接环境下使用编辑与 JSON 导出。

---

## 4. 一键部署（期望与用法）

### 4.1 设计目标

1. **一条命令**完成：依赖安装 → 生产构建 → 拉起轻量服务（或提示 Nginx 路径）。  
2. **可重复、可中断续跑**：已安装则跳过；失败给出可读错误。  
3. **默认低占用**：构建完成后只起静态预览，不启多余进程。  
4. **可选开关**：`--no-serve` 仅构建；`--with-archify-check` 检测 Finalize 是否可用。

### 4.2 命令速查

**Windows（PowerShell）**

```powershell
cd tools\archify-editor
.\scripts\deploy.ps1
# 仅构建：
.\scripts\deploy.ps1 -NoServe
# 确需清理 node_modules 后重装：
.\scripts\deploy.ps1 -ReinstallDeps
```

**Windows（CMD）**

```bat
cd tools\archify-editor
scripts\deploy.cmd
# 参数同样可直接转给 PowerShell：
scripts\deploy.cmd -NoServe
```

**Linux / macOS**

```bash
cd tools/archify-editor
chmod +x scripts/deploy.sh
./scripts/deploy.sh
# 仅构建：
./scripts/deploy.sh --no-serve
```

成功后默认访问：**http://127.0.0.1:4173/**（`vite preview`，host `0.0.0.0` 时可局域网访问）。
Windows 每次启动都会在 `logs\deploy-时间戳.log` 保留完整控制台、构建和预览日志，失败时不会自动删除。

### 4.3 脚本行为（约定）

```text
deploy
  → 检查 node/npm（≥18）
  → 新建 logs\deploy-*.log
  → 依赖完整：跳过安装
  → node_modules 缺失：npm ci / npm install
  → node_modules 残缺：npm install 修复
  → 仅 -ReinstallDeps：强制 npm ci
  → npm run build
  →（默认）npm run preview -- --host 0.0.0.0 --port 4173
  → 打印 URL、资源说明和日志路径
```

脚本位于仓库 [`scripts/`](../scripts/)，与本文同步维护。

### 4.4 生产「一键」进阶（拷贝 dist）

构建机执行一键构建后，仅同步 `dist/` 到服务器：

```bash
# 示例：rsync 到 Linux Nginx 站点目录
rsync -av --delete dist/ user@host:/var/www/archify-editor/
```

服务器 Nginx 仅托管静态文件，**无需 Node 常驻**，资源占用最少。

---

## 5. 分步部署说明

### 5.1 构建

```bash
cd tools/archify-editor
npm install
npm run build
```

产物：`dist/index.html` 与 `dist/assets/*`。

### 5.2 Linux + Nginx（推荐生产）

示例片段：

```nginx
server {
    listen 80;
    server_name archify-editor.example.local;
    root /var/www/archify-editor;
    index index.html;

    # SPA：未命中文件回退到 index
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存（按需）
    location /assets/ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5.3 Windows 轻量方式

1. 运行 `scripts\deploy.ps1` 使用内置预览服；或  
2. 将 `dist\` 放到 IIS 站点物理路径，启用静态内容；或  
3. 安装 Nginx for Windows，`root` 指向 `dist`。

### 5.4 仅用系统自带工具托管（无 Nginx 时）

构建完成后：

```bash
# Linux：Python 亦可，占用略高于 Nginx
python3 -m http.server 4173 --directory dist
```

```powershell
# Windows：推荐仍用 npm run preview；或
npx --yes serve -s dist -l 4173
```

优先顺序（占用从低到高）：**Nginx 静态 → vite preview → npx serve → 开发 vite**。

---

## 6. Finalize（HTML 导出）部署说明

| 场景 | 是否需要 Archify CLI | 说明 |
|------|----------------------|------|
| 只编 JSON / 看画布 | 否 | 静态部署即可 |
| 导出 SVG/PNG（画布方案） | 否 | 浏览器侧完成 |
| 导出精美 HTML | **是** | 本机 Node + `archify.mjs` |

Windows 示例：

```bat
node "tools\archify\bin\archify.mjs" finalize architecture path\to\diagram.architecture.json out.html --quality showcase --json
```

Linux 示例：

```bash
node ./tools/archify/bin/archify.mjs finalize architecture ./diagram.architecture.json ./out.html --quality showcase --json
```

一键脚本可用 `--with-archify-check` 仅做路径探测，**不**为此常驻守护进程。

---

## 7. 配置与端口

| 项 | 默认 | 说明 |
|----|------|------|
| 开发端口 | `5180` | `npm run dev` / `npm run serve`，`strictPort` 固定，支持多浏览器窗口访问同一地址 |
| 预览 / 一键端口 | `4173` | `npm run preview` / deploy 脚本 |
| 生产 HTTP | `80` / `443` | Nginx 等 |
| 环境变量 | 无强依赖 | 后续若加 Finalize 代理，可用 `ARCHIFY_BIN`、`ARCHIFY_BRIDGE_URL` |

---

## 8. 验收清单

- [ ] 目标机满足 §2 最低硬件  
- [ ] `node -v` ≥ 18（若本机构建或 Finalize）  
- [ ] 一键脚本或 `npm run build` 成功产物在 `dist/`  
- [ ] **CI / 本地门禁**：`npm test` 与 `npm run build` 均通过（见 [`DESIGN.md`](./DESIGN.md) §12.6）  
- [ ] 浏览器打开站点可加载编辑器、导入导出 JSON（含 workflow → flowchart）  
- [ ] （可选）Finalize CLI 可手动跑通  
- [ ] 生产环境无长期运行的 `vite` 开发进程  
- [ ] 内存占用符合 §2.3 预期量级（静态托管优先）  

### 8.1 建议 CI（最小）

```yaml
# 示意：任意 CI 跑两步即可
- run: npm ci
- run: npm test
- run: npm run build
```

Codec / 投影变更须保持 `test/fixtures/` 黄金夹具与 `npm test` / `npm run test:e2e` 绿色（[`SPEC-INDEX.md`](./SPEC-INDEX.md)）。  

---

## 9. 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 一键脚本无法执行（Win） | 执行策略限制 | 用 `deploy.cmd`，或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `npm ci` 报 `EPERM` / 文件占用 | 上次失败留下残缺依赖，或 Vite/Node 正在占用 `node_modules` | 关闭相关进程后直接重跑；默认会改用 `npm install` 修复。仅确需全量重建时用 `-ReinstallDeps` |
| `npm install` 失败 | 网络 / 源 | 配置公司镜像；离线可拷贝已装好的环境 |
| 页面路由 404 | 静态服未做 SPA fallback | Nginx `try_files` 见 §5.2 |
| Finalize 找不到 | CLI 未安装或路径不同 | 设置/导出正确 `archify.mjs` 路径；先用复制命令手跑 |
| 端口占用 | 4173/80 被占 | 改端口或结束占用进程 |
| 内存紧张 | 误用 `dev` 当生产 | 改为 Nginx 托管 `dist` |

启动失败时先查控制台最后打印的 `Log retained at: ...`；日志默认位于
`tools\archify-editor\logs\deploy-*.log`。

---

## 10. 与总案关系

- 需求侧「本地/内网、低成本交付」见 [`DESIGN.md`](./DESIGN.md) §3。  
- Finalize 桥与导出菜单见总案 §3.5、§4.2。  
- 本文件只约束**如何装、如何跑、如何少占资源**；功能分期仍以总案为准。
