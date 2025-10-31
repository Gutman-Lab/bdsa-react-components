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
import { Button, Card } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function App() {
  return (
    <Card header="Welcome">
      <p>Digital Slide Archive</p>
      <Button variant="primary">Get Started</Button>
    </Card>
  )
}
```

### Individual Component Import

```tsx
import { Button } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function MyComponent() {
  return (
    <Button 
      variant="primary" 
      size="large"
      onClick={() => console.log('Clicked!')}
    >
      Click Me
    </Button>
  )
}
```

## Available Components

### Button

A versatile button component with multiple variants and states.

```tsx
<Button variant="primary" size="medium" loading={false}>
  Click Me
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'success'
- `size`: 'small' | 'medium' | 'large'
- `loading`: boolean
- `fullWidth`: boolean
- Plus all standard HTML button attributes

### Card

A flexible card component for displaying content in a contained format.

```tsx
<Card 
  header="Card Title"
  footer="Footer text"
  shadow="medium"
  hoverable
>
  Card content goes here
</Card>
```

**Props:**
- `header`: ReactNode
- `footer`: ReactNode
- `shadow`: 'none' | 'small' | 'medium' | 'large'
- `bordered`: boolean
- `hoverable`: boolean
- `padding`: 'none' | 'small' | 'medium' | 'large'
- Plus all standard HTML div attributes

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
- Bundled CSS (`style.css`)

## Project Structure

```
bdsaReactComponents/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx        # Component implementation
│   │   │   ├── Button.css        # Component styles
│   │   │   ├── Button.test.tsx   # Unit tests
│   │   │   └── Button.stories.tsx # Storybook stories
│   │   └── Card/
│   │       ├── Card.tsx
│   │       ├── Card.css
│   │       ├── Card.test.tsx
│   │       └── Card.stories.tsx
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

To publish this library to npm:

1. Update version in `package.json`
2. Build the library: `npm run build`
3. Publish: `npm publish`

## License

Apache-2.0

## Support

For issues, questions, or contributions, please refer to the Digital Slide Archive project documentation.

