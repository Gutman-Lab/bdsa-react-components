import { describe, it, expect } from 'vitest'
import {
    extractAnnotationElements,
    detectAnnotationFormat,
    geoJSONToDSAElements,
    geoJSONFeatureToDSAElement,
    isGeoJSONFeatureCollection,
    isDSAAnnotation,
    type DSAElement,
} from './annotationFormats'

describe('annotationFormats', () => {
    describe('isGeoJSONFeatureCollection', () => {
        it('should detect valid GeoJSON FeatureCollection', () => {
            const geoJSON = {
                type: 'FeatureCollection',
                features: [],
            }
            expect(isGeoJSONFeatureCollection(geoJSON)).toBe(true)
        })

        it('should reject invalid types', () => {
            expect(isGeoJSONFeatureCollection(null)).toBe(false)
            expect(isGeoJSONFeatureCollection(undefined)).toBe(false)
            expect(isGeoJSONFeatureCollection({ type: 'Feature' })).toBe(false)
            expect(isGeoJSONFeatureCollection({ features: [] })).toBe(false)
            expect(isGeoJSONFeatureCollection({ type: 'FeatureCollection' })).toBe(false)
        })
    })

    describe('isDSAAnnotation', () => {
        it('should detect DSA format with root elements', () => {
            const dsa = { elements: [] }
            expect(isDSAAnnotation(dsa)).toBe(true)
        })

        it('should detect DSA format with nested annotation.elements', () => {
            const dsa = { annotation: { elements: [] } }
            expect(isDSAAnnotation(dsa)).toBe(true)
        })

        it('should reject invalid types', () => {
            expect(isDSAAnnotation(null)).toBe(false)
            expect(isDSAAnnotation(undefined)).toBe(false)
            expect(isDSAAnnotation({})).toBe(false)
            expect(isDSAAnnotation({ type: 'FeatureCollection' })).toBe(false)
        })
    })

    describe('detectAnnotationFormat', () => {
        it('should detect GeoJSON format', () => {
            const geoJSON = {
                type: 'FeatureCollection',
                features: [],
            }
            expect(detectAnnotationFormat(geoJSON)).toBe('geojson')
        })

        it('should detect DSA format', () => {
            const dsa = { elements: [] }
            expect(detectAnnotationFormat(dsa)).toBe('dsa')
        })

        it('should return unknown for invalid formats', () => {
            expect(detectAnnotationFormat(null)).toBe('unknown')
            expect(detectAnnotationFormat({})).toBe('unknown')
            expect(detectAnnotationFormat({ foo: 'bar' })).toBe('unknown')
        })
    })

    describe('geoJSONFeatureToDSAElement', () => {
        it('should convert Polygon to polyline', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [100, 0],
                            [100, 100],
                            [0, 100],
                            [0, 0],
                        ],
                    ],
                },
                properties: {
                    lineColor: '#00ff00',
                    fillColor: 'rgba(0,255,0,0.5)',
                    lineWidth: 2,
                    group: 'test-group',
                    label: 'Test Polygon',
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element).toBeDefined()
            expect(element?.type).toBe('polyline')
            expect(element?.points).toHaveLength(5)
            expect(element?.closed).toBe(true)
            expect(element?.lineColor).toBe('#00ff00')
            expect(element?.fillColor).toBe('rgba(0,255,0,0.5)')
            expect(element?.lineWidth).toBe(2)
            expect(element?.group).toBe('test-group')
            expect(element?.label).toBe('Test Polygon')
        })

        it('should convert LineString to polyline', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: [
                        [0, 0],
                        [100, 100],
                        [200, 50],
                    ],
                },
                properties: {
                    stroke: '#ff0000',
                    'stroke-width': 3,
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element).toBeDefined()
            expect(element?.type).toBe('polyline')
            expect(element?.points).toHaveLength(3)
            expect(element?.closed).toBe(false)
            expect(element?.lineColor).toBe('#ff0000')
            expect(element?.lineWidth).toBe(3)
        })

        it('should convert Point to circle approximation', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [50, 50],
                },
                properties: {
                    lineColor: '#0000ff',
                    lineWidth: 5,
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element).toBeDefined()
            expect(element?.type).toBe('polyline')
            expect(element?.points).toHaveLength(8) // 8-point circle
            expect(element?.closed).toBe(true)
        })

        it('should handle missing properties with defaults', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 10],
                            [0, 0],
                        ],
                    ],
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element).toBeDefined()
            expect(element?.lineColor).toBe('#ff0000') // default
            expect(element?.fillColor).toBe('rgba(255,0,0,0.3)') // default
            expect(element?.lineWidth).toBe(1) // default
        })

        it('should return null for invalid geometries', () => {
            const invalidFeature1 = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [],
                },
            }
            expect(geoJSONFeatureToDSAElement(invalidFeature1)).toBeNull()

            const invalidFeature2 = {
                type: 'Feature' as const,
                geometry: {
                    type: 'LineString' as const,
                    coordinates: [[0, 0]], // Only 1 point
                },
            }
            expect(geoJSONFeatureToDSAElement(invalidFeature2)).toBeNull()
        })

        it('should warn and return null for unsupported MultiPolygon', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'MultiPolygon' as const,
                    coordinates: [],
                },
            }
            expect(geoJSONFeatureToDSAElement(feature)).toBeNull()
        })
    })

    describe('geoJSONToDSAElements', () => {
        it('should convert FeatureCollection to elements array', () => {
            const featureCollection = {
                type: 'FeatureCollection' as const,
                features: [
                    {
                        type: 'Feature' as const,
                        geometry: {
                            type: 'Polygon' as const,
                            coordinates: [
                                [
                                    [0, 0],
                                    [10, 0],
                                    [10, 10],
                                    [0, 10],
                                    [0, 0],
                                ],
                            ],
                        },
                    },
                    {
                        type: 'Feature' as const,
                        geometry: {
                            type: 'LineString' as const,
                            coordinates: [
                                [20, 20],
                                [30, 30],
                            ],
                        },
                    },
                ],
            }

            const elements = geoJSONToDSAElements(featureCollection)
            expect(elements).toHaveLength(2)
            expect(elements[0].type).toBe('polyline')
            expect(elements[0].closed).toBe(true)
            expect(elements[1].type).toBe('polyline')
            expect(elements[1].closed).toBe(false)
        })

        it('should filter out invalid features', () => {
            const featureCollection = {
                type: 'FeatureCollection' as const,
                features: [
                    {
                        type: 'Feature' as const,
                        geometry: {
                            type: 'Polygon' as const,
                            coordinates: [
                                [
                                    [0, 0],
                                    [10, 0],
                                    [10, 10],
                                    [0, 0],
                                ],
                            ],
                        },
                    },
                    {
                        type: 'Feature' as const,
                        geometry: {
                            type: 'LineString' as const,
                            coordinates: [[0, 0]], // Invalid: only 1 point
                        },
                    },
                ],
            }

            const elements = geoJSONToDSAElements(featureCollection)
            expect(elements).toHaveLength(1) // Only valid feature
        })

        it('should handle empty FeatureCollection', () => {
            const featureCollection = {
                type: 'FeatureCollection' as const,
                features: [],
            }

            const elements = geoJSONToDSAElements(featureCollection)
            expect(elements).toHaveLength(0)
        })
    })

    describe('extractAnnotationElements', () => {
        it('should extract elements from GeoJSON FeatureCollection', () => {
            const geoJSON = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [0, 0],
                                    [10, 0],
                                    [10, 10],
                                    [0, 10],
                                    [0, 0],
                                ],
                            ],
                        },
                    },
                ],
            }

            const elements = extractAnnotationElements(geoJSON)
            expect(elements).toHaveLength(1)
            expect(elements[0].type).toBe('polyline')
        })

        it('should extract elements from DSA format (root level)', () => {
            const dsa = {
                elements: [
                    {
                        type: 'polyline',
                        points: [
                            [0, 0],
                            [10, 10],
                        ],
                        closed: false,
                    },
                ],
            }

            const elements = extractAnnotationElements(dsa)
            expect(elements).toHaveLength(1)
            expect(elements[0].type).toBe('polyline')
        })

        it('should extract elements from DSA format (nested annotation.elements)', () => {
            const dsa = {
                annotation: {
                    elements: [
                        {
                            type: 'rectangle',
                            x: 0,
                            y: 0,
                            width: 100,
                            height: 100,
                        },
                    ],
                },
            }

            const elements = extractAnnotationElements(dsa)
            expect(elements).toHaveLength(1)
            expect(elements[0].type).toBe('rectangle')
        })

        it('should return empty array for invalid input', () => {
            expect(extractAnnotationElements(null)).toEqual([])
            expect(extractAnnotationElements(undefined)).toEqual([])
            expect(extractAnnotationElements({})).toEqual([])
            expect(extractAnnotationElements({ foo: 'bar' })).toEqual([])
        })

        it('should handle mixed case - prefer root elements over nested', () => {
            const dsa = {
                elements: [{ type: 'polyline', points: [[0, 0]], closed: false }],
                annotation: {
                    elements: [{ type: 'rectangle', x: 0, y: 0, width: 10, height: 10 }],
                },
            }

            const elements = extractAnnotationElements(dsa)
            expect(elements).toHaveLength(1)
            expect(elements[0].type).toBe('polyline') // Root level takes precedence
        })
    })

    describe('property name variations', () => {
        it('should handle stroke property as lineColor', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 0],
                        ],
                    ],
                },
                properties: {
                    stroke: '#00ff00',
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element?.lineColor).toBe('#00ff00')
        })

        it('should handle fill property as fillColor', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 0],
                        ],
                    ],
                },
                properties: {
                    fill: 'rgba(0,255,0,0.8)',
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element?.fillColor).toBe('rgba(0,255,0,0.8)')
        })

        it('should handle stroke-width property as lineWidth', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 0],
                        ],
                    ],
                },
                properties: {
                    'stroke-width': 5,
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element?.lineWidth).toBe(5)
        })

        it('should prioritize DSA-style names over GeoJSON names', () => {
            const feature = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [
                        [
                            [0, 0],
                            [10, 0],
                            [10, 10],
                            [0, 0],
                        ],
                    ],
                },
                properties: {
                    lineColor: '#ff0000',
                    stroke: '#00ff00', // Should be overridden by lineColor
                },
            }

            const element = geoJSONFeatureToDSAElement(feature)
            expect(element?.lineColor).toBe('#ff0000')
        })
    })
})





