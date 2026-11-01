import { addons } from 'storybook/manager-api'

/**
 * AnnotationEditor / OpenSeadragon stories use letter keys (Q/W, D/F/G/H, M/N, arrows).
 * Storybook defaults overlap (e.g. Alt+S sidebar, Alt+D panel, 1/2/3 focus panes).
 * Disable manager shortcuts so keyboard input stays on the slide canvas.
 *
 * Re-enable temporarily via URL: ?shortcuts=true
 */
addons.setConfig({
    enableShortcuts: false,
})
