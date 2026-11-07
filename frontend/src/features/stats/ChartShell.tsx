import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { formatCount } from './format'

const PAD = { l: 30, r: 6, t: 10, b: 24 }

interface Geo {
  width: number
  height: number
  plotW: number
  plotH: number
  band: number
  /** Horizontal centre of bucket i */
  x: (i: number) => number
  /** Vertical position of a value */
  y: (v: number) => number
  base: number
}

/** Width of an element, tracked with a ResizeObserver. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Shared frame of the charts: responsive SVG with axes and gridlines, hover/touch/keyboard
 * selection of a bucket (arrow keys, Home/End, Esc) and its tooltip. `label` is the SVG's text
 * alternative; the selected bucket is also announced through a polite live region.
 */
export function ChartShell({
  label,
  count,
  top,
  ticks,
  xLabels,
  height = 200,
  tooltip,
  anchorValue,
  children,
}: {
  label: string
  count: number
  top: number
  ticks: number[]
  xLabels: string[]
  height?: number
  tooltip: (i: number) => ReactNode
  anchorValue: (i: number) => number
  children: (geo: Geo, active: number | null) => ReactNode
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const plotW = Math.max(width - PAD.l - PAD.r, 1)
  const plotH = height - PAD.t - PAD.b
  const band = plotW / Math.max(count, 1)
  const geo: Geo = {
    width,
    height,
    plotW,
    plotH,
    band,
    x: (i) => PAD.l + (i + 0.5) * band,
    y: (v) => PAD.t + plotH * (1 - v / top),
    base: PAD.t + plotH,
  }
  const current = active !== null && active < count ? active : null

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - rect.left - PAD.l) / band)
    return Math.min(Math.max(i, 0), count - 1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1
    const from = current ?? last
    const next =
      e.key === 'ArrowLeft' ? from - 1
      : e.key === 'ArrowRight' ? from + 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next !== null) {
      e.preventDefault()
      setActive(Math.min(Math.max(next, 0), last))
    } else if (e.key === 'Escape') setActive(null)
  }

  const labelStep = Math.max(1, Math.ceil(36 / band))
  const tipX = Math.min(Math.max(geo.x(current ?? 0), 80), Math.max(width - 80, 80))

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${label}. Flèches gauche et droite pour parcourir les valeurs.`}
      onKeyDown={onKeyDown}
      onFocus={() => setActive((a) => a ?? count - 1)}
      onBlur={() => setActive(null)}
      onPointerDown={(e) => setActive(indexAt(e))}
      onPointerMove={(e) => setActive(indexAt(e))}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch' && e.currentTarget !== document.activeElement) setActive(null)
      }}
      className="relative w-full touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={width - PAD.r}
                y1={geo.y(t)}
                y2={geo.y(t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 6}
                y={geo.y(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                className="fill-muted-foreground"
              >
                {formatCount(t)}
              </text>
            </g>
          ))}
          {current !== null && (
            <rect
              x={PAD.l + current * band}
              y={PAD.t}
              width={band}
              height={plotH}
              className="fill-foreground/5"
            />
          )}
          {children(geo, current)}
          {xLabels.map(
            (l, i) =>
              l &&
              i % labelStep === 0 && (
                <text
                  key={i}
                  x={geo.x(i)}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {l}
                </text>
              ),
          )}
        </svg>
      )}
      {width > 0 && current !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg ring-1 ring-border"
          style={{ left: tipX, bottom: Math.max(height - geo.y(anchorValue(current)) + 8, 8) }}
        >
          {tooltip(current)}
        </div>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {current !== null && tooltip(current)}
      </div>
    </div>
  )
}
