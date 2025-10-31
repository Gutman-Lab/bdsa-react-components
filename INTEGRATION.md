# Integration Guide for bdsa-react-components

## Local Development Setup (Using npm link)

### Step 1: Link the library in this repository

From the `bdsaReactComponents` directory:

```bash
npm link
```

This creates a global symlink to your library.

### Step 2: Use it in your other React application

In your other React application directory:

```bash
npm link bdsa-react-components
```

This creates a symlink from your app's `node_modules` to the library.

### Step 3: Install peer dependencies in your app

Your app needs React 18+:

```bash
npm install react@^18.0.0 react-dom@^18.0.0
```

### Step 4: Use the components

```tsx
import { SlideViewer, Button, Card } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function App() {
  return (
    <div style={{ width: '100%', height: '600px' }}>
      <SlideViewer
        imageInfo={{
          dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/YOUR_IMAGE_ID/tiles/dzi.dzi'
        }}
        annotations={[]}
      />
    </div>
  )
}
```

## Alternative: Using GitHub Repository

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bdsa-react-components.git
git push -u origin main
```

### Step 2: Install from GitHub in your app

```bash
npm install git+https://github.com/YOUR_USERNAME/bdsa-react-components.git
```

Or if you want to point to a specific branch:

```bash
npm install git+https://github.com/YOUR_USERNAME/bdsa-react-components.git#main
```

## VSCode IntelliSense Setup

The library includes full TypeScript definitions, so VSCode should automatically provide:
- Autocomplete for component props
- Type checking
- Inline documentation
- Go to definition

If IntelliSense isn't working:

1. **Make sure TypeScript is installed** in your project:
   ```bash
   npm install --save-dev typescript @types/react @types/react-dom
   ```

2. **Restart VSCode** or reload the window (Cmd+Shift+P → "Reload Window")

3. **Check VSCode TypeScript version**: 
   - Open a `.tsx` file
   - Click the TypeScript version in the bottom right
   - Select "Use Workspace Version"

## Component Usage Examples

### SlideViewer

```tsx
import { SlideViewer } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

function MySlideView() {
  const imageInfo = {
    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/6903df8dd26a6d93de19a9b2/tiles/dzi.dzi'
  }

  const annotations = [
    {
      id: 'ann-1',
      left: 5000,
      top: 6000,
      width: 2000,
      height: 1500,
      color: '#ff0000',
      label: 'Region of Interest'
    }
  ]

  return (
    <SlideViewer
      imageInfo={imageInfo}
      annotations={annotations}
      height="800px"
      onAnnotationClick={(annotation) => {
        console.log('Clicked:', annotation)
      }}
    />
  )
}
```

### Button

```tsx
import { Button } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

<Button variant="primary" size="large" onClick={() => alert('Clicked!')}>
  Click Me
</Button>
```

### Card

```tsx
import { Card } from 'bdsa-react-components'
import 'bdsa-react-components/styles.css'

<Card header="Title" footer="Footer" shadow="medium" hoverable>
  Content here
</Card>
```

## Troubleshooting

### "Module not found" error

Make sure you've:
1. Run `npm link` in the library directory
2. Run `npm link bdsa-react-components` in your app directory
3. Installed peer dependencies (`react`, `react-dom`)

### Styles not loading

Don't forget to import the CSS:
```tsx
import 'bdsa-react-components/styles.css'
```

### OpenSeadragon not working

Make sure the SlideViewer has an explicit height:
```tsx
<SlideViewer height="600px" ... />
```

## Hot Reloading with npm link

If you make changes to the library:
1. Rebuild: `npm run build` in the library directory
2. Your app should automatically pick up changes (if using Vite/CRA with watch mode)

For faster development, you can run `npm run build -- --watch` in one terminal while developing.

