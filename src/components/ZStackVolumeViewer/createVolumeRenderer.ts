import '@kitware/vtk.js/Rendering/Profiles/Volume'
// The volume profile registers volumes and image slices only. The annotation
// overlay uses regular polydata actors, so register the OpenGL overrides for
// vtkActor and vtkMapper explicitly instead of pulling in the whole geometry
// profile (textures, scalar bars, skybox).
import '@kitware/vtk.js/Rendering/OpenGL/Actor'
import '@kitware/vtk.js/Rendering/OpenGL/PolyDataMapper'
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray'
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction'
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData'
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow'
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction'
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume'
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper'
import vtkImageMapper from '@kitware/vtk.js/Rendering/Core/ImageMapper'
import vtkImageSlice from '@kitware/vtk.js/Rendering/Core/ImageSlice'
import vtkPlane from '@kitware/vtk.js/Common/DataModel/Plane'
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData'
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor'
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper'
import vtkTriangleFilter from '@kitware/vtk.js/Filters/General/TriangleFilter'
import { buildOverlayGeometry, type OverlayPolygon } from './overlayGeometry'

export type { OverlayPolygon } from './overlayGeometry'

export type VolumeInterpolation = 'linear' | 'nearest'

/** Flat, unlit styling for the segmentation overlay. */
export interface OverlayStyle {
  color?: [number, number, number]
  /** Fill opacity. The outline is always drawn at full opacity. */
  opacity?: number
  lineWidth?: number
}

/** Ray combination. Composite is the default solid volume. Maximum is a MIP. */
export type VolumeBlend = 'composite' | 'maximum' | 'average' | 'additive'

export interface VolumeLight {
  shade: boolean
  ambient: number
  diffuse: number
  specular: number
}

/** Orthogonal cut planes. Indexes are voxel positions, sagittal along X, coronal along Y, axial along Z. */
export interface VolumeCuts {
  sagittal: number
  coronal: number
  axial: number
  showSagittal: boolean
  showCoronal: boolean
  showAxial: boolean
  /** Drop the volume on the near side of each shown plane. */
  clip: boolean
}

export interface VolumeRenderer {
  updateScalars(rgba: Uint8Array): void
  /**
   * Draw translucent nuclei contours over the volume. Points are in slide base
   * pixels; the renderer scales them to the loaded volume. Pass `null` to hide.
   */
  setOverlay(polygons: OverlayPolygon[] | null, style?: OverlayStyle): void
  setDepth(exaggeration: number): void
  setOpacity(opacity: number): void
  setInterpolation(mode: VolumeInterpolation): void
  setBlend(mode: VolumeBlend): void
  setSampleDistance(distance: number): void
  setLight(light: VolumeLight): void
  setParallel(enabled: boolean): void
  setCuts(cuts: VolumeCuts): void
  resetView(): void
  resize(): void
  destroy(): void
}

/**
 * GPU volume of a precolored RGBA stack. Components are dependent: RGB is the
 * stain color and the fourth component feeds the opacity function.
 * These hyperstacks usually have no stored z step, so depth is a viewing stretch.
 */
export function createVolumeRenderer(
  container: HTMLElement,
  width: number,
  height: number,
  depth: number,
  rgba: Uint8Array,
  sourceWidth: number = width,
  sourceHeight: number = height,
): VolumeRenderer {
  const renderWindow = vtkGenericRenderWindow.newInstance({
    background: [0, 0, 0],
    listenWindowResize: false,
  })
  // Passing `container` into newInstance only stores it. The canvas is
  // attached by setContainer, and without that call the pane stays empty.
  renderWindow.setContainer(container)
  const renderer = renderWindow.getRenderer()
  const view = renderWindow.getRenderWindow()
  renderWindow.getInteractor().setDesiredUpdateRate(15)

  const image = vtkImageData.newInstance()
  const scalars = vtkDataArray.newInstance({
    name: 'RGBA',
    numberOfComponents: 4,
    values: rgba,
  })
  image.setDimensions(width, height, depth)
  image.getPointData().setScalars(scalars)

  const opacity = vtkPiecewiseFunction.newInstance()
  // Dependent RGBA uses this function's range to scale the stored color.
  // The default range is 0–1024, which draws these 8-bit stains at quarter brightness.
  const color = vtkColorTransferFunction.newInstance()
  color.addRGBPoint(0, 0, 0, 0)
  color.addRGBPoint(255, 1, 1, 1)
  const mapper = vtkVolumeMapper.newInstance({
    autoAdjustSampleDistances: false,
    sampleDistance: 1,
    maximumSamplesPerRay: 4096,
  })
  mapper.setInputData(image)

  const volume = vtkVolume.newInstance()
  volume.setMapper(mapper)
  const property = volume.getProperty()
  property.setIndependentComponents(false)
  property.setRGBTransferFunction(0, color)
  property.setInterpolationTypeToLinear()
  property.setShade(false)
  property.setScalarOpacity(0, opacity)
  // One world unit is one pixel in x/y. A distance based on the volume
  // diagonal makes a dim stain transparent.
  property.setScalarOpacityUnitDistance(0, 1)
  renderer.addVolume(volume)

  function makeCut(setAxis: (mapper: ReturnType<typeof vtkImageMapper.newInstance>, position: number) => void) {
    const imageMapper = vtkImageMapper.newInstance()
    imageMapper.setInputData(image)
    const actor = vtkImageSlice.newInstance({ visibility: false })
    actor.setMapper(imageMapper)
    const sliceProperty = actor.getProperty()
    sliceProperty.setIndependentComponents(false)
    sliceProperty.setColorWindow(255)
    sliceProperty.setColorLevel(127.5)
    sliceProperty.setInterpolationTypeToNearest()
    renderer.addActor(actor)
    return { imageMapper, actor, setAxis }
  }

  const cuts = {
    sagittal: makeCut((imageMapper, position) => imageMapper.setXSlice(position)),
    coronal: makeCut((imageMapper, position) => imageMapper.setYSlice(position)),
    axial: makeCut((imageMapper, position) => imageMapper.setZSlice(position)),
  }
  const clipPlanes = {
    sagittal: vtkPlane.newInstance(),
    coronal: vtkPlane.newInstance(),
    axial: vtkPlane.newInstance(),
  }

  // The segmentation overlay is a separate pair of actors: a translucent fill
  // (triangulated) and an opaque outline. Both are unlit so the stain colors
  // do not tint the nuclei. One world unit is one x/y pixel; z uses the same
  // spacing as the volume, applied with the actor transform.
  const overlayFillMapper = vtkMapper.newInstance()
  const overlayFillActor = vtkActor.newInstance()
  overlayFillActor.setMapper(overlayFillMapper)
  overlayFillActor.setVisibility(false)
  renderer.addActor(overlayFillActor)
  const overlayLineMapper = vtkMapper.newInstance()
  const overlayLineActor = vtkActor.newInstance()
  overlayLineActor.setMapper(overlayLineMapper)
  overlayLineActor.setVisibility(false)
  renderer.addActor(overlayLineActor)
  const overlayTriangleFilter = vtkTriangleFilter.newInstance()

  const canvas = container.querySelector('canvas')
  if (canvas) {
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
  }

  let depthScale = 2
  let peakOpacity = 0.55
  let posed = false
  let cutState: VolumeCuts = {
    sagittal: 0,
    coronal: 0,
    axial: 0,
    showSagittal: false,
    showCoronal: false,
    showAxial: false,
    clip: false,
  }

  function applyOpacity() {
    opacity.removeAllPoints()
    opacity.addPoint(0, 0)
    opacity.addPoint(4, 0)
    opacity.addPoint(24, peakOpacity * 0.45)
    opacity.addPoint(80, peakOpacity * 0.8)
    opacity.addPoint(255, peakOpacity)
  }

  function applyOverlayTransform() {
    const origin = image.getOrigin()
    const spacing = image.getSpacing()
    // Overlay points store z as a plane index. Scaling the actors keeps the
    // 1,200 contours cheap to re-place when the spacing slider moves.
    for (const actor of [overlayFillActor, overlayLineActor]) {
      actor.setPosition(0, 0, origin[2])
      actor.setScale(1, 1, spacing[2])
    }
  }

  function applyDepth() {
    const z = depthScale
    image.setSpacing([1, 1, z])
    image.setOrigin([-width / 2, -height / 2, -((Math.max(depth, 1) - 1) * z) / 2])
    image.modified()
    applyOverlayTransform()
  }

  let overlayPolygons: OverlayPolygon[] = []
  let overlayStyle: Required<OverlayStyle> = {
    color: [0, 1, 0],
    opacity: 0.22,
    lineWidth: 1.5,
  }
  let overlayFillData: ReturnType<typeof vtkPolyData.newInstance> | null = null
  let overlayLineData: ReturnType<typeof vtkPolyData.newInstance> | null = null

  function buildOverlay() {
    const geometry = buildOverlayGeometry(overlayPolygons, width, height, sourceWidth, sourceHeight)

    overlayFillData?.delete()
    overlayFillData = vtkPolyData.newInstance()
    overlayFillData.getPoints().setData(geometry.points, 3)
    overlayFillData.getPolys().setData(geometry.polygons)
    overlayTriangleFilter.setInputData(overlayFillData)
    overlayTriangleFilter.update()
    overlayFillMapper.setInputData(overlayTriangleFilter.getOutputData())

    overlayLineData?.delete()
    overlayLineData = vtkPolyData.newInstance()
    overlayLineData.getPoints().setData(geometry.points, 3)
    overlayLineData.getLines().setData(geometry.lines)
    overlayLineMapper.setInputData(overlayLineData)

    const fill = overlayFillActor.getProperty()
    fill.setColor(overlayStyle.color)
    fill.setOpacity(overlayStyle.opacity)
    fill.setLighting(false)
    fill.setAmbient(1)
    fill.setDiffuse(0)
    fill.setSpecular(0)

    const line = overlayLineActor.getProperty()
    line.setColor(overlayStyle.color)
    line.setOpacity(1)
    line.setLineWidth(overlayStyle.lineWidth)
    line.setLighting(false)
    line.setAmbient(1)
    line.setDiffuse(0)
    line.setSpecular(0)
  }

  function setOverlay(polygons: OverlayPolygon[] | null, style?: OverlayStyle) {
    overlayPolygons = polygons ?? []
    if (style) overlayStyle = { ...overlayStyle, ...style }
    const visible = overlayPolygons.length > 0
    overlayFillActor.setVisibility(visible)
    overlayLineActor.setVisibility(visible)
    if (visible) buildOverlay()
    applyOverlayTransform()
    if (posed) render()
    else fit()
  }

  function axisPosition(axis: 0 | 1 | 2, index: number): [number, number, number] {
    const origin = image.getOrigin()
    const spacing = image.getSpacing()
    const point: [number, number, number] = [origin[0], origin[1], origin[2]]
    point[axis] = origin[axis] + index * spacing[axis]
    return point
  }

  function applyCuts() {
    const specs = [
      { key: 'sagittal' as const, axis: 0 as const, index: cutState.sagittal, show: cutState.showSagittal, max: width - 1, normal: [1, 0, 0] as const },
      { key: 'coronal' as const, axis: 1 as const, index: cutState.coronal, show: cutState.showCoronal, max: height - 1, normal: [0, 1, 0] as const },
      { key: 'axial' as const, axis: 2 as const, index: cutState.axial, show: cutState.showAxial, max: depth - 1, normal: [0, 0, 1] as const },
    ]
    mapper.removeAllClippingPlanes()
    for (const spec of specs) {
      const index = Math.max(0, Math.min(spec.max, Math.round(spec.index)))
      const cut = cuts[spec.key]
      const position = axisPosition(spec.axis, index)
      // X/Y/Z slice positions are world coordinates. The volume is centered,
      // so a voxel index is not a world position.
      cut.setAxis(cut.imageMapper, position[spec.axis])
      cut.actor.setVisibility(spec.show)
      if (cutState.clip && spec.show) {
        const plane = clipPlanes[spec.key]
        plane.setNormal(spec.normal[0], spec.normal[1], spec.normal[2])
        plane.setOrigin(position[0], position[1], position[2])
        mapper.addClippingPlane(plane)
      }
    }
  }

  function poseCamera() {
    renderer.resetCamera()
    const camera = renderer.getActiveCamera()
    // Far enough off the face that the gap between planes is visible.
    camera.azimuth(55)
    camera.elevation(48)
    camera.orthogonalizeViewUp()
    posed = true
  }

  function render() {
    renderer.resetCameraClippingRange()
    view.render()
  }

  function fit() {
    const rect = container.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return
    renderWindow.resize()
    if (!posed) poseCamera()
    render()
  }

  applyOpacity()
  applyDepth()
  fit()

  const observer = new ResizeObserver(() => {
    fit()
  })
  observer.observe(container)

  return {
    updateScalars(next) {
      scalars.setData(next, 4)
      image.modified()
      if (!posed) return
      view.render()
    },
    setOverlay,
    setDepth(exaggeration) {
      depthScale = exaggeration
      applyDepth()
      applyCuts()
      if (posed) render()
      else fit()
    },
    setOpacity(next) {
      peakOpacity = next
      applyOpacity()
      if (posed) view.render()
      else fit()
    },
    setInterpolation(mode) {
      if (mode === 'nearest') property.setInterpolationTypeToNearest()
      else property.setInterpolationTypeToLinear()
      if (posed) view.render()
      else fit()
    },
    setBlend(mode) {
      if (mode === 'maximum') mapper.setBlendModeToMaximumIntensity()
      else if (mode === 'average') mapper.setBlendModeToAverageIntensity()
      else if (mode === 'additive') mapper.setBlendModeToAdditiveIntensity()
      else mapper.setBlendModeToComposite()
      if (posed) view.render()
      else fit()
    },
    setSampleDistance(distance) {
      mapper.setSampleDistance(distance)
      if (posed) view.render()
      else fit()
    },
    setLight(light) {
      property.setShade(light.shade)
      property.setAmbient(light.ambient)
      property.setDiffuse(light.diffuse)
      property.setSpecular(light.specular)
      property.setSpecularPower(8)
      if (posed) view.render()
      else fit()
    },
    setParallel(enabled) {
      const camera = renderer.getActiveCamera()
      camera.setParallelProjection(enabled)
      if (enabled) {
        const angle = (camera.getViewAngle() * Math.PI) / 360
        camera.setParallelScale(camera.getDistance() * Math.tan(angle))
      }
      if (posed) render()
      else fit()
    },
    setCuts(next) {
      cutState = next
      applyCuts()
      if (posed) render()
      else fit()
    },
    resetView() {
      poseCamera()
      render()
    },
    resize() {
      fit()
    },
    destroy() {
      observer.disconnect()
      renderer.removeVolume(volume)
      for (const cut of Object.values(cuts)) {
        renderer.removeActor(cut.actor)
        cut.actor.delete()
        cut.imageMapper.delete()
      }
      renderer.removeActor(overlayFillActor)
      renderer.removeActor(overlayLineActor)
      overlayFillActor.delete()
      overlayLineActor.delete()
      overlayFillMapper.delete()
      overlayLineMapper.delete()
      overlayTriangleFilter.delete()
      overlayFillData?.delete()
      overlayLineData?.delete()
      for (const plane of Object.values(clipPlanes)) plane.delete()
      volume.delete()
      mapper.delete()
      opacity.delete()
      color.delete()
      image.delete()
      renderWindow.delete()
    },
  }
}
