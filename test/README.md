# 测试归档（可验证门禁）

本目录是 **unit / e2e / 黄金夹具** 的统一入口，避免夹具分散、路径硬编码。

```text
test/
├── fixtures/     # 黄金夹具（SSOT；与 docs/TEST-MATRIX.md 对齐）
├── helpers/      # fixturePath / fixtureText / fixtureJson
├── unit/         # Vitest：domain / import / export / io / ui
└── e2e/          # Playwright：浏览器导入等流程
```

## 命令

```bash
npm test          # Vitest → test/unit/**
npm run test:e2e  # Playwright → test/e2e/**
npm run build
```

聚焦导入导出矩阵：

```bash
npx vitest run test/unit/io/ioMatrix.test.ts
```

## 夹具复用

```ts
import { fixtureText, fixtureJson, fixturePath, FIXTURES } from '../helpers/fixtures'

fixtureText('demoFlowchart')
fixtureJson(FIXTURES.demoArchitecture)
fixturePath('subsetDrawio') // 绝对路径，供 Playwright setFiles
```

## 与 examples/

手工试用的示例已迁入 `test/fixtures/`。`examples/README.md` 说明去向；产品文档与矩阵均以本目录为准。
