## Concretely the changes needed:

* Add 'add-polygons' to WorkflowMode in AnnotationEditor.types.ts
* Register the polygon tool in AnnotationEditor's tool setup (addTools)
* Add a useEffect for add-polygons mode that activates the polygon tool and captures item-created — creating LocalPolylineElement entries (same label.value = ROI label pattern)
* Update the toolbar to show the new mode button

The polygon mode would NOT show review/filter since those are box-specific. The toolbar can conditionally show those modes based on whether there are box annotation types in the config — or simply always show all modes and let the user ignore irrelevant ones. Your call.