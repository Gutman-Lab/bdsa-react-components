import { useEffect, useRef } from 'react'
import type { Viewer as OpenSeadragonViewer } from 'openseadragon'
import OpenSeadragon from 'openseadragon'
import type { OverlayTileSource } from '../SlideViewer.types'
import type { DebugLogger } from '../../../utils/debugLog'

/**
 * Hook to manage overlay tile sources (dynamically add/remove/update tile sources on top of base image)
 */
export function useOverlayTileSources(
    viewer: OpenSeadragonViewer | null,
    overlayTileSources: OverlayTileSource[],
    baseImageWidth: number | null,
    baseImageHeight: number | null,
    debugLog: DebugLogger
) {
    // Track which overlay tile sources have been added to the viewer
    const overlayTileSourceRefs = useRef<Map<string | number, { tiledImage: unknown; index: number }>>(new Map())

    useEffect(() => {
        if (!viewer) {
            debugLog.log('useOverlayTileSources: No viewer available')
            return
        }

        // Wait for base image to be loaded (we need its dimensions for positioning)
        if (!baseImageWidth || !baseImageHeight) {
            debugLog.log('useOverlayTileSources: Base image dimensions not available yet')
            return
        }

        const world = viewer.world
        if (!world) {
            debugLog.warn('useOverlayTileSources: World not available')
            return
        }

        // Get the base image's bounds in OpenSeadragon's coordinate system
        // This is critical for proper coordinate conversion
        // The base image should always be at index 0 (first item added)
        // Even when overlays are present, they are added after the base image
        const baseTiledImage = world.getItemAt(0)
        if (!baseTiledImage) {
            debugLog.warn('useOverlayTileSources: Base image not found at index 0')
            return
        }
        
        // Verify this is actually the base image (not an overlay)
        // Overlays should have indices > 0
        const itemCount = world.getItemCount()
        debugLog.log(`useOverlayTileSources: World has ${itemCount} items, base image at index 0`)

        let baseBounds: { x: number; y: number; width: number; height: number } | null = null
        try {
            // Get the bounds of the base image in world coordinates
            // getBounds() returns the bounding box in world coordinates
            const bounds = (baseTiledImage as any).getBounds?.()
            
            if (bounds && bounds.width > 0 && bounds.height > 0) {
                // Use getBounds() which gives us the actual position and size in world coordinates
                baseBounds = {
                    x: bounds.x ?? 0,
                    y: bounds.y ?? 0,
                    width: bounds.width,
                    height: bounds.height,
                }
                debugLog.log('Base image bounds in OSD coordinates (from getBounds):', baseBounds)
            } else {
                // Fallback: try getContentSize
                const contentSize = (baseTiledImage as any).getContentSize?.()
                if (contentSize && contentSize.x > 0 && contentSize.y > 0) {
                    // Get the position of the base image in world coordinates
                    const positionBounds = (baseTiledImage as any).getBounds?.()
                    const baseX = positionBounds?.x ?? 0
                    const baseY = positionBounds?.y ?? 0
                    
                    baseBounds = {
                        x: baseX,
                        y: baseY,
                        width: contentSize.x,
                        height: contentSize.y,
                    }
                    debugLog.log('Base image bounds in OSD coordinates (from contentSize):', baseBounds)
                } else {
                    // Final fallback: try getSourceBounds
                    const sourceBounds = (baseTiledImage as any).getSourceBounds?.()
                    if (sourceBounds && sourceBounds.width > 0 && sourceBounds.height > 0) {
                        baseBounds = {
                            x: sourceBounds.x || 0,
                            y: sourceBounds.y || 0,
                            width: sourceBounds.width,
                            height: sourceBounds.height,
                        }
                        debugLog.log('Base image bounds in OSD coordinates (from sourceBounds):', baseBounds)
                    } else {
                        // Ultimate fallback: assume base image starts at (0, 0) with its content size
                        baseBounds = {
                            x: 0,
                            y: 0,
                            width: baseImageWidth,
                            height: baseImageHeight,
                        }
                        debugLog.log('Using fallback base image bounds:', baseBounds)
                    }
                }
            }
        } catch (error) {
            debugLog.warn('Error getting base image bounds, using fallback:', error)
            // Fallback: assume base image starts at (0, 0) with its content size
            baseBounds = {
                x: 0,
                y: 0,
                width: baseImageWidth,
                height: baseImageHeight,
            }
        }

        if (!baseBounds) {
            debugLog.warn('useOverlayTileSources: Could not determine base image bounds')
            return
        }

        debugLog.log(`useOverlayTileSources: Managing ${overlayTileSources.length} overlay tile sources`)

        // Get current overlay IDs from props
        const currentOverlayIds = new Set(overlayTileSources.map(overlay => overlay.id))

        // Remove overlays that are no longer in the props
        const overlaysToRemove: string[] = []
        overlayTileSourceRefs.current.forEach((ref, id) => {
            if (!currentOverlayIds.has(id)) {
                overlaysToRemove.push(String(id))
            }
        })

        for (const id of overlaysToRemove) {
            const ref = overlayTileSourceRefs.current.get(id)
            if (ref) {
                try {
                    debugLog.log(`Removing overlay tile source ${id}`)
                    world.removeItem(ref.tiledImage)
                    overlayTileSourceRefs.current.delete(id)
                } catch (error) {
                    debugLog.warn(`Error removing overlay tile source ${id}:`, error)
                }
            }
        }

        // Add or update overlays
        for (const overlay of overlayTileSources) {
            const existingRef = overlayTileSourceRefs.current.get(overlay.id)

            if (existingRef) {
                // Update existing overlay
                try {
                    const tiledImage = world.getItemAt(existingRef.index)
                    if (!tiledImage) {
                        debugLog.warn(`Overlay tile source ${overlay.id} not found at index ${existingRef.index}, will re-add`)
                        overlayTileSourceRefs.current.delete(overlay.id)
                        // Fall through to add logic below
                    } else {
                        debugLog.log(`Updating overlay tile source ${overlay.id}`)

                        // Update opacity
                        if (overlay.opacity !== undefined) {
                            const opacity = overlay.visible === false ? 0 : overlay.opacity
                            ;(tiledImage as any).setOpacity?.(opacity)
                        } else if (overlay.visible === false) {
                            ;(tiledImage as any).setOpacity?.(0)
                        }

                        // Update position (convert normalized 0-1 coordinates to OpenSeadragon coordinates)
                        // Only update position if x or y values are explicitly provided and different
                        // Coordinates are relative to the base image's bounds
                        if (overlay.x !== undefined || overlay.y !== undefined) {
                            const currentBounds = (tiledImage as any).getBounds?.()
                            const currentX = currentBounds?.x ?? baseBounds.x
                            const currentY = currentBounds?.y ?? baseBounds.y
                            
                            const newX = overlay.x !== undefined 
                                ? baseBounds.x + (overlay.x * baseBounds.width)
                                : currentX
                            const newY = overlay.y !== undefined 
                                ? baseBounds.y + (overlay.y * baseBounds.height)
                                : currentY
                            
                            // Only update position if it actually changed (avoid unnecessary position updates)
                            // This prevents overlays from moving when only opacity changes
                            const threshold = 0.001 // Small threshold to account for floating point precision
                            if (Math.abs(newX - currentX) > threshold || Math.abs(newY - currentY) > threshold) {
                                debugLog.log(`  Updating position: (${currentX.toFixed(2)}, ${currentY.toFixed(2)}) -> (${newX.toFixed(2)}, ${newY.toFixed(2)})`)
                                ;(tiledImage as any).setPosition?.({ x: newX, y: newY })
                            }
                        }

                        // Update size (convert normalized 0-1 coordinates to OpenSeadragon coordinates)
                        // Only update if size actually changed
                        if (overlay.width !== undefined) {
                            const currentBounds = (tiledImage as any).getBounds?.()
                            const currentWidth = currentBounds?.width ?? (overlay.width * baseBounds.width)
                            const newWidth = overlay.width * baseBounds.width
                            if (Math.abs(newWidth - currentWidth) > 0.001) {
                                ;(tiledImage as any).setWidth?.(newWidth)
                            }
                        }
                        if (overlay.height !== undefined) {
                            const currentBounds = (tiledImage as any).getBounds?.()
                            const currentHeight = currentBounds?.height ?? (overlay.height * baseBounds.height)
                            const newHeight = overlay.height * baseBounds.height
                            if (Math.abs(newHeight - currentHeight) > 0.001) {
                                ;(tiledImage as any).setHeight?.(newHeight)
                            }
                        }

                        // Update rotation
                        if (overlay.rotation !== undefined) {
                            ;(tiledImage as any).setRotation?.(overlay.rotation)
                        }

                        // Update composite operation
                        if (overlay.compositeOperation !== undefined) {
                            ;(tiledImage as any).setCompositeOperation?.(overlay.compositeOperation)
                        }

                        // Force redraw
                        ;(tiledImage as any).draw?.()
                        continue
                    }
                } catch (error) {
                    debugLog.warn(`Error updating overlay tile source ${overlay.id}:`, error)
                    overlayTileSourceRefs.current.delete(overlay.id)
                    // Fall through to add logic
                }
            }

            // Add new overlay
            try {
                debugLog.log(`Adding overlay tile source ${overlay.id}`)
                debugLog.log(`  Normalized coords: x=${overlay.x ?? 0}, y=${overlay.y ?? 0}, width=${overlay.width ?? 'auto'}, height=${overlay.height ?? 'auto'}`)
                debugLog.log(`  Base bounds: x=${baseBounds.x}, y=${baseBounds.y}, width=${baseBounds.width}, height=${baseBounds.height}`)

                // Convert normalized 0-1 coordinates to OpenSeadragon coordinates
                // Coordinates are relative to the base image's bounds in OpenSeadragon's coordinate system
                const x = baseBounds.x + ((overlay.x ?? 0) * baseBounds.width)
                const y = baseBounds.y + ((overlay.y ?? 0) * baseBounds.height)
                const width = overlay.width !== undefined ? overlay.width * baseBounds.width : undefined
                const height = overlay.height !== undefined ? overlay.height * baseBounds.height : undefined
                const opacity = overlay.visible === false ? 0 : (overlay.opacity ?? 1)
                
                debugLog.log(`  Calculated OSD coords: x=${x}, y=${y}, width=${width ?? 'auto'}, height=${height ?? 'auto'}`)

                // Prepare tile source
                // For base64 images and regular image files, use OpenSeadragon's SimpleImage tile source
                // For DZI URLs or other tile sources, pass them as-is
                let tileSource: string | unknown = overlay.tileSource

                // Check if it's a base64 data URL or a regular image file (jpg, png, etc.)
                const isBase64 = typeof tileSource === 'string' && tileSource.startsWith('data:image/')
                const isImageFile = typeof tileSource === 'string' && 
                    (tileSource.match(/\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i) || 
                     (tileSource.startsWith('http') && !tileSource.includes('.dzi')))

                if (isBase64 || isImageFile) {
                    // Use OpenSeadragon's SimpleImage tile source for base64 and regular images
                    // SimpleImage is a built-in tile source type in OpenSeadragon
                    tileSource = {
                        type: 'image',
                        url: tileSource as string,
                    }
                    debugLog.log(`Using SimpleImage tile source for ${isBase64 ? 'base64' : 'image file'}: ${overlay.id}`)
                } else {
                    debugLog.log(`Using provided tile source as-is for overlay ${overlay.id}`)
                }

                // Prepare options for addTiledImage
                // OpenSeadragon doesn't support specifying both width and height
                // If both are provided, only use width and let it maintain aspect ratio
                const options: any = {
                    tileSource,
                    opacity,
                    rotation: overlay.rotation ?? 0,
                    compositeOperation: overlay.compositeOperation ?? 'source-over',
                    crossOriginPolicy: 'Anonymous',
                    ajaxWithCredentials: false,
                    loadTilesWithAjax: false,
                    success: (tiledImage: any) => {
                        // Explicitly set position and size after the image is loaded
                        // This ensures SimpleImage tile sources are positioned correctly
                        try {
                            debugLog.log(`Setting position for overlay ${overlay.id} after load: x=${x}, y=${y}`)
                            
                            // Set position explicitly using OpenSeadragon's Point class
                            if (tiledImage.setPosition) {
                                tiledImage.setPosition(new OpenSeadragon.Point(x, y))
                            }
                            
                            // Set size if provided
                            if (width !== undefined) {
                                if (tiledImage.setWidth) {
                                    tiledImage.setWidth(width)
                                }
                            } else if (height !== undefined) {
                                if (tiledImage.setHeight) {
                                    tiledImage.setHeight(height)
                                }
                            }
                            
                            // Force a redraw to ensure the position is applied
                            if (tiledImage.draw) {
                                tiledImage.draw()
                            }
                            
                            debugLog.log(`Successfully positioned overlay tile source ${overlay.id}`)
                        } catch (error) {
                            debugLog.warn(`Error positioning overlay ${overlay.id} after load:`, error)
                        }
                    },
                }

                // Only set one dimension to avoid OpenSeadragon warning
                // Prefer width if both are provided
                // Note: We set these in the success callback instead to ensure they're applied correctly
                // But we can also set them here as a fallback
                if (width !== undefined) {
                    options.width = width
                } else if (height !== undefined) {
                    options.height = height
                }

                // Add the tiled image
                // Note: For SimpleImage sources, x/y in options might not work, so we set it in the success callback
                viewer.addTiledImage(options)

                // Get the index of the newly added item
                // Use a small delay to ensure the item is added to the world
                setTimeout(() => {
                    const itemCount = world.getItemCount()
                    // Find the tiled image we just added (it should be the last one)
                    const tiledImage = world.getItemAt(itemCount - 1)
                    
                    // Verify this is our overlay by checking if it's not the base image
                    if (tiledImage && itemCount > 1) {
                        overlayTileSourceRefs.current.set(overlay.id, {
                            tiledImage,
                            index: itemCount - 1,
                        })
                        debugLog.log(`Successfully added overlay tile source ${overlay.id} at index ${itemCount - 1}`)
                        
                        // Also set position immediately in case success callback didn't fire
                        // This is a fallback to ensure positioning works even if the callback doesn't execute
                        try {
                            if ((tiledImage as any).setPosition) {
                                (tiledImage as any).setPosition(new OpenSeadragon.Point(x, y))
                            }
                            if (width !== undefined && (tiledImage as any).setWidth) {
                                (tiledImage as any).setWidth(width)
                            } else if (height !== undefined && (tiledImage as any).setHeight) {
                                (tiledImage as any).setHeight(height)
                            }
                            // Force redraw
                            if ((tiledImage as any).draw) {
                                (tiledImage as any).draw()
                            }
                        } catch (error) {
                            debugLog.warn(`Error setting position immediately for overlay ${overlay.id}:`, error)
                        }
                    } else {
                        debugLog.warn(`Failed to get tiled image for overlay ${overlay.id} after adding`)
                    }
                }, 0)
            } catch (error) {
                debugLog.warn(`Error adding overlay tile source ${overlay.id}:`, error)
            }
        }
    }, [viewer, overlayTileSources, baseImageWidth, baseImageHeight, debugLog])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (viewer && overlayTileSourceRefs.current.size > 0) {
                const world = viewer.world
                if (world) {
                    overlayTileSourceRefs.current.forEach((ref, id) => {
                        try {
                            world.removeItem(ref.tiledImage)
                        } catch (error) {
                            // Ignore cleanup errors
                        }
                    })
                }
                overlayTileSourceRefs.current.clear()
            }
        }
    }, [viewer])
}
