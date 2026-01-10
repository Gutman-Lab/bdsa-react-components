import { default as React } from 'react';
import { AnnotationSearchResult, AnnotationManagerProps, AnnotationManagerHandle, AnnotationManagerContext } from './AnnotationManager.types';

export type { AnnotationSearchResult, AnnotationManagerProps, AnnotationManagerHandle, AnnotationManagerContext };
/**
 * AnnotationManager component for managing annotation loading, visibility, and state.
 * This component handles the business logic for annotations while keeping SlideViewer
 * focused on rendering.
 *
 * Supports fetching annotations by itemId using the DSA API search endpoint.
 *
 * Note: By default, the API may only return public annotations. To access private
 * annotations, provide authentication via `fetchFn` or `apiHeaders` props.
 */
export declare const AnnotationManager: React.ForwardRefExoticComponent<AnnotationManagerProps & React.RefAttributes<AnnotationManagerHandle>>;
//# sourceMappingURL=AnnotationManager.d.ts.map