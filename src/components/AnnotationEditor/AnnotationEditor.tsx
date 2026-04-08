import { useState } from 'react'
import { SlideViewer } from '../SlideViewer/SlideViewer'
import type { AnnotationEditorProps, EditorMode } from './AnnotationEditor.types'
import './AnnotationEditor.css'

/**
 * AnnotationEditor — wraps SlideViewer and adds a protocol-driven toolbar for
 * human-in-the-loop annotation editing (ROI selection, mode switching, save).
 *
 * UI only — no data fetching or editing logic is wired yet.
 */
export function AnnotationEditor({
    imageInfo,
    config,
    apiBaseUrl,
    authToken,
    tokenQueryParam,
    fetchFn,
    apiHeaders,
    showInfoBar = true,
    className = '',
    style,
    onApiError,
}: AnnotationEditorProps) {
    const [selectedRoiIndex, setSelectedRoiIndex] = useState<number>(-1)
    const [markComplete, setMarkComplete] = useState(false)
    const [activeMode, setActiveMode] = useState<EditorMode | null>(null)
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

    // Placeholder ROI list — will be populated from the annotation document
    const rois: { label: string }[] = []

    return (
        <div className={`annotation-editor ${className}`} style={style}>
            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className="annotation-editor__toolbar">
                {/* ROI selector */}
                <div className="annotation-editor__toolbar-group">
                    <span className="annotation-editor__roi-label">ROI:</span>
                    <select
                        className="annotation-editor__roi-select"
                        value={selectedRoiIndex}
                        onChange={e => setSelectedRoiIndex(Number(e.target.value))}
                        disabled={rois.length === 0}
                    >
                        {rois.length === 0 ? (
                            <option value={-1}>— no ROIs loaded —</option>
                        ) : (
                            <>
                                <option value={-1}>Select an ROI…</option>
                                {rois.map((roi, i) => (
                                    <option key={i} value={i}>
                                        {roi.label}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>

                    <label className="annotation-editor__checkbox-label">
                        <input
                            type="checkbox"
                            checked={markComplete}
                            onChange={e => setMarkComplete(e.target.checked)}
                            disabled={selectedRoiIndex < 0}
                        />
                        Mark Complete
                    </label>
                </div>

                <div className="annotation-editor__toolbar-divider" />

                {/* Mode buttons */}
                <div className="annotation-editor__mode-group">
                    <button
                        className={`annotation-editor__mode-btn${activeMode === 'add-roi' ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setActiveMode(activeMode === 'add-roi' ? null : 'add-roi')}
                        title="Draw a new ROI rectangle on the slide"
                    >
                        Add ROI
                    </button>
                    <button
                        className={`annotation-editor__mode-btn${activeMode === 'edit-roi' ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setActiveMode(activeMode === 'edit-roi' ? null : 'edit-roi')}
                        disabled={selectedRoiIndex < 0}
                        title="Edit the currently selected ROI"
                    >
                        Edit Active ROI
                    </button>
                    <button
                        className={`annotation-editor__mode-btn annotation-editor__mode-btn--danger${activeMode === 'delete-roi' ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setActiveMode(activeMode === 'delete-roi' ? null : 'delete-roi')}
                        disabled={selectedRoiIndex < 0}
                        title="Delete the currently selected ROI"
                    >
                        Delete Active ROI
                    </button>
                </div>
            </div>

            {/* ── SlideViewer ──────────────────────────────────────── */}
            <div className="annotation-editor__viewer">
                <SlideViewer
                    imageInfo={imageInfo}
                    apiBaseUrl={apiBaseUrl}
                    authToken={authToken}
                    tokenQueryParam={tokenQueryParam}
                    fetchFn={fetchFn}
                    apiHeaders={apiHeaders}
                    showInfoBar={showInfoBar}
                    height="100%"
                    width="100%"
                    osdOptions={config.viewerOptions as never}
                    onApiError={onApiError}
                />
            </div>

            {/* ── Duplicate document warning ───────────────────────── */}
            {showDuplicateWarning && (
                <div className="annotation-editor__modal-backdrop">
                    <div className="annotation-editor__modal" role="dialog" aria-modal="true">
                        <div className="annotation-editor__modal-title">
                            <span className="annotation-editor__modal-icon">⚠️</span>
                            Multiple annotation documents found
                        </div>
                        <div className="annotation-editor__modal-body">
                            More than one annotation document named{' '}
                            <strong>"{config.annotationDocumentName}"</strong> was found on the server.
                            <br /><br />
                            The first document has been loaded. Please remove the duplicate(s) on
                            the DSA server to avoid data conflicts.
                        </div>
                        <div className="annotation-editor__modal-footer">
                            <button
                                className="annotation-editor__modal-ok-btn"
                                onClick={() => setShowDuplicateWarning(false)}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
