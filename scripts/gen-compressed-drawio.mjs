/**
 * 生成可解码的压缩 mxfile 夹具（deflate-raw + URI-encode + base64，对齐主流流程图编辑器）。
 * 用法：node scripts/gen-compressed-drawio.mjs
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const inner = `<mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="step" value="处理" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#E8F1FF;strokeColor=#3D9CF0;fontColor=#0F172A;" vertex="1" parent="1">
          <mxGeometry x="80" y="60" width="160" height="64" as="geometry"/>
        </mxCell>
        <mxCell id="ask" value="判断" style="rhombus;whiteSpace=wrap;html=1;fillColor=#FFF4E5;strokeColor=#FBBF24;" vertex="1" parent="1">
          <mxGeometry x="300" y="40" width="140" height="100" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="是" style="endArrow=classic;html=1;" edge="1" parent="1" source="step" target="ask">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>`

const encoded = encodeURIComponent(inner)
const deflated = zlib.deflateRawSync(Buffer.from(encoded, 'utf8'), { level: 9 })
const b64 = deflated.toString('base64')

const mxfile = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" compressed="true" version="22.0.0">
  <diagram id="page" name="compressed-ok">
    ${b64}
  </diagram>
</mxfile>
`

const outOk = path.join(root, 'test/fixtures/compressed.drawio')
fs.writeFileSync(outOk, mxfile, 'utf8')
console.log('wrote', outOk, 'payload', b64.length)

// 无法解码的损坏载荷（仍带 compressed=true），用于拒收引导
const broken = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" compressed="true" version="22.0.0">
  <diagram id="x" name="Page-1">
    not-valid-base64!!!@@@
  </diagram>
</mxfile>
`
const outBad = path.join(root, 'test/fixtures/compressedBroken.drawio')
fs.writeFileSync(outBad, broken, 'utf8')
console.log('wrote', outBad)
