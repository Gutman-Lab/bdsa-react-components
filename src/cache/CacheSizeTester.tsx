import { useState } from 'react'
import { measureAnnotationSizes, printSizeSummary, type SizeMeasurement } from './measureAnnotationSize'

/**
 * React component to test annotation cache sizes.
 * Use this in Storybook or a test page to measure your annotation documents.
 */
export function CacheSizeTester({
    apiBaseUrl,
    imageId,
}: {
    apiBaseUrl: string
    imageId: string | number
}) {
    const [loading, setLoading] = useState(false)
    const [measurements, setMeasurements] = useState<SizeMeasurement[]>([])
    const [error, setError] = useState<string | null>(null)

    const handleMeasure = async () => {
        setLoading(true)
        setError(null)
        setMeasurements([])

        try {
            const results = await measureAnnotationSizes(apiBaseUrl, imageId)
            setMeasurements(results)
            printSizeSummary(results)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error')
            console.error('Measurement failed:', err)
        } finally {
            setLoading(false)
        }
    }

    const totalRawMB = measurements.reduce((sum, m) => sum + m.jsonStringSizeMB, 0)
    const totalIndexedDBMB = measurements.reduce((sum, m) => sum + m.estimatedIndexedDBSizeMB, 0)
    const totalCompressedMB = measurements
        .filter(m => m.compressedSizeMB !== undefined)
        .reduce((sum, m) => sum + (m.compressedSizeMB || 0), 0)

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '800px' }}>
            <h2>Annotation Cache Size Tester</h2>
            
            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={handleMeasure}
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: loading ? 'wait' : 'pointer',
                    }}
                >
                    {loading ? 'Measuring...' : 'Measure Annotation Sizes'}
                </button>
            </div>

            {error && (
                <div style={{ color: 'red', marginBottom: '20px', padding: '10px', background: '#ffe0e0' }}>
                    Error: {error}
                </div>
            )}

            {measurements.length > 0 && (
                <div>
                    <h3>Results ({measurements.length} annotation(s))</h3>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                        <thead>
                            <tr style={{ background: '#f0f0f0' }}>
                                <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ccc' }}>ID</th>
                                <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ccc' }}>Raw JSON</th>
                                <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ccc' }}>IndexedDB Est.</th>
                                {totalCompressedMB > 0 && (
                                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ccc' }}>Compressed</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {measurements.map((m) => (
                                <tr key={String(m.annotationId)}>
                                    <td style={{ padding: '8px', border: '1px solid #ccc', fontSize: '12px' }}>
                                        {String(m.annotationId).slice(0, 20)}...
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                        {m.jsonStringSizeMB.toFixed(2)} MB
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                        {m.estimatedIndexedDBSizeMB.toFixed(2)} MB
                                    </td>
                                    {totalCompressedMB > 0 && (
                                        <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                            {m.compressedSizeMB
                                                ? `${m.compressedSizeMB.toFixed(2)} MB (${((m.compressionRatio || 0) * 100).toFixed(1)}%)`
                                                : 'N/A'}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                            <tr>
                                <td style={{ padding: '8px', border: '1px solid #ccc' }}>TOTAL</td>
                                <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                    {totalRawMB.toFixed(2)} MB
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                    {totalIndexedDBMB.toFixed(2)} MB
                                </td>
                                {totalCompressedMB > 0 && (
                                    <td style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'right' }}>
                                        {totalCompressedMB.toFixed(2)} MB
                                    </td>
                                )}
                            </tr>
                        </tfoot>
                    </table>

                    <div style={{ padding: '15px', background: '#e8f4f8', borderRadius: '4px' }}>
                        <h4>Storage Limits:</h4>
                        <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                            <li><strong>localStorage:</strong> ~5-10MB per domain</li>
                            <li><strong>IndexedDB:</strong> 50MB+ (expandable with permission)</li>
                        </ul>

                        {totalIndexedDBMB > 5 && (
                            <div style={{ color: '#d9534f', marginTop: '10px', fontWeight: 'bold' }}>
                                ⚠️ Total size exceeds localStorage limit. Use IndexedDBAnnotationCache.
                            </div>
                        )}

                        {totalIndexedDBMB <= 50 ? (
                            <div style={{ color: '#5cb85c', marginTop: '10px', fontWeight: 'bold' }}>
                                ✓ Total size is within IndexedDB limits.
                            </div>
                        ) : (
                            <div style={{ color: '#f0ad4e', marginTop: '10px', fontWeight: 'bold' }}>
                                ⚠️ Total size may require IndexedDB quota expansion.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

