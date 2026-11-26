import type { FlowShape } from '../types'

/** 流程图形状几何（Palette 预览与画布共用） */
export function FlowShapeGeom({
  shape,
  w,
  h,
  fill,
  stroke,
  strokeWidth = 1.6,
  strokeDasharray,
  className = 'box',
}: {
  shape: FlowShape
  w: number
  h: number
  fill: string
  stroke: string
  strokeWidth?: number
  strokeDasharray?: string
  className?: string
}) {
  const common = { fill, stroke, strokeWidth, strokeDasharray, className }
  const skew = Math.min(28, w * 0.22)

  switch (shape) {
    case 'start':
    case 'end':
      return <rect width={w} height={h} rx={h / 2} {...common} />
    case 'decision':
      return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />
    case 'subprocess':
      return (
        <>
          <rect width={w} height={h} rx={6} {...common} />
          <rect x={8} y={5} width={w - 16} height={h - 10} fill="none" stroke={stroke} strokeWidth={1} />
        </>
      )
    case 'document': {
      const wave = `M0,0 H${w} V${h - 10} Q${w * 0.75},${h + 6} ${w / 2},${h - 6} Q${w * 0.25},${h - 18} 0,${h - 4} Z`
      return <path d={wave} {...common} />
    }
    case 'data':
      return (
        <polygon
          points={`${skew},0 ${w},0 ${w - skew},${h} 0,${h}`}
          {...common}
        />
      )
    case 'preparation': {
      const x = Math.min(22, w * 0.18)
      return (
        <polygon
          points={`${x},0 ${w - x},0 ${w},${h / 2} ${w - x},${h} ${x},${h} 0,${h / 2}`}
          {...common}
        />
      )
    }
    case 'manual':
      return <polygon points={`0,${h * 0.22} ${w},0 ${w},${h} 0,${h}`} {...common} />
    case 'delay': {
      const r = Math.min(h / 2, w * 0.35)
      return (
        <path
          d={`M0,0 H${w - r} A${r},${h / 2} 0 0 1 ${w - r},${h} H0 Z`}
          {...common}
        />
      )
    }
    case 'connector':
      return <ellipse cx={w / 2} cy={h / 2} rx={Math.min(w, h) / 2 - 1} ry={Math.min(w, h) / 2 - 1} {...common} />
    case 'display': {
      const cut = Math.min(24, w * 0.2)
      return <polygon points={`${cut},0 ${w},0 ${w},${h} ${cut},${h} 0,${h / 2}`} {...common} />
    }
    case 'note': {
      const fold = Math.min(16, w * 0.18, h * 0.35)
      return (
        <path
          d={`M0,0 H${w - fold} L${w},${fold} V${h} H0 Z M${w - fold},0 V${fold} H${w}`}
          {...common}
        />
      )
    }
    case 'text':
      // 独立文本框：透明底；选中态靠外层高亮，几何本身不抢视觉
      return <rect width={w} height={h} rx={2} fill="none" stroke="none" className={className} />
    case 'database': {
      const ry = Math.min(12, h * 0.18)
      return (
        <>
          <path
            d={`M0,${ry} V${h - ry} A${w / 2},${ry} 0 0 0 ${w},${h - ry} V${ry} A${w / 2},${ry} 0 0 0 0,${ry}`}
            {...common}
          />
          <ellipse cx={w / 2} cy={ry} rx={w / 2} ry={ry} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        </>
      )
    }
    case 'offpage': {
      // 家形 / 跨页连接符：上矩形 + 下三角尖
      const tip = Math.min(18, h * 0.35)
      return (
        <polygon
          points={`0,0 ${w},0 ${w},${h - tip} ${w / 2},${h} 0,${h - tip}`}
          {...common}
        />
      )
    }
    case 'merge': {
      // 倒三角合并
      return <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} {...common} />
    }
    case 'multi_document': {
      // 叠放文档：后层偏移 + 前层波浪底
      const ox = Math.min(8, w * 0.08)
      const oy = Math.min(8, h * 0.12)
      const fw = w - ox
      const fh = h - oy
      const wave = (ww: number, hh: number, dx: number, dy: number) =>
        `M${dx},${dy} H${dx + ww} V${dy + hh - 10} Q${dx + ww * 0.75},${dy + hh + 6} ${dx + ww / 2},${dy + hh - 6} Q${dx + ww * 0.25},${dy + hh - 18} ${dx},${dy + hh - 4} Z`
      return (
        <>
          <path d={wave(fw, fh, ox, 0)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={0.55} />
          <path d={wave(fw, fh, 0, oy)} {...common} />
        </>
      )
    }
    case 'chevron': {
      const tip = Math.min(28, w * 0.28)
      return (
        <polygon
          points={`0,0 ${w - tip},0 ${w},${h / 2} ${w - tip},${h} 0,${h} ${tip},${h / 2}`}
          {...common}
        />
      )
    }
    case 'arrow_right': {
      const body = w * 0.55
      return (
        <polygon
          points={`0,${h * 0.28} ${body},${h * 0.28} ${body},0 ${w},${h / 2} ${body},${h} ${body},${h * 0.72} 0,${h * 0.72}`}
          {...common}
        />
      )
    }
    case 'arrow_left': {
      const body = w * 0.45
      return (
        <polygon
          points={`${w},${h * 0.28} ${body},${h * 0.28} ${body},0 0,${h / 2} ${body},${h} ${body},${h * 0.72} ${w},${h * 0.72}`}
          {...common}
        />
      )
    }
    case 'arrow_up': {
      const body = h * 0.45
      return (
        <polygon
          points={`${w * 0.28},${h} ${w * 0.28},${body} 0,${body} ${w / 2},0 ${w},${body} ${w * 0.72},${body} ${w * 0.72},${h}`}
          {...common}
        />
      )
    }
    case 'arrow_down': {
      const body = h * 0.55
      return (
        <polygon
          points={`${w * 0.28},0 ${w * 0.28},${body} 0,${body} ${w / 2},${h} ${w},${body} ${w * 0.72},${body} ${w * 0.72},0`}
          {...common}
        />
      )
    }
    case 'arrow_both': {
      const tip = Math.min(22, w * 0.18)
      return (
        <polygon
          points={`0,${h / 2} ${tip},0 ${tip},${h * 0.28} ${w - tip},${h * 0.28} ${w - tip},0 ${w},${h / 2} ${w - tip},${h} ${w - tip},${h * 0.72} ${tip},${h * 0.72} ${tip},${h}`}
          {...common}
        />
      )
    }
    case 'process':
    default:
      return <rect width={w} height={h} rx={8} {...common} />
  }
}
