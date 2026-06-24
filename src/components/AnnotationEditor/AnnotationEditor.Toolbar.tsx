import type { AnnotationType, EditorMode, WorkflowMode } from './AnnotationEditor.types'
import { formatTypeHotkeyHint, formatRoiDropdownLabel } from './AnnotationEditor.utils'

export interface ToolbarProps {
    // ROI selector
    rois: { label: string; roiIndex: number }[]
    /** Label/detection count when not using ROI workflow (e.g. YOLO review). */
    detectionCount: number
    selectedRoiIndex: number
    setSelectedRoiIndex: (i: number) => void
    markComplete: boolean
    setMarkComplete: (v: boolean) => void
    roiFillVisible: boolean
    setRoiFillVisible: (v: boolean) => void
    workflowMode: WorkflowMode
    setWorkflowMode: (m: WorkflowMode) => void

    // Add-labels mode
    isEditingLabel: boolean
    finishEditingLabel: () => void
    cancelEditingLabel: () => void
    deleteActiveLabel: () => void
    canDeleteActiveLabel: boolean
    labelFixedSizeEnabled: boolean
    setLabelFixedSizeEnabled: (v: boolean) => void
    addLabelsDrawingEnabled: boolean
    setAddLabelsDrawingEnabled: (v: boolean) => void
    drawToggleHotkey: string
    finishShapeEditHotkey: string
    editLabelShapeHotkey: string
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

    // Show info toggle (control hidden unless showInfoControl is true)
    showInfoControl: boolean
    showInfo: boolean
    setShowInfo: (v: boolean) => void

    // Confidence filter mode
    confidenceThreshold: number
    setConfidenceThreshold: (v: number) => void
    filterVisibleCount: number
    filterTotalCount: number

    // ROI progress
    roiCompletedCount: number
    roiTotal: number

    // Save / loading
    isLoadingAnnotation: boolean
    saveStatus: 'idle' | 'saving' | 'saved' | 'error'
    saveDirty?: boolean
    autoSaveEnabled?: boolean
    saveAnnotation: () => void
    canSave: boolean
    /** Default: "Save" */
    saveIdleLabel?: string
    /** Default: "Saving…" (GeoJSON: use "Exporting…") */
    saveSavingLabel?: string
    /** Tooltip on the save button. Default: "Save annotations to DSA" */
    saveButtonTitle?: string
}

export function AnnotationEditorToolbar({
    rois, selectedRoiIndex, setSelectedRoiIndex,
    detectionCount,
    markComplete, setMarkComplete,
    roiFillVisible, setRoiFillVisible,
    workflowMode, setWorkflowMode,
    isEditingLabel, finishEditingLabel, cancelEditingLabel,
    deleteActiveLabel, canDeleteActiveLabel,
    labelFixedSizeEnabled, setLabelFixedSizeEnabled,
    addLabelsDrawingEnabled, setAddLabelsDrawingEnabled, drawToggleHotkey,
    finishShapeEditHotkey, editLabelShapeHotkey,
    annotationTypes, selectedTypeIndex, setSelectedTypeIndex,
    activeMode, setActiveMode,
    fixedSizeEnabled, setFixedSizeEnabled,
    fixedWidth, setFixedWidth,
    fixedHeight, setFixedHeight,
    finishEditingRoi, cancelPendingRoi, startEditActiveRoi, deleteActiveRoi,
    reviewItemIndex, reviewItemCount, reviewNextItem, reviewPreviousItem,
    reviewSelectedTypeIndex, onReviewTypeChange, startReviewEditShape,
    showInfoControl,
    showInfo, setShowInfo,
    confidenceThreshold, setConfidenceThreshold, filterVisibleCount, filterTotalCount,
    roiCompletedCount, roiTotal,
    isLoadingAnnotation, saveStatus, saveDirty = false, autoSaveEnabled = false, saveAnnotation, canSave,
    saveIdleLabel = 'Save',
    saveSavingLabel = 'Saving…',
    saveButtonTitle = 'Save annotations to DSA',
}: ToolbarProps) {
    const roiLabels = rois.map(r => r.label)
    const canCycleRois = rois.length > 0

    const selectPreviousRoi = () => {
        if (!canCycleRois) return
        setSelectedRoiIndex(
            selectedRoiIndex <= 0 ? rois.length - 1 : selectedRoiIndex - 1,
        )
    }

    const selectNextRoi = () => {
        if (!canCycleRois) return
        setSelectedRoiIndex(
            selectedRoiIndex < 0 || selectedRoiIndex >= rois.length - 1
                ? 0
                : selectedRoiIndex + 1,
        )
    }

    return (
        <div className="annotation-editor__toolbar">
            {/* ROI selector */}
            <div className="annotation-editor__toolbar-group">
                <span className="annotation-editor__roi-label">ROI:</span>
                <div className="annotation-editor__roi-nav">
                    <button
                        type="button"
                        className="annotation-editor__mode-btn annotation-editor__roi-nav-btn"
                        onClick={selectPreviousRoi}
                        disabled={!canCycleRois}
                        title="Previous ROI"
                        aria-label="Previous ROI"
                    >
                        &#8249;
                    </button>
                    <select
                        className="annotation-editor__roi-select"
                        value={selectedRoiIndex}
                        onChange={e => setSelectedRoiIndex(Number(e.target.value))}
                        disabled={rois.length === 0}
                    >
                        {rois.length === 0 ? (
                            <option value={-1}>
                                {detectionCount > 0
                                    ? `${detectionCount} detection${detectionCount === 1 ? '' : 's'} (no ROIs)`
                                    : '— no ROIs loaded —'}
                            </option>
                        ) : (
                            <>
                                <option value={-1}>Unselect ROI</option>
                                {rois.map((roi, i) => (
                                    <option key={i} value={i}>
                                        {formatRoiDropdownLabel(roi.label, i, roiLabels)}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                    <button
                        type="button"
                        className="annotation-editor__mode-btn annotation-editor__roi-nav-btn"
                        onClick={selectNextRoi}
                        disabled={!canCycleRois}
                        title="Next ROI"
                        aria-label="Next ROI"
                    >
                        &#8250;
                    </button>
                </div>

                <label className="annotation-editor__checkbox-label">
                    <input
                        type="checkbox"
                        checked={markComplete}
                        onChange={e => setMarkComplete(e.target.checked)}
                        disabled={selectedRoiIndex < 0}
                    />
                    Mark Complete
                </label>

                <label className="annotation-editor__checkbox-label">
                    <input
                        type="checkbox"
                        checked={roiFillVisible}
                        onChange={e => setRoiFillVisible(e.target.checked)}
                        disabled={workflowMode !== 'edit-rois'}
                        title={
                            workflowMode === 'edit-rois'
                                ? 'Show semi-transparent fill inside ROI rectangles'
                                : 'ROI fill is hidden while adding or reviewing labels'
                        }
                    />
                    ROI fill
                </label>

                <select
                    className="annotation-editor__roi-select"
                    value={workflowMode}
                    onChange={e => { setWorkflowMode(e.target.value as WorkflowMode); e.target.blur() }}
                >
                    <option value="edit-rois">Edit ROIs</option>
                    <option value="add-labels">Add Labels</option>
                    <option value="review">Review</option>
                    <option value="filter">Filter</option>
                </select>
            </div>

            <div className="annotation-editor__toolbar-divider" />

            {/* Add Labels / Review: shape-edit buttons (while editing an existing label shape) */}
            {(workflowMode === 'add-labels' || workflowMode === 'review') && isEditingLabel && (
                <div className="annotation-editor__mode-group">
                    <button
                        className="annotation-editor__mode-btn annotation-editor__mode-btn--finish"
                        onClick={finishEditingLabel}
                        title={`Commit the reshaped label box (${finishShapeEditHotkey} or Enter)`}
                    >
                        Done editing
                    </button>
                    <button
                        className="annotation-editor__mode-btn annotation-editor__mode-btn--danger annotation-editor__mode-btn--cancel"
                        onClick={cancelEditingLabel}
                        title="Discard shape changes (Escape)"
                    >
                        Cancel
                    </button>
                    <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>
                        {finishShapeEditHotkey} / Enter finish · Esc cancel
                    </span>
                    {workflowMode === 'add-labels' && (
                        <button
                            className="annotation-editor__mode-btn annotation-editor__mode-btn--danger"
                            onClick={deleteActiveLabel}
                            title="Delete this label (Delete / Backspace)"
                        >
                            Delete label
                        </button>
                    )}
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
                        title={`Change the type of the focused label box (${formatTypeHotkeyHint(annotationTypes)})`}
                    >
                        {annotationTypes.map((t, i) => (
                            <option key={i} value={i}>{t.name}</option>
                        ))}
                    </select>
                    <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>{formatTypeHotkeyHint(annotationTypes)}</span>
                    <button
                        className="annotation-editor__mode-btn"
                        onClick={startReviewEditShape}
                        disabled={reviewItemIndex < 0}
                        title={`Edit the shape of the focused label box (${editLabelShapeHotkey})`}
                    >
                        Edit Shape
                    </button>
                </div>
            )}

            {/* Add Labels: type selector */}
            {workflowMode === 'add-labels' && !isEditingLabel && annotationTypes.length > 0 && (
                <div className="annotation-editor__mode-group">
                    <button
                        type="button"
                        className={`annotation-editor__mode-btn${addLabelsDrawingEnabled ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setAddLabelsDrawingEnabled(true)}
                        title={`Draw label boxes (${drawToggleHotkey} toggles draw/pan)`}
                    >
                        Draw
                    </button>
                    <button
                        type="button"
                        className={`annotation-editor__mode-btn${!addLabelsDrawingEnabled ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setAddLabelsDrawingEnabled(false)}
                        title={`Pan and zoom the slide (${drawToggleHotkey} toggles draw/pan)`}
                    >
                        Pan
                    </button>
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
                    <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>
                        {addLabelsDrawingEnabled
                            ? `${formatTypeHotkeyHint(annotationTypes, 'add-labels')} · ${drawToggleHotkey} draw off · ${editLabelShapeHotkey} edit`
                            : `${drawToggleHotkey} draw · WASD/arrows pan · ${editLabelShapeHotkey} edit`}
                    </span>
                    <button
                        className="annotation-editor__mode-btn annotation-editor__mode-btn--danger"
                        onClick={deleteActiveLabel}
                        disabled={!canDeleteActiveLabel}
                        title="Delete the hovered label (Delete / Backspace). Hover a box or right-click for more actions."
                    >
                        Delete label
                    </button>
                </div>
            )}

            {/* Filter mode: confidence threshold slider */}
            {workflowMode === 'filter' && (
                <div className="annotation-editor__mode-group annotation-editor__filter-group">
                    <span className="annotation-editor__roi-label">Confidence ≥</span>
                    <input
                        className="annotation-editor__confidence-slider"
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={confidenceThreshold}
                        onChange={e => setConfidenceThreshold(Number(e.target.value))}
                        title="Hide boxes with confidence below this threshold"
                    />
                    <span className="annotation-editor__confidence-value">
                        {Math.round(confidenceThreshold * 100)}%
                    </span>
                    <div className="annotation-editor__filter-count">
                        Showing
                        <span className="annotation-editor__filter-count__num">
                            {filterVisibleCount}&thinsp;/&thinsp;{filterTotalCount}
                        </span>
                    </div>
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
                                title={`Accept the drawn ROI (${finishShapeEditHotkey} or Enter)`}
                            >
                                Finish editing
                            </button>
                            <button
                                className="annotation-editor__mode-btn annotation-editor__mode-btn--danger annotation-editor__mode-btn--cancel"
                                onClick={cancelPendingRoi}
                                title="Discard the drawn ROI (Escape)"
                            >
                                Cancel
                            </button>
                            <span className="annotation-editor__roi-label" style={{ opacity: 0.55 }}>
                                {finishShapeEditHotkey} / Enter finish · Esc cancel
                            </span>
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

            <div className="annotation-editor__toolbar-right">
                {showInfoControl && (
                    <button
                        className={`annotation-editor__mode-btn${showInfo ? ' annotation-editor__mode-btn--active' : ''}`}
                        onClick={() => setShowInfo(!showInfo)}
                        title="Hover over elements to see their info"
                    >
                        Show Info
                    </button>
                )}

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
                    className={`annotation-editor__mode-btn annotation-editor__mode-btn--save${saveStatus === 'error' ? ' annotation-editor__mode-btn--save--error' : saveStatus === 'saved' ? ' annotation-editor__mode-btn--save--saved' : ''}${autoSaveEnabled && saveDirty && saveStatus === 'idle' ? ' annotation-editor__mode-btn--save--dirty' : ''}`}
                    onClick={saveAnnotation}
                    disabled={
                        saveStatus === 'saving'
                        || !canSave
                        || (autoSaveEnabled && !saveDirty && saveStatus !== 'error')
                    }
                    title={saveButtonTitle}
                >
                    {saveStatus === 'saving'
                        ? saveSavingLabel
                        : saveStatus === 'saved'
                          ? 'Saved ✓'
                          : saveStatus === 'error'
                            ? 'Save failed'
                            : saveIdleLabel}
                </button>
            </div>
        </div>
    )
}
