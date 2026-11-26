# Vendored Archify CLI（本仓库归档）

本目录是 **Archify** 的本地归档副本，位于 `Archify-Editor/tools/archify`，供编辑器自包含调用 `finalize` / `validate`，**不依赖**并列目录或 `%USERPROFILE%\.cursor\skills\archify`。

| 项 | 说明 |
|----|------|
| 来源 | Cursor Skill Archify 3.0.1 + 本仓库补丁 |
| 入口 | `bin/archify.mjs` |
| 补丁 | workflow `col` 上限 63，见 [`../archify-patches/`](../archify-patches/) |
| 运行时依赖 | **无需** `npm install` 即可 `finalize`（校验器已生成进 `renderers/shared/`） |
| 再生校验器 / 跑 skill 测试 | 需在本目录执行 `npm install` |

## 与编辑器的关系

Vite 插件按以下顺序查找 CLI：

1. 环境变量 `ARCHIFY_BIN`
2. **`tools/archify/bin/archify.mjs`（本目录，优先）**
3. 兼容回退：旧并列 `../archify`、Cursor skill 路径

## 手动命令示例

```powershell
# 在 Archify-Editor 根目录
node .\tools\archify\bin\archify.mjs finalize architecture .\examples\demo.architecture.json .\out.html --quality showcase --json
node .\tools\archify\bin\archify.mjs finalize workflow .\tools\archify\examples\agent-tool-call.workflow.json .\out.html --quality showcase --json
```

## 升级官方 skill 时

1. 备份本目录或对比 diff  
2. 覆盖拷贝官方 skill  
3. 重放 [`../archify-patches/`](../archify-patches/)  
4. （可选）`npm install && npm run generate:validators`  
5. 冒烟 `finalize` 样例  
