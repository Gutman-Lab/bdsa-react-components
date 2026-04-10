import type { AnnotationType } from './AnnotationEditor.types'

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
}

export function AnnotationEditorOverlays({
    contextMenu, annotationTypes,
    handleContextMenuChangeType, handleContextMenuEditShape, handleContextMenuDelete,
    notification,
    showDuplicateWarning, setShowDuplicateWarning, annotationDocumentName,
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
