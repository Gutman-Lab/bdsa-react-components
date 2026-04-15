import type { AnnotationType, EditorMode, WorkflowMode } from './AnnotationEditor.types'

export interface ToolbarProps {
    // ROI selector
    rois: { label: string; roiIndex: number }[]
    selectedRoiIndex: number
    setSelectedRoiIndex: (i: number) => void
    markComplete: boolean
    setMarkComplete: (v: boolean) => void
    workflowMode: WorkflowMode
    setWorkflowMode: (m: WorkflowMode) => void

    // Add-labels mode
    isEditingLabel: boolean
    finishEditingLabel: () => void
    cancelEditingLabel: () => void
    labelFixedSizeEnabled: boolean
    setLabelFixedSizeEnabled: (v: boolean) => void
    annotationTypes: AnnotationType[]
    selectedTypeIndex: number
    setSelectedTypeIndex: (i: number) => void

    // Edit-ROIs mode
    activeMode: EditorMode | null
    setActiveMode: (m: EditorMode | null) => void
    fixedSizeEnabled: boolean
    setFixedSizeEnabled: (v: boolean) => void
    fixedWidth: number
    setFixedWidth: (v: number) => void
    fixedHeight: number
    setFixedHeight: (v: number) => void
    finishEditingRoi: () => void
    cancelPendingRoi: () => void
    startEditActiveRoi: () => void
    deleteActiveRoi: () => void

    // Review mode
    reviewItemIndex: number
    reviewItemCount: number
    reviewNextItem: () => void
    reviewPreviousItem: () => void
    reviewSelectedTypeIndex: number
    onReviewTypeChange: (typeIndex: number) => void
    startReviewEditShape: () => void

    // Show info toggle
    showInfo: boolean
    setShowInfo: (v: boolean) => void

    // ROI progress
    roiCompletedCount: number
    roiTotal: number

    // Save / loading
    isLoadingAnnotation: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    saveAnnotation: () => void
    canSave: boolean
}

export function AnnotationEditorToolbar({
    rois, selectedRoiIndex, setSelectedRoiIndex,
    markComplete, setMarkComplete,
    workflowMode, setWorkflowMode,
    isEditingLabel, finishEditingLabel, cancelEditingLabel,
    labelFixedSizeEnabled, setLabelFixedSizeEnabled,
    annotationTypes, selectedTypeIndex, setSelectedTypeIndex,
    activeMode, setActiveMode,
    fixedSizeEnabled, setFixedSizeEnabled,
    fixedWidth, setFixedWidth,
    fixedHeight, setFixedHeight,
    finishEditingRoi, cancelPendingRoi, startEditActiveRoi, deleteActiveRoi,
    reviewItemIndex, reviewItemCount, reviewNextItem, reviewPreviousItem,
    reviewSelectedTypeIndex, onReviewTypeChange, startReviewEditShape,
    showInfo, setShowInfo,
    roiCompletedCount, roiTotal,
    isLoadingAnnotation, saveStatus, saveAnnotation, canSave,
}: ToolbarProps) {
    return (
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
                            <option value={-1}>Unselect ROI</option>
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

                <select
                    className="annotation-editor__roi-select"
                    value={workflowMode}
                    onChange={e => { setWorkflowMode(e.target.value as WorkflowMode); e.target.blur() }}
                >
                    <option value="edit-rois">Edit ROIs</option>
                    <option value="add-labels">Add Labels</option>
                    <option value="review">Review</option>
                </select>
            </div>

            <div className="annotation-editor__toolbar-divider" />

            {/* Add Labels / Review: shape-edit buttons (while editing an existing label shape) */}
            {(workflowMode === 'add-labels' || workflowMode === 'review') && isEditingLabel && (
                <div className="annotation-editor__mode-group">
                    <button
                        className="annotation-editor__mode-btn annotation-editor__mode-btn--finish"
                        onClick={finishEditingLabel}
                        title="Commit the reshaped label box"
                    >
                        Done editing
                    </button>
                    <button
                        className="annotation-editor__mode-btn annotation-editor__mode-btn--danger annotation-editor__mode-btn--cancel"
                        onClick={cancelEditingLabel}
                        title="Discard shape changes"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Review mode: cycle through label boxes in the selected ROI */}
            {workflowMode === 'review' && !isEditingLabel && (
                <div className="annotation-editor__mode-group">
                    <button
                        className="annotation-editor__mode-btn"
                        onClick={reviewPreviousItem}
                        disabled={reviewItemCount === 0}
                        title="Previous label box (← / N)"
                    >
                        &#8249;
                    </button>
                    <span className="annotation-editor__review-counter">
                        {reviewItemIndex >= 0
                            ? `${reviewItemIndex + 1} of ${reviewItemCount}`
                            : `— of ${reviewItemCount}`}
                    </span>
                    <button
                        className="annotation-editor__mode-btn"
                        onClick={reviewNextItem}
                        disabled={reviewItemCount === 0}
                        title="Next label box (→ / M)"
                    >
                        &#8250;
                    </button>
                    <span
                        className="annotation-editor__type-swatch"
                        style={{ backgroundColor: annotationTypes[reviewSelectedTypeIndex]?.color ?? 'transparent', opacity: reviewItemIndex < 0 ? 0.3 : 1 }}
                    />
                    <select
                        className="annotation-editor__roi-select"
                        value={reviewSelectedTypeIndex}
                        disabled={reviewItemIndex < 0}
                        onChange={e => { onReviewTypeChange(Number(e.target.value)); e.target.blur() }}
                        title="Change the type of the focused label box (Q / W to cycle)"
                    >
                        {annotationTypes.map((t, i) => (
                            <option key={i} value={i}>{t.name}</option>
                        ))}
                    </select>
                    <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>Q / W to cycle</span>
                    <button
                        className="annotation-editor__mode-btn"
                        onClick={startReviewEditShape}
                        disabled={reviewItemIndex < 0}
                        title="Edit the shape of the focused label box"
                    >
                        Edit Shape
                    </button>
                </div>
            )}

            {/* Add Labels: type selector */}
            {workflowMode === 'add-labels' && !isEditingLabel && annotationTypes.length > 0 && (
                <div className="annotation-editor__mode-group">
                    <label className="annotation-editor__checkbox-label">
                        <input
                            type="checkbox"
                            checked={labelFixedSizeEnabled}
                            onChange={e => setLabelFixedSizeEnabled(e.target.checked)}
                        />
                        Fixed size
                    </label>
                    {labelFixedSizeEnabled && (
                        <>
                            <span className="annotation-editor__dim-label">W:</span>
                            <input
                                className="annotation-editor__dim-input"
                                type="number"
                                readOnly
                                value={annotationTypes[selectedTypeIndex]?.defaultWidth ?? ''}
                                title="Default width for this annotation type (set in config)"
                            />
                            <span className="annotation-editor__dim-label">H:</span>
                            <input
                                className="annotation-editor__dim-input"
                                type="number"
                                readOnly
                                value={annotationTypes[selectedTypeIndex]?.defaultHeight ?? ''}
                                title="Default height for this annotation type (set in config)"
                            />
                        </>
                    )}
                    <span className="annotation-editor__roi-label">Type:</span>
                    <span
                        className="annotation-editor__type-swatch"
                        style={{ backgroundColor: annotationTypes[selectedTypeIndex]?.color ?? 'transparent' }}
                    />
                    <select
                        className="annotation-editor__roi-select"
                        value={selectedTypeIndex}
                        onChange={e => { setSelectedTypeIndex(Number(e.target.value)); e.target.blur() }}
                    >
                        {annotationTypes.map((t, i) => (
                            <option key={i} value={i}>{t.name}</option>
                        ))}
                    </select>
                    <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>Q / W to cycle</span>
                </div>
            )}

            {/* Edit ROIs: mode buttons */}
            {workflowMode === 'edit-rois' && (
                <div className="annotation-editor__mode-group">
                    {activeMode === 'drawing-roi' ? (
                        <>
                            <button
                                className="annotation-editor__mode-btn annotation-editor__mode-btn--finish"
                                onClick={finishEditingRoi}
                                title="Accept the drawn ROI and save it"
                            >
                                Finish editing
                            </button>
                            <button
                                className="annotation-editor__mode-btn annotation-editor__mode-btn--danger annotation-editor__mode-btn--cancel"
                                onClick={cancelPendingRoi}
                                title="Discard the drawn ROI"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <label className="annotation-editor__checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={fixedSizeEnabled}
                                    onChange={e => setFixedSizeEnabled(e.target.checked)}
                                />
                                Fixed size
                            </label>
                            {fixedSizeEnabled && (
                                <>
                                    <span className="annotation-editor__dim-label">W:</span>
                                    <input
                                        className="annotation-editor__dim-input"
                                        type="number"
                                        min={1}
                                        value={fixedWidth}
                                        onChange={e => setFixedWidth(Math.max(1, Number(e.target.value)))}
                                        title="Fixed ROI width in image pixels"
                                    />
                                    <span className="annotation-editor__dim-label">H:</span>
                                    <input
                                        className="annotation-editor__dim-input"
                                        type="number"
                                        min={1}
                                        value={fixedHeight}
                                        onChange={e => setFixedHeight(Math.max(1, Number(e.target.value)))}
                                        title="Fixed ROI height in image pixels"
                                    />
                                </>
                            )}
                            <button
                                className={`annotation-editor__mode-btn${activeMode === 'add-roi' ? ' annotation-editor__mode-btn--active' : ''}`}
                                onClick={() => {
                                    if (activeMode === 'add-roi') {
                                        setActiveMode(null)
                                    } else {
                                        setSelectedRoiIndex(-1)
                                        setActiveMode('add-roi')
                                    }
                                }}
                                title={fixedSizeEnabled ? 'Click on slide to place a fixed-size ROI' : 'Draw a new ROI rectangle on the slide'}
                            >
                                Add ROI
                            </button>
                            <button
                                className="annotation-editor__mode-btn"
                                onClick={startEditActiveRoi}
                                disabled={selectedRoiIndex < 0}
                                title="Edit the currently selected ROI"
                            >
                                Edit Active ROI
                            </button>
                            <button
                                className="annotation-editor__mode-btn annotation-editor__mode-btn--danger"
                                onClick={deleteActiveRoi}
                                disabled={selectedRoiIndex < 0}
                                title="Delete the currently selected ROI"
                            >
                                Delete Active ROI
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Spacer pushes save button to the far right */}
            <div style={{ flex: 1 }} />

            <button
                className={`annotation-editor__mode-btn${showInfo ? ' annotation-editor__mode-btn--active' : ''}`}
                onClick={() => setShowInfo(!showInfo)}
                title="Hover over elements to see their info"
            >
                Show Info
            </button>

            {roiTotal > 0 && (() => {
                const mod = roiCompletedCount === 0
                    ? ''
                    : roiCompletedCount === roiTotal
                        ? ' annotation-editor__roi-progress--complete'
                        : ' annotation-editor__roi-progress--partial'
                return (
                    <div className={`annotation-editor__roi-progress${mod}`}>
                        ROI Progress
                        <span className="annotation-editor__roi-progress__count">
                            {roiCompletedCount}&thinsp;/&thinsp;{roiTotal}
                        </span>
                    </div>
                )
            })()}

            {isLoadingAnnotation && (
                <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                    Loading annotations…
                </span>
            )}

            <button
                className={`annotation-editor__mode-btn annotation-editor__mode-btn--save${saveStatus === 'error' ? ' annotation-editor__mode-btn--save--error' : saveStatus === 'saved' ? ' annotation-editor__mode-btn--save--saved' : ''}`}
                onClick={saveAnnotation}
                disabled={saveStatus === 'saving' || !canSave}
                title="Save annotations to DSA"
            >
                {saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                      ? 'Saved ✓'
                      : saveStatus === 'error'
                        ? 'Save failed'
                        : 'Save'}
            </button>
        </div>
    )
}
