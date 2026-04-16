import type { AnnotationType, LocalAnnotationElement } from './AnnotationEditor.types'

export interface OverlaysProps {
    // Right-click context menu
    contextMenu: { x: number; y: number; itemIdx: number; item: any } | null
    annotationTypes: AnnotationType[]
    handleContextMenuChangeType: (typeIndex: number) => void
    handleContextMenuEditShape: () => void
    handleContextMenuDelete: () => void

    // Save notification toast
    notification: { type: 'success' | 'error'; message: string } | null

    // Duplicate-document warning modal
    showDuplicateWarning: boolean
    setShowDuplicateWarning: (v: boolean) => void
    annotationDocumentName: string

    // Show-info hover tooltip
    hoverInfo: { x: number; y: number; element: LocalAnnotationElement; roiElement?: LocalAnnotationElement } | null
}

export function AnnotationEditorOverlays({
    contextMenu, annotationTypes,
    handleContextMenuChangeType, handleContextMenuEditShape, handleContextMenuDelete,
    notification,
    showDuplicateWarning, setShowDuplicateWarning, annotationDocumentName,
    hoverInfo,
}: OverlaysProps) {
    return (
        <>
            {/* Label right-click context menu */}
            {contextMenu && (
                <div
                    className="annotation-editor__context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    {annotationTypes.map((t, i) => (
                        <button
                            key={i}
                            className="annotation-editor__context-menu__item"
                            onClick={() => handleContextMenuChangeType(i)}
                        >
                            <span className="annotation-editor__context-menu__arrow">&#x2192;</span>
                            {t.name}
                        </button>
                    ))}
                    <div className="annotation-editor__context-menu__divider" />
                    <button
                        className="annotation-editor__context-menu__item"
                        onClick={handleContextMenuEditShape}
                    >
                        &#9998; Edit Shape
                    </button>
                    <button
                        className="annotation-editor__context-menu__item annotation-editor__context-menu__item--danger"
                        onClick={handleContextMenuDelete}
                    >
                        &#128465; Delete
                    </button>
                </div>
            )}

            {/* Save notification toast */}
            {notification && (
                <div className={`annotation-editor__toast annotation-editor__toast--${notification.type}`}>
                    {notification.message}
                </div>
            )}

            {/* Show-info hover tooltip */}
            {hoverInfo && (() => {
                const { x, y, element: el, roiElement } = hoverInfo
                const renderBlock = (e: LocalAnnotationElement, dim?: boolean) => {
                    const area = e.width * e.height
                    const userEntries = e.user ? Object.entries(e.user) : []
                    return (
                        <div style={dim ? { opacity: 0.65 } : undefined}>
                            <div className="annotation-editor__info-tooltip__type">{e.group}</div>
                            <table className="annotation-editor__info-tooltip__table">
                                <tbody>
                                    <tr><td>label</td><td>{e.label.value}</td></tr>
                                    <tr><td>center</td><td>({e.center[0].toLocaleString()}, {e.center[1].toLocaleString()})</td></tr>
                                    <tr><td>width</td><td>{e.width.toLocaleString()} px</td></tr>
                                    <tr><td>height</td><td>{e.height.toLocaleString()} px</td></tr>
                                    <tr><td>area</td><td>{area.toLocaleString()} px²</td></tr>
                                    {userEntries.map(([k, v]) => (
                                        <tr key={k}><td>{k}</td><td>{String(v)}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                }
                return (
                    <div
                        className="annotation-editor__info-tooltip"
                        style={{ left: x + 16, top: y + 16 }}
                    >
                        {renderBlock(el)}
                        {roiElement && (
                            <>
                                <div className="annotation-editor__info-tooltip__divider" />
                                {renderBlock(roiElement, true)}
                            </>
                        )}
                    </div>
                )
            })()}

            {/* Duplicate document warning modal */}
            {showDuplicateWarning && (
                <div className="annotation-editor__modal-backdrop">
                    <div className="annotation-editor__modal" role="dialog" aria-modal="true">
                        <div className="annotation-editor__modal-title">
                            <span className="annotation-editor__modal-icon">⚠️</span>
                            Multiple annotation documents found
                        </div>
                        <div className="annotation-editor__modal-body">
                            More than one annotation document named{' '}
                            <strong>"{annotationDocumentName}"</strong> was found on the server.
                            <br />
                            <br />
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
        </>
    )
}
