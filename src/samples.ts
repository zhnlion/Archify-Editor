import type { ArchifyDiagram, FlowchartDocument } from './types'

export const sampleArchitecture: ArchifyDiagram = {
  schema_version: 1,
  diagram_type: 'architecture',
  meta: {
    title: 'Archify Editor Demo',
    subtitle: '拖拽节点调整布局',
    locale: 'zh-CN',
    output: 'demo.html',
    quality_profile: 'showcase',
    editor: { mode: 'free' },
  },
  components: [
    { id: 'user', type: 'external', label: '用户', sublabel: 'Browser', pos: [60, 200], size: [120, 56] },
    { id: 'ui', type: 'frontend', label: 'Editor UI', sublabel: 'Vite + React', pos: [260, 200], size: [140, 64] },
    { id: 'store', type: 'backend', label: 'Diagram Store', sublabel: 'JSON-IR', pos: [480, 200], size: [150, 64] },
    { id: 'cli', type: 'cloud', label: 'Archify CLI', sublabel: 'finalize', pos: [710, 200], size: [140, 64] },
    { id: 'html', type: 'frontend', label: 'HTML Viewer', sublabel: '分享预览', pos: [710, 340], size: [140, 56] },
  ],
  connections: [
    { id: 'c1', from: 'user', to: 'ui', label: '拖拽编辑', variant: 'emphasis' },
    { id: 'c2', from: 'ui', to: 'store', label: '更新 pos' },
    { id: 'c3', from: 'store', to: 'cli', label: '导出 JSON' },
    { id: 'c4', from: 'cli', to: 'html', label: '渲染', fromSide: 'bottom', toSide: 'top' },
  ],
  boundaries: [{ kind: 'region', label: '编辑器内核', wraps: ['ui', 'store'] }],
  cards: [
    {
      dot: 'cyan',
      title: 'MVP',
      items: ['拖拽改坐标', '导入导出 Archify JSON', '调用 finalize 出 HTML'],
    },
  ],
}

export const sampleLayered: ArchifyDiagram = {
  schema_version: 1,
  diagram_type: 'architecture',
  meta: {
    title: '三层 Web 架构',
    output: 'layered-demo.html',
    locale: 'zh-CN',
    quality_profile: 'showcase',
    editor: {
      mode: 'layered',
      layers: [
        { id: 'layer-web', label: '展示层', order: 0, height: 140 },
        { id: 'layer-svc', label: '服务层', order: 1, height: 140 },
        { id: 'layer-data', label: '数据层', order: 2, height: 140 },
      ],
    },
  },
  components: [
    { id: 'web', type: 'frontend', label: 'Web', sublabel: 'SPA', pos: [120, 50], size: [120, 56] },
    { id: 'api', type: 'backend', label: 'API', sublabel: 'REST', pos: [120, 198], size: [120, 56] },
    { id: 'db', type: 'database', label: 'DB', sublabel: 'SQL', pos: [120, 346], size: [120, 56] },
  ],
  connections: [
    { id: 'e1', from: 'web', to: 'api', label: 'HTTPS' },
    { id: 'e2', from: 'api', to: 'db', label: 'SQL' },
  ],
  boundaries: [
    { kind: 'region', label: '展示层', wraps: ['web'] },
    { kind: 'region', label: '服务层', wraps: ['api'] },
    { kind: 'region', label: '数据层', wraps: ['db'] },
    { kind: 'region', label: '系统边界', wraps: ['web', 'api', 'db'] },
  ],
}

export const sampleFlowchart: FlowchartDocument = {
  schema_version: 1,
  diagram_type: 'flowchart',
  meta: { title: '包处理流程', output: 'flow.html', locale: 'zh-CN' },
  nodes: [
    { id: 'n1', shape: 'start', label: '收包', pos: [80, 40], size: [120, 48] },
    { id: 'n2', shape: 'process', label: '解析头', pos: [70, 130], size: [140, 56] },
    { id: 'n3', shape: 'decision', label: '命中策略?', pos: [60, 230], size: [160, 90] },
    { id: 'n4', shape: 'process', label: '安全检测', pos: [70, 360], size: [140, 56] },
    { id: 'n5', shape: 'end', label: '转发', pos: [80, 460], size: [120, 48] },
    { id: 'n6', shape: 'end', label: '丢弃', pos: [320, 250], size: [120, 48] },
  ],
  edges: [
    { id: 'e1', from: 'n1', to: 'n2' },
    { id: 'e2', from: 'n2', to: 'n3' },
    { id: 'e3', from: 'n3', to: 'n4', label: '是' },
    { id: 'e4', from: 'n3', to: 'n6', label: '否' },
    { id: 'e5', from: 'n4', to: 'n5' },
  ],
}
