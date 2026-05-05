import type { AnnotationType } from './AnnotationEditor.types'
import { resolveStrokeColor } from './AnnotationEditor.utils'

export interface PolygonToolbarProps {
    rois: { label: string; roiIndex: number }[]
    selectedRoiIndex: number
    setSelectedRoiIndex: (i: number) => void
    annotationTypes: AnnotationType[]
    selectedTypeIndex: number
    setSelectedTypeIndex: (i: number) => void
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    saveAnnotation: () => void
    isLoadingAnnotation: boolean
    canSave: boolean
}

export function AnnotationEditorPolygonsToolbar({
    rois,
    selectedRoiIndex,
    setSelectedRoiIndex,
    annotationTypes,
    selectedTypeIndex,
    setSelectedTypeIndex,
    saveStatus,
    saveAnnotation,
    isLoadingAnnotation,
    canSave,
}: PolygonToolbarProps) {
    const saveLabel =
        saveStatus === 'saving' ? 'Saving…' :
        saveStatus === 'saved'  ? 'Saved'   :
        saveStatus === 'error'  ? 'Error'   : 'Save'

    const saveColor =
        saveStatus === 'saved'  ? '#22c55e' :
        saveStatus === 'error'  ? '#ef4444' : '#c0392b'

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            height: 44,
            borderBottom: '1px solid #ddd',
            background: '#fafafa',
            flexShrink: 0,
            fontFamily: 'sans-serif',
            fontSize: 13,
        }}>
            {/* ROI selector */}
            <select
                value={selectedRoiIndex}
                onChange={e => setSelectedRoiIndex(Number(e.target.value))}
                disabled={isLoadingAnnotation}
                style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
            >
                <option value={-1}>Select ROI…</option>
                {rois.map((roi, i) => (
                    <option key={roi.roiIndex} value={i}>{roi.label}</option>
                ))}
            </select>

            <div style={{ width: 1, background: '#ddd', alignSelf: 'stretch', margin: '4px 0' }} />

            {/* Tissue type buttons */}
            {annotationTypes.map((type, i) => {
                const color = resolveStrokeColor(type)
                const active = selectedTypeIndex === i
                return (
                    <button
                        key={i}
                        onClick={() => setSelectedTypeIndex(i)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            border: `2px solid ${color}`,
                            borderRadius: 4,
                            background: active ? color : 'white',
                            color: active ? 'white' : '#333',
                            cursor: 'pointer',
                            fontWeight: active ? 600 : 400,
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <span style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: color,
                            display: 'inline-block',
                            flexShrink: 0,
                            border: active ? '2px solid rgba(255,255,255,0.6)' : 'none',
                        }} />
                        {type.name}
                    </button>
                )
            })}

            <div style={{ flex: 1 }} />

            {isLoadingAnnotation && (
                <span style={{ color: '#888', fontSize: 12 }}>Loading…</span>
            )}

            <button
                onClick={saveAnnotation}
                disabled={!canSave || saveStatus === 'saving'}
                style={{
                    padding: '4px 14px',
                    background: saveColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: canSave && saveStatus !== 'saving' ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    fontSize: 13,
                    opacity: canSave ? 1 : 0.5,
                }}
            >
                {saveLabel}
            </button>
        </div>
    )
}
