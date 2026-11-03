import { useState } from 'react'
import { histogramFraction, histogramMax, type ChannelHistogram } from './histogramBins'
import './ChannelHistograms.css'

export interface ChannelHistogramSeries {
  id: string
  label: string
  color: string
  histogram: ChannelHistogram | null
}

export interface ChannelHistogramsProps {
  series: ChannelHistogramSeries[]
  /** Raw count drawn as a vertical line, such as the background floor. */
  mark?: number
  note?: string
}

function HistogramBars({
  histogram,
  color,
  log,
  mark,
}: {
  histogram: ChannelHistogram
  color: string
  log: boolean
  mark?: number
}) {
  const { counts } = histogram
  const heights = counts.map((count) => (log ? Math.log10(count + 1) : count))
  const peak = heights.reduce((max, value) => (value > max ? value : max), 0)
  const markAt = mark === undefined ? null : histogramFraction(histogram, mark)
  return (
    <svg className="channel-histograms__plot" viewBox={`0 0 ${counts.length} 48`} preserveAspectRatio="none" role="img">
      {heights.map((value, index) => {
        if (value <= 0 || peak <= 0) return null
        const height = (value / peak) * 47
        return <rect key={index} x={index} y={48 - height} width={1} height={height} fill={color} />
      })}
      {markAt === null ? null : (
        <line
          x1={markAt * counts.length}
          x2={markAt * counts.length}
          y1={0}
          y2={48}
          stroke="#1c1917"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  )
}

export function ChannelHistograms({ series, mark, note }: ChannelHistogramsProps) {
  const [log, setLog] = useState(true)
  const [open, setOpen] = useState(true)
  return (
    <section className="channel-histograms" aria-label="Channel histograms">
      <div className="channel-histograms__head">
        <button
          type="button"
          className="channel-histograms__toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          Histograms
        </button>
        {open ? (
          <label>
            <input type="checkbox" checked={log} onChange={(event) => setLog(event.target.checked)} />
            Log
          </label>
        ) : null}
        {note ? <span className="channel-histograms__note">{note}</span> : null}
      </div>
      {open ? <ul className="channel-histograms__list">
        {series.map((entry) => (
          <li key={entry.id}>
            <div className="channel-histograms__label">
              <span style={{ background: entry.color }} />
              {entry.label}
              {entry.histogram ? <em>max {histogramMax(entry.histogram)}</em> : null}
            </div>
            {entry.histogram ? (
              <HistogramBars histogram={entry.histogram} color={entry.color} log={log} mark={mark} />
            ) : (
              <div className="channel-histograms__plot channel-histograms__plot--empty" />
            )}
          </li>
        ))}
      </ul> : null}
    </section>
  )
}
