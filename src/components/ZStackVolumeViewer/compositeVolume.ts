export interface VolumeChannel {
  index: number
  color: string
  visible: boolean
}

/** Same -1..1 curves as the flat viewer. 0 leaves the stored pixels alone. */
export interface VolumeAdjust {
  brightness?: number
  contrast?: number
  /** Stored counts at or below this are empty background and are not written. */
  floor?: number
  /** When set, every other z plane is left empty so one slice can be checked on its own. */
  plane?: number
}

export interface AxisRange {
  min: number
  max: number
}

/** Voxel index span of the stain, in the same axes as the volume cuts. */
export interface StainedRange {
  sagittal: AxisRange
  coronal: AxisRange
  axial: AxisRange
}

function paddedRange(min: number, max: number, limit: number): AxisRange {
  if (max < min) return { min: 0, max: Math.max(0, limit) }
  const margin = Math.max(1, Math.round((max - min) * 0.05))
  return {
    min: Math.max(0, min - margin),
    max: Math.min(limit, max + margin),
  }
}

/**
 * Where the stain actually sits. The source images have a black border, and
 * the cut sliders should cross the tissue rather than that empty margin.
 * Y matches the volume: image row 0 is the high volume index.
 */
export function stainedRange(
  planes: Uint8Array[][],
  width: number,
  height: number,
  depth: number,
): StainedRange {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1
  let minZ = depth
  let maxZ = -1
  for (const stack of planes) {
    if (!stack) continue
    for (let z = 0; z < depth; z += 1) {
      const plane = stack[z]
      if (!plane) continue
      for (let y = 0; y < height; y += 1) {
        const row = y * width
        const volumeY = height - 1 - y
        for (let x = 0; x < width; x += 1) {
          if (plane[row + x] === 0) continue
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (volumeY < minY) minY = volumeY
          if (volumeY > maxY) maxY = volumeY
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
        }
      }
    }
  }
  return {
    sagittal: paddedRange(minX, maxX, width - 1),
    coronal: paddedRange(minY, maxY, height - 1),
    axial: paddedRange(minZ, maxZ, depth - 1),
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return [255, 255, 255]
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((value) => Number.isNaN(value))) return [255, 255, 255]
  return [red, green, blue]
}

function clampByte(value: number): number {
  if (value <= 0) return 0
  if (value >= 255) return 255
  return value
}

function mapLinear(value: number, fromMin: number, fromMax: number, toMin: number, toMax: number): number {
  if (fromMax === fromMin) return toMin
  const t = (value - fromMin) / (fromMax - fromMin)
  return toMin + t * (toMax - toMin)
}

/**
 * Brightness is a gamma curve so black stays black. Contrast matches the flat
 * viewer: negative maps to 0–1, positive maps to 1–5.
 */
function adjustmentTable(brightness: number, contrast: number): Uint8Array | null {
  if (brightness === 0 && contrast === 0) return null
  const gamma = brightness < 0 ? mapLinear(brightness, -1, 0, 2.5, 1) : mapLinear(brightness, 0, 1, 1, 0.45)
  const factor = contrast < 0 ? mapLinear(contrast, -1, 0, 0, 1) : mapLinear(contrast, 0, 1, 1, 5)
  const table = new Uint8Array(256)
  for (let value = 0; value < 256; value += 1) {
    let adjusted = brightness === 0 ? value : 255 * Math.pow(value / 255, gamma)
    if (contrast !== 0) adjusted *= factor
    table[value] = clampByte(adjusted)
  }
  return table
}

/**
 * Additive RGB volume. Image row 0 is the top of the slide; VTK's Y axis
 * points up, so rows are flipped. Alpha is the strongest channel at that voxel
 * and drives the opacity transfer function.
 */
export function compositeVolume(
  planes: Uint8Array[][],
  width: number,
  height: number,
  depth: number,
  channels: VolumeChannel[],
  adjust: VolumeAdjust = {},
): Uint8Array {
  const table = adjustmentTable(adjust.brightness ?? 0, adjust.contrast ?? 0)
  const floor = adjust.floor ?? 0
  const out = new Uint8Array(width * height * depth * 4)
  for (const channel of channels) {
    if (!channel.visible) continue
    const source = planes[channel.index]
    if (!source) continue
    const [red, green, blue] = hexToRgb(channel.color)
    for (let z = 0; z < depth; z += 1) {
      if (adjust.plane !== undefined && z !== adjust.plane) continue
      const plane = source[z]
      if (!plane) continue
      for (let y = 0; y < height; y += 1) {
        const yVolume = height - 1 - y
        const row = y * width
        for (let x = 0; x < width; x += 1) {
          const stored = plane[row + x]
          if (stored <= floor) continue
          const intensity = table ? table[stored] : stored
          if (intensity === 0) continue
          const offset = ((z * height + yVolume) * width + x) * 4
          out[offset] = clampByte(out[offset] + (intensity * red) / 255)
          out[offset + 1] = clampByte(out[offset + 1] + (intensity * green) / 255)
          out[offset + 2] = clampByte(out[offset + 2] + (intensity * blue) / 255)
          if (intensity > out[offset + 3]) out[offset + 3] = intensity
        }
      }
    }
  }
  return out
}
