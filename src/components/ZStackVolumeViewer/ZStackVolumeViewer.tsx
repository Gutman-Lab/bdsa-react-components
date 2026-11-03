import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChannelHistograms } from '../ChannelHistograms/ChannelHistograms'
import { histogramBins } from '../ChannelHistograms/histogramBins'
import { useDsaResolvedApi } from '../../auth/useDsaResolvedApi'
import type { UseDsaResolvedApiOptions } from '../../auth/useDsaResolvedApi'
import { compositeVolume, stainedRange, type AxisRange, type StainedRange, type VolumeChannel } from './compositeVolume'
import type { VolumeBlend, VolumeCuts, VolumeInterpolation, VolumeLight, VolumeRenderer } from './createVolumeRenderer'
import { loadStackFrames, type StackFrames } from './loadStackFrames'
import './ZStackVolumeViewer.css'

export interface ZStackVolumeViewerProps extends UseDsaResolvedApiOptions {
  itemId: string
  className?: string
  style?: React.CSSProperties
}

const DEFAULT_COLORS = ['#0000ff', '#00ff00', '#ff0000', '#ffffff', '#ffff00', '#ff00ff']
const DEFAULT_DEPTH = 8
const DEFAULT_OPACITY = 0.55
const DEFAULT_CONTRAST = 0.4
const DEFAULT_FLOOR = 8
const DEFAULT_LIGHT: VolumeLight = { shade: false, ambient: 0.2, diffuse: 0.7, specular: 0.2 }

function rangeMid(range: AxisRange): number {
  return Math.round((range.min + range.max) / 2)
}

function CutRow({
  label,
  checked,
  onChecked,
  value,
  min,
  max,
  onValue,
  disabled,
  title,
}: {
  label: string
  checked: boolean
  onChecked: (value: boolean) => void
  value: number
  min: number
  max: number
  onValue: (value: number) => void
  disabled: boolean
  title: string
}) {
  const clamped = Math.min(Math.max(value, min), Math.max(min, max))
  const span = Math.max(1, max - min + 1)
  return (
    <div className="zstack-volume__cut">
      <label className="zstack-volume__check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChecked(event.target.checked)}
        />
        {label}
        {checked ? ` ${clamped - min + 1} / ${span}` : ''}
      </label>
      {checked ? (
        <input
          type="range"
          min={min}
          max={Math.max(min, max)}
          step={1}
          value={clamped}
          disabled={disabled}
          title={title}
          onChange={(event) => onValue(Number(event.target.value))}
        />
      ) : null}
    </div>
  )
}

function defaultChannels(count: number): VolumeChannel[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    visible: true,
  }))
}

/**
 * Orbitable volume of a multichannel z-stack. Pair this with the 2D channel
 * viewer and switch between them; it does not replace that viewer.
 */
export function ZStackVolumeViewer({
  itemId,
  apiBaseUrl,
  apiHeaders,
  authToken,
  className = '',
  style,
}: ZStackVolumeViewerProps) {
  const { apiBaseUrl: resolvedApi, apiHeaders: resolvedHeaders } = useDsaResolvedApi({
    apiBaseUrl,
    apiHeaders,
    authToken,
  })
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<VolumeRenderer | null>(null)
  const framesRef = useRef<StackFrames | null>(null)
  const [frames, setFrames] = useState<StackFrames | null>(null)
  const volumeHistograms = useMemo(
    () => (frames ? frames.planes.map((stack) => histogramBins(stack.filter((plane): plane is Uint8Array => !!plane))) : []),
    [frames],
  )
  const [channels, setChannels] = useState<VolumeChannel[]>([])
  const [depth, setDepth] = useState(DEFAULT_DEPTH)
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY)
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(DEFAULT_CONTRAST)
  const [floor, setFloor] = useState(DEFAULT_FLOOR)
  const [interpolation, setInterpolation] = useState<VolumeInterpolation>('nearest')
  const [isolate, setIsolate] = useState(false)
  const [plane, setPlane] = useState(0)
  const [blend, setBlend] = useState<VolumeBlend>('composite')
  const [sampleDistance, setSampleDistance] = useState(1)
  const [light, setLight] = useState<VolumeLight>(DEFAULT_LIGHT)
  const [parallel, setParallel] = useState(false)
  const [showSagittal, setShowSagittal] = useState(false)
  const [showCoronal, setShowCoronal] = useState(false)
  const [showAxial, setShowAxial] = useState(false)
  const [clipCuts, setClipCuts] = useState(true)
  const [cutRange, setCutRange] = useState<StainedRange>({
    sagittal: { min: 0, max: 0 },
    coronal: { min: 0, max: 0 },
    axial: { min: 0, max: 0 },
  })
  const [sagittal, setSagittal] = useState(0)
  const [coronal, setCoronal] = useState(0)
  const [axial, setAxial] = useState(0)
  const channelsRef = useRef(channels)
  const depthRef = useRef(depth)
  const opacityRef = useRef(opacity)
  const brightnessRef = useRef(brightness)
  const contrastRef = useRef(contrast)
  const floorRef = useRef(floor)
  const interpolationRef = useRef(interpolation)
  const isolateRef = useRef(isolate)
  const planeRef = useRef(plane)
  const blendRef = useRef(blend)
  const sampleRef = useRef(sampleDistance)
  const lightRef = useRef(light)
  const parallelRef = useRef(parallel)
  const cutsRef = useRef<VolumeCuts>({
    sagittal,
    coronal,
    axial,
    showSagittal,
    showCoronal,
    showAxial,
    clip: clipCuts,
  })
  channelsRef.current = channels
  depthRef.current = depth
  opacityRef.current = opacity
  brightnessRef.current = brightness
  contrastRef.current = contrast
  floorRef.current = floor
  interpolationRef.current = interpolation
  isolateRef.current = isolate
  planeRef.current = plane
  blendRef.current = blend
  sampleRef.current = sampleDistance
  lightRef.current = light
  parallelRef.current = parallel
  cutsRef.current = {
    sagittal,
    coronal,
    axial,
    showSagittal,
    showCoronal,
    showAxial,
    clip: clipCuts,
  }
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })
  const [volumeReady, setVolumeReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const depthId = useId()
  const opacityId = useId()
  const brightnessId = useId()
  const contrastId = useId()
  const planeId = useId()

  function compositeCurrent(current: StackFrames) {
    return compositeVolume(current.planes, current.width, current.height, current.depth, channelsRef.current, {
      brightness: brightnessRef.current,
      contrast: contrastRef.current,
      floor: floorRef.current,
      plane: isolateRef.current ? planeRef.current : undefined,
    })
  }

  useEffect(() => {
    const host = hostRef.current
    if (!host || !resolvedApi) return
    const controller = new AbortController()
    let cancelled = false
    setError(null)
    setFrames(null)
    setVolumeReady(false)
    framesRef.current = null
    setProgress({ loaded: 0, total: 0 })

    loadStackFrames({
      apiBaseUrl: resolvedApi,
      itemId,
      headers: resolvedHeaders,
      signal: controller.signal,
      onProgress: (loaded, total) => {
        if (!cancelled) setProgress({ loaded, total })
      },
    })
      .then((loadedFrames) => {
        if (cancelled) return
        framesRef.current = loadedFrames
        setFrames(loadedFrames)
        setChannels((current) =>
          current.length === loadedFrames.channelCount ? current : defaultChannels(loadedFrames.channelCount),
        )
        const range = stainedRange(
          loadedFrames.planes,
          loadedFrames.width,
          loadedFrames.height,
          loadedFrames.depth,
        )
        setCutRange(range)
        setSagittal(rangeMid(range.sagittal))
        setCoronal(rangeMid(range.coronal))
        setAxial(rangeMid(range.axial))
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        setError(err instanceof Error ? err.message : 'Could not load the stack')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [itemId, resolvedApi, resolvedHeaders])

  useEffect(() => {
    const host = hostRef.current
    const current = frames
    if (!host || !current || channelsRef.current.length !== current.channelCount) return
    let cancelled = false

    void import('./createVolumeRenderer').then(({ createVolumeRenderer }) => {
      if (cancelled || !hostRef.current || !framesRef.current) return
      const latest = framesRef.current
      const rgba = compositeCurrent(latest)
      const renderer = createVolumeRenderer(host, latest.width, latest.height, latest.depth, rgba)
      renderer.setDepth(depthRef.current)
      renderer.setOpacity(opacityRef.current)
      renderer.setInterpolation(interpolationRef.current)
      renderer.setBlend(blendRef.current)
      renderer.setSampleDistance(sampleRef.current)
      renderer.setLight(lightRef.current)
      renderer.setParallel(parallelRef.current)
      renderer.setCuts(cutsRef.current)
      rendererRef.current = renderer
      window.requestAnimationFrame(() => {
        if (cancelled) return
        renderer.resize()
        setVolumeReady(true)
      })
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not start the 3D view')
    })

    return () => {
      cancelled = true
      rendererRef.current?.destroy()
      rendererRef.current = null
      setVolumeReady(false)
    }
  }, [frames, channels.length])

  useEffect(() => {
    const current = framesRef.current
    const renderer = rendererRef.current
    if (!current || !renderer || channels.length !== current.channelCount) return
    renderer.updateScalars(compositeCurrent(current))
  }, [channels, brightness, contrast, floor, isolate, plane])

  useEffect(() => {
    rendererRef.current?.setDepth(depth)
  }, [depth])

  useEffect(() => {
    rendererRef.current?.setOpacity(opacity)
  }, [opacity])

  useEffect(() => {
    rendererRef.current?.setInterpolation(interpolation)
  }, [interpolation])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.setBlend(blend)
    renderer.setSampleDistance(sampleDistance)
    renderer.setLight(light)
    renderer.setParallel(parallel)
    renderer.setCuts(cutsRef.current)
  }, [blend, sampleDistance, light, parallel, sagittal, coronal, axial, showSagittal, showCoronal, showAxial, clipCuts])

  function updateChannel(index: number, patch: Partial<VolumeChannel>) {
    setChannels((current) =>
      current.map((channel) => (channel.index === index ? { ...channel, ...patch } : channel)),
    )
  }

  const loading = !volumeReady && !error

  return (
    <div className={`zstack-volume ${className}`.trim()} style={style}>
      <div className="zstack-volume__toolbar">
        <span className="zstack-volume__count" title="Each plane is a different frame from the file.">
          {frames ? `${frames.depth} planes` : 'Planes'}
        </span>
        <div className="zstack-volume__slider">
          <label htmlFor={depthId}>Spacing {depth}</label>
          <input
            id={depthId}
            type="range"
            min={1}
            max={40}
            step={1}
            value={depth}
            disabled={!frames}
            title="Distance from one plane to the next, in pixels. 1 packs the stack flat. These files do not store a z step, so this is a viewing stretch, not microns."
            onChange={(event) => setDepth(Number(event.target.value))}
          />
        </div>
        <div className="zstack-volume__toggle" role="group" aria-label="Slice blending">
          <button
            type="button"
            aria-pressed={interpolation === 'nearest'}
            disabled={!frames}
            title="Each plane keeps a hard edge, so the stack reads as separate slices."
            onClick={() => setInterpolation('nearest')}
          >
            Stepped
          </button>
          <button
            type="button"
            aria-pressed={interpolation === 'linear'}
            disabled={!frames}
            title="Blends neighboring planes into one solid. That is what makes a real stack look like one copied layer."
            onClick={() => setInterpolation('linear')}
          >
            Smooth
          </button>
        </div>
        <label className="zstack-volume__check">
          <input
            type="checkbox"
            checked={isolate}
            disabled={!frames}
            onChange={(event) => setIsolate(event.target.checked)}
          />
          One plane
        </label>
        {isolate ? (
          <div className="zstack-volume__slider">
            <label htmlFor={planeId}>Plane {plane + 1}</label>
            <input
              id={planeId}
              type="range"
              min={0}
              max={Math.max(0, (frames?.depth ?? 1) - 1)}
              step={1}
              value={plane}
              disabled={!frames}
              title="Shows only this frame. Move it: if the stain changes, the volume is not a copy of one slice."
              onChange={(event) => setPlane(Number(event.target.value))}
            />
          </div>
        ) : null}
        <div className="zstack-volume__slider">
          <label htmlFor={opacityId}>Opacity {opacity.toFixed(2)}</label>
          <input
            id={opacityId}
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={opacity}
            disabled={!frames}
            title="How solid the stain is. This is not brightness."
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </div>
        <div className="zstack-volume__slider">
          <label htmlFor={brightnessId}>Brightness {brightness.toFixed(2)}</label>
          <input
            id={brightnessId}
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={brightness}
            disabled={!frames}
            title="Gamma on the stain. Black stays black."
            onChange={(event) => setBrightness(Number(event.target.value))}
          />
        </div>
        <div className="zstack-volume__slider">
          <label htmlFor={contrastId}>Contrast {contrast.toFixed(2)}</label>
          <input
            id={contrastId}
            type="range"
            min={-1}
            max={1}
            step={0.02}
            value={contrast}
            disabled={!frames}
            title="Multiplies the stain, same curve as the flat view. 0.4 is the default."
            onChange={(event) => setContrast(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="zstack-volume__body">
        <div className="zstack-volume__viewport">
          <div ref={hostRef} className="zstack-volume__host" />
          {loading ? (
            <div className="zstack-volume__status">
              {frames
                ? 'Building volume…'
                : progress.total > 0
                  ? `Loading frames ${progress.loaded} / ${progress.total}`
                  : 'Loading stack…'}
            </div>
          ) : null}
          {error ? <div className="zstack-volume__status zstack-volume__status--error">{error}</div> : null}
        </div>
        <aside className="zstack-volume__side" aria-label="Volume controls">
          <section className="zstack-volume__section">
            <h2>Channels</h2>
            <ul className="zstack-volume__channels">
              {channels.map((channel) => (
                <li key={channel.index}>
                  <label className="zstack-volume__channel">
                    <input
                      type="checkbox"
                      checked={channel.visible}
                      onChange={(event) => updateChannel(channel.index, { visible: event.target.checked })}
                    />
                    <input
                      type="color"
                      value={channel.color}
                      aria-label={`Channel ${channel.index} color`}
                      onChange={(event) => updateChannel(channel.index, { color: event.target.value })}
                    />
                    <span>Channel {channel.index}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
          <ChannelHistograms
            note="all planes"
            mark={floor}
            series={channels.map((channel) => ({
              id: String(channel.index),
              label: `Channel ${channel.index}`,
              color: channel.color,
              histogram: volumeHistograms[channel.index] ?? null,
            }))}
          />
          <section className="zstack-volume__section">
            <h2>Projection</h2>
            <label className="zstack-volume__field">
              Blend
              <select
                className="zstack-volume__select"
                value={blend}
                disabled={!frames}
                title="How each ray combines the stain. Maximum is a projection of the brightest voxel."
                onChange={(event) => setBlend(event.target.value as VolumeBlend)}
              >
                <option value="composite">Composite</option>
                <option value="maximum">Maximum</option>
                <option value="average">Average</option>
                <option value="additive">Additive</option>
              </select>
            </label>
            <label className="zstack-volume__check">
              <input
                type="checkbox"
                checked={parallel}
                disabled={!volumeReady}
                onChange={(event) => setParallel(event.target.checked)}
              />
              Parallel
            </label>
          </section>
          <section className="zstack-volume__section">
            <h2>Cuts</h2>
            <CutRow
              label="Sagittal"
              checked={showSagittal}
              onChecked={setShowSagittal}
              value={sagittal}
              min={cutRange.sagittal.min}
              max={cutRange.sagittal.max}
              onValue={setSagittal}
              disabled={!frames}
              title="Left-right cut across the tissue. The empty border is left out of the slider. Clip volume hides the near side."
            />
            <CutRow
              label="Coronal"
              checked={showCoronal}
              onChecked={setShowCoronal}
              value={coronal}
              min={cutRange.coronal.min}
              max={cutRange.coronal.max}
              onValue={setCoronal}
              disabled={!frames}
              title="Front-back cut across the tissue."
            />
            <CutRow
              label="Axial"
              checked={showAxial}
              onChecked={setShowAxial}
              value={axial}
              min={cutRange.axial.min}
              max={cutRange.axial.max}
              onValue={setAxial}
              disabled={!frames}
              title="One stop per z slice. This stack is thin, so the cut travels less than the other two."
            />
            <label className="zstack-volume__check">
              <input
                type="checkbox"
                checked={clipCuts}
                disabled={!frames}
                onChange={(event) => setClipCuts(event.target.checked)}
              />
              Clip volume
            </label>
          </section>
          <section className="zstack-volume__section">
            <h2>Light</h2>
            <label className="zstack-volume__check">
              <input
                type="checkbox"
                checked={light.shade}
                disabled={!frames}
                onChange={(event) => setLight((current) => ({ ...current, shade: event.target.checked }))}
              />
              Shade
            </label>
            {light.shade ? (
              <>
                <label className="zstack-volume__field">
                  Ambient {light.ambient.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={light.ambient}
                    disabled={!frames}
                    onChange={(event) => setLight((current) => ({ ...current, ambient: Number(event.target.value) }))}
                  />
                </label>
                <label className="zstack-volume__field">
                  Diffuse {light.diffuse.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={light.diffuse}
                    disabled={!frames}
                    onChange={(event) => setLight((current) => ({ ...current, diffuse: Number(event.target.value) }))}
                  />
                </label>
                <label className="zstack-volume__field">
                  Specular {light.specular.toFixed(2)}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={light.specular}
                    disabled={!frames}
                    onChange={(event) => setLight((current) => ({ ...current, specular: Number(event.target.value) }))}
                  />
                </label>
              </>
            ) : null}
          </section>
          <section className="zstack-volume__section">
            <h2>Background</h2>
            <label className="zstack-volume__field">
              Floor {floor}
              <input
                type="range"
                min={0}
                max={64}
                step={1}
                value={floor}
                disabled={!frames}
                title="Stored counts at or below this are ignored. These files carry a haze around 10–30. The dimmest channel peaks near 10, so a high floor can remove it."
                onChange={(event) => setFloor(Number(event.target.value))}
              />
            </label>
          </section>
          <section className="zstack-volume__section">
            <h2>Sampling</h2>
            <label className="zstack-volume__field">
              Step {sampleDistance.toFixed(2)}
              <input
                type="range"
                min={0.25}
                max={4}
                step={0.25}
                value={sampleDistance}
                disabled={!frames}
                title="Distance between samples along each ray. Smaller is sharper and slower."
                onChange={(event) => setSampleDistance(Number(event.target.value))}
              />
            </label>
          </section>
          <div className="zstack-volume__side-actions">
            <button
              type="button"
              className="zstack-volume__text"
              disabled={!frames}
              onClick={() => {
                setBrightness(0)
                setContrast(DEFAULT_CONTRAST)
                setFloor(DEFAULT_FLOOR)
              }}
            >
              Reset tone
            </button>
            <button
              type="button"
              className="zstack-volume__text"
              disabled={!volumeReady}
              onClick={() => rendererRef.current?.resetView()}
            >
              Reset view
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
