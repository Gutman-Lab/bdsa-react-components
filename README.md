# BDSA React Components

A reusable React component library for the Digital Slide Archive project. This library provides a collection of well-tested, accessible, and customizable components that can be used across multiple BDSA React applications.

## Features

- 🎨 **Modern UI Components** - Beautiful, accessible components built with React
- 📦 **Tree-shakeable** - Import only what you need
- 🔧 **TypeScript Support** - Full type definitions included
- ✅ **Well-tested** - Comprehensive test coverage with Vitest
- 📚 **Storybook Documentation** - Interactive component demos and documentation
- 🎯 **Flexible** - Customizable through props and CSS

## Installation

### In Your Project

Once published, you can install this library using npm or yarn:

```bash
npm install bdsa-react-components
# or
yarn add bdsa-react-components
```

### For Development

Clone this repository and install dependencies:

```bash
git clone <repository-url>
cd bdsaReactComponents
npm install
```

## Usage

### Basic Import

```tsx
import { FolderBrowser } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function App() {
  return (
    <div style={{ height: 480 }}>
      <FolderBrowser apiBaseUrl="https://your-dsa-host/api/v1" />
    </div>
  )
}
```

### Individual Component Import

The package also exposes one entry point per component, plus `auth`, `cache`,
and `utils`. Use these when you only need part of the library: importing from
the root barrel pulls in every component (including the slide/volume viewers),
while a subpath import pulls only that component and its dependencies.

```tsx
import { DsaAuthManager } from 'bdsa-react-components/components/DsaAuthManager'
import { FolderBrowser } from 'bdsa-react-components/components/FolderBrowser'
import { ZStackVolumeViewer } from 'bdsa-react-components/components/ZStackVolumeViewer'
import { ChannelHistograms, fetchImageHistogram } from 'bdsa-react-components/components/ChannelHistograms'
import { dsaAuthStore, useDsaAuth } from 'bdsa-react-components/auth'
import { hasLargeImage } from 'bdsa-react-components/utils'
```

The full subpath list is the `components/*`, `auth`, `cache`, and `utils` keys
in `package.json#exports`. The root import remains supported for compatibility.

### Styles

ESM chunks import the CSS they need automatically. If your setup does not
process CSS imports (for example CommonJS or server-side rendering), import the
aggregate stylesheet once:

```tsx
import 'bdsa-react-components/styles.css'
```

### Bundle size

The root barrel is a single compatibility entry point; bundlers cannot drop the
unused viewers because the library ships one chunk per component but the root
entry re-exports all of them. For example, importing `ChannelHistograms` from
the root adds roughly 2 MB to an unminified consumer bundle, while importing it
from `bdsa-react-components/components/ChannelHistograms` adds about 3 KB
(both measured with `esbuild`, with React/OpenSeadragon/Paper/VTK external).
Prefer subpath imports in new code.

## Available Components

These are the components exported from the package root:

| Component | Purpose |
| --- | --- |
| `DsaAuthManager` | Login/logout UI and DSA auth status; `dsaAuthStore`/`useDsaAuth` expose the session to other components. |
| `FolderBrowser` | Collection/folder/item tree with deep links, persistence, and render props. |
| `OSDThumbnailBrowser` | OpenSeadragon thumbnail grid for folders (`FolderThumbnailBrowser` is a deprecated alias). |
| `ThumbnailGrid` | Simpler image thumbnail grid with pagination and sizing. |
| `ThumbnailViewer` | Large thumbnail preview with adjustable annotation opacity. |
| `ManifestBrowser` | Browse images listed by a IIIF manifest. |
| `SlideViewer` | OpenSeadragon slide viewer with Paper.js annotation overlays. |
| `AnnotationEditor` / `SingleBoxSlideEditor` | Protocol-driven annotation editing on top of `SlideViewer`. |
| `AnnotationBrowser` | Annotation list/visibility panel for a slide. |
| `ZStackVolumeViewer` | vtk.js multichannel z-stack volume viewer; an optional `annotationOverlay` draws per-slice polygons (for example nuclei segmentation) in 3D. |
| `ChannelHistograms` | Per-channel histogram chart, plus `fetchImageHistogram` helpers. |
| `ProtocolManager` (`ProtocolsTab`) | Stain/region/block protocol editor with BDSA schema validation. |

Earlier releases also shipped `Card`, `Button`, and `AnnotationManager`; they are no
longer exported. `Card` and `AnnotationManager` only remain in `old-src/` for
historical reference, and `Button` was removed in 0.3.0. Use your application's
design system for generic UI controls.

### Peer dependencies

`react` and `react-dom` are required. Components that render slides or volumes
also expect `openseadragon` (`^5`), `paper` (`^0.12`), and/or `@kitware/vtk.js`
(`^38`); install the ones your app uses. Import the stylesheet once:

```tsx
import 'bdsa-react-components/styles.css'
```

### SlideViewer

A powerful slide viewer component that integrates OpenSeadragon with Paper.js annotations for viewing Digital Slide Archive images with annotation overlays.

```tsx
import { SlideViewer } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function SlideApp() {
  const imageInfo = {
    imageId: 'slide-123',
    width: 40000,
    height: 30000,
    tileWidth: 256,
    levels: 8,
    baseUrl: 'http://localhost:5000', // Your DSA base URL
  }

  const annotations = [
    {
      id: 'annotation-1',
      left: 5000,
      top: 6000,
      width: 2000,
      height: 1500,
      color: '#ff0000',
      label: 'Region of Interest',
    },
  ]

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <SlideViewer 
        imageInfo={imageInfo}
        annotations={annotations}
        onAnnotationClick={(annotation) => {
          console.log('Clicked:', annotation)
        }}
      />
    </div>
  )
}
```

**Props:**
- `imageInfo`: Object containing image metadata (imageId, width, height, tileWidth, levels, baseUrl)
- `annotations`: Array of annotation objects or GeoJSON FeatureCollection
- `onViewerReady`: Callback when OpenSeadragon viewer is ready
- `onAnnotationClick`: Callback when an annotation is clicked
- `defaultAnnotationColor`: Default stroke color for annotations (default: '#ff0000')
- `strokeWidth`: Stroke width for annotations (default: 2)
- `osdOptions`: Additional OpenSeadragon configuration options
- `className`: Custom CSS class name

**Annotation Format:**

You can provide annotations in two formats:

1. **Array of annotation objects:**
```tsx
[
  {
    id: 'ann-1',
    left: 100,
    top: 200,
    width: 150,
    height: 100,
    color: '#ff0000',
    label: 'My annotation',
  }
]
```

2. **GeoJSON FeatureCollection:**
```tsx
{
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'geo-ann-1',
      properties: {
        color: '#00ff00',
        label: 'GeoJSON annotation',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [100, 200],
            [250, 200],
            [250, 300],
            [100, 300],
            [100, 200],
          ],
        ],
      },
    },
  ],
}
```

## Development

Internal backlog (e.g. FolderBrowser pagination and parity with the pre-refactor library) lives in [docs/TO_DO.md](docs/TO_DO.md).

### Running Storybook

View and interact with all components:

```bash
npm run storybook
```

This will open Storybook at `http://localhost:6006` where you can see all components, their variants, and interactive documentation.

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Building the Library

```bash
npm run build
```

This creates optimized production builds in the `dist` folder with:
- ESM format (`index.js`)
- CommonJS format (`index.cjs`)
- TypeScript definitions (`index.d.ts`)
- Bundled CSS (`index.css`, published as the `bdsa-react-components/styles.css` export)

## Project Structure

```
bdsaReactComponents/
├── src/
│   ├── components/
│   │   ├── AnnotationBrowser/
│   │   ├── AnnotationEditor/
│   │   ├── DsaAuthManager/
│   │   ├── FolderBrowser/
│   │   ├── ManifestBrowser/
│   │   └── SlideViewer/
│   ├── test/
│   │   └── setup.ts              # Test setup and configuration
│   └── index.ts                  # Main export file
├── .storybook/                   # Storybook configuration
├── dist/                         # Build output (generated)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Adding New Components

Follow this pattern when creating new components:

1. **Create component folder**: `src/components/YourComponent/`
2. **Create component file**: `YourComponent.tsx` with TypeScript types
3. **Create styles**: `YourComponent.css`
4. **Create tests**: `YourComponent.test.tsx`
5. **Create stories**: `YourComponent.stories.tsx`
6. **Export component**: Add to `src/index.ts`

### Example Component Template

```tsx
// YourComponent.tsx
import React from 'react'
import './YourComponent.css'

export interface YourComponentProps {
  /** Component props */
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

export const YourComponent = React.forwardRef<HTMLDivElement, YourComponentProps>(
  ({ variant = 'primary', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`bdsa-your-component bdsa-your-component--${variant}`} {...props}>
        {children}
      </div>
    )
  }
)

YourComponent.displayName = 'YourComponent'
```

## Design Principles

- **Consistency**: All components follow similar naming and prop conventions
- **Accessibility**: Components are built with a11y best practices
- **Flexibility**: Components accept standard HTML attributes
- **Ref Forwarding**: All components support ref forwarding
- **TypeScript**: Full type safety with exported type definitions
- **Testing**: Every component has comprehensive test coverage
- **Documentation**: Storybook stories demonstrate all use cases

## Contributing

When contributing to this library:

1. Follow the existing component structure
2. Write tests for all new components
3. Create Storybook stories for documentation
4. Use TypeScript for type safety
5. Follow naming conventions (prefix classes with `bdsa-`)
6. Keep components focused and composable

## CSS Naming Convention

Use the BEM-like naming convention with the `bdsa-` prefix:

- Block: `.bdsa-component`
- Element: `.bdsa-component__element`
- Modifier: `.bdsa-component--modifier`

Example:
```css
.bdsa-button { /* base styles */ }
.bdsa-button--primary { /* variant */ }
.bdsa-button__spinner { /* element */ }
```

## Publishing

Releases are published from CI with [npm trusted publishing](https://docs.npmjs.com/trusted-publishers)
(OIDC). No npm token is stored in the repository or in GitHub secrets.

1. Update `version` in `package.json` and `CHANGELOG.md`, merge to `main`.
2. Tag the release commit and push the tag:

   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```

3. `.github/workflows/publish.yml` runs `npm ci`, `npm test`, verifies the tag
   matches `package.json`, and runs `npm publish` (which rebuilds `dist/` via
   `prepublishOnly`). Provenance is generated automatically.

The npm trusted publisher for this repository must list workflow filename
`publish.yml` and allow **npm publish**. Maintainers can still publish by hand
with `npm publish` if CI is unavailable.

## License

Apache-2.0

## Support

For issues, questions, or contributions, please refer to the Digital Slide Archive project documentation.

