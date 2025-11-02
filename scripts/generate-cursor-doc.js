#!/usr/bin/env node
/**
 * Script to generate a CURSOR-friendly integration document
 * This document is optimized for AI tools to understand the library API
 * Auto-generates from TypeScript source files
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const srcDir = join(rootDir, 'src', 'components')

// Read package.json for version info
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
const version = packageJson.version

/**
 * Extract JSDoc description for a specific prop
 */
function extractJSDoc(content, propName) {
  // Match /** comment */ followed by propName
  // This handles both single-line and multi-line JSDoc
  const pattern = new RegExp(`/\\*\\*\\s*\\*?\\s*([^/]+?)\\s*\\*/\\s*${propName}\\??:`, 's')
  const match = content.match(pattern)
  
  if (match && match[1]) {
    // Clean up the description - remove asterisks, newlines, extra spaces
    return match[1]
      .replace(/\*\s*/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  
  return ''
}

/**
 * Extract interface/props information from TypeScript file
 */
function extractComponentInfo(componentDir, componentName) {
  const tsxFile = join(componentDir, `${componentName}.tsx`)
  
  if (!statSync(tsxFile).isFile()) {
    return null
  }
  
  const content = readFileSync(tsxFile, 'utf8')
  
  // Find the Props interface first (we'll use this to find description)
  const propsInterfaceMatch = content.match(/(?:export\s+)?interface\s+(\w*Props)\s*extends?\s*([^{]*?)\s*{([^}]+)}/s)
  
  // Extract component description from JSDoc (before the component export, after the interface)
  const componentExportPattern = new RegExp(`export\\s+(?:const|function)\\s+${componentName}`, 'm')
  
  const interfaceEnd = propsInterfaceMatch ? (propsInterfaceMatch.index || 0) + propsInterfaceMatch[0].length : 0
  const exportIndex = content.search(componentExportPattern)
  const searchArea = exportIndex > 0 ? content.substring(interfaceEnd || Math.max(0, exportIndex - 500), exportIndex) : ''
  
  // Find JSDoc block between interface and export (multiline or single line)
  let description = `${componentName} component`
  
  // Try multiline JSDoc
  const multilineMatch = searchArea.match(/\/\*\*\s*\*\s*(.+?)\s*\*\//s)
  if (multilineMatch && multilineMatch[1]) {
    const desc = multilineMatch[1]
      .replace(/\*\s*/g, '')
      .replace(/\n\s*/g, ' ')
      .trim()
    if (desc && desc.length > 10 && !desc.includes(':')) { // Exclude prop descriptions
      description = desc
    }
  } else {
    // Try single-line JSDoc
    const singleLineMatch = searchArea.match(/\/\*\*\s*(.+?)\s*\*\//)
    if (singleLineMatch && singleLineMatch[1]) {
      const desc = singleLineMatch[1].trim()
      if (desc && desc.length > 10 && !desc.includes(':')) {
        description = desc
      }
    }
  }
  
  // Clean up description
  description = description.replace(/\s+/g, ' ').trim()
  
  if (!propsInterfaceMatch) {
    return { name: componentName, description, props: [] }
  }
  
  const propsContent = propsInterfaceMatch[3]
  const props = []
  
  // Parse props more carefully - handle JSDoc before each prop
  // Split by /** to find JSDoc blocks
  const lines = propsContent.split('\n')
  let i = 0
  let currentProp = null
  
  while (i < lines.length) {
    const line = lines[i].trim()
    
    // Look for JSDoc comment
    if (line.startsWith('/**') || line.startsWith('*')) {
      // Collect JSDoc lines
      let jsdoc = ''
      let j = i
      while (j < lines.length && (lines[j].includes('*') || lines[j].includes('/'))) {
        const cleaned = lines[j].replace(/^\s*\/?\*+\/?\s*/, '').trim()
        if (cleaned && !cleaned.startsWith('/') && !cleaned.startsWith('*')) {
          jsdoc += cleaned + ' '
        }
        j++
      }
      
      // Next line should be the prop
      if (j < lines.length) {
        const propLine = lines[j].trim()
        const propMatch = propLine.match(/(\w+)\??\s*:\s*(.+?)(?:\s*=\s*([^\n,;]+))?[,;]?$/)
        if (propMatch) {
          const [, name, typeRaw] = propMatch
          const isOptional = propLine.includes('?')
          
          let type = typeRaw.trim()
            .replace(/\s+/g, ' ')
            .replace(/\n/g, '')
          
          props.push({
            name,
            type: type.length > 60 ? type.substring(0, 57) + '...' : type,
            default: null,
            required: !isOptional,
            description: jsdoc.trim() || `${name} property`
          })
          i = j + 1
          continue
        }
      }
      i = j
      continue
    }
    
    // Look for prop without JSDoc
    const propMatch = line.match(/(\w+)\??\s*:\s*(.+?)(?:\s*=\s*([^\n,;]+))?[,;]?$/)
    if (propMatch) {
      const [, name, typeRaw] = propMatch
      const isOptional = line.includes('?')
      
      let type = typeRaw.trim()
        .replace(/\s+/g, ' ')
        .replace(/\n/g, '')
      
      props.push({
        name,
        type: type.length > 60 ? type.substring(0, 57) + '...' : type,
        default: null,
        required: !isOptional,
        description: `${name} property`
      })
    }
    
    i++
  }
  
  // Also check default values from component implementation
  const defaultMatch = content.match(/\(\s*{([^}]+)}\s*,\s*ref\s*\)/s)
  if (defaultMatch) {
    const defaults = defaultMatch[1]
    props.forEach(prop => {
      const defaultPattern = new RegExp(`${prop.name}\\s*=\\s*([^,\\n}]+)`, 'm')
      const match = defaults.match(defaultPattern)
      if (match) {
        prop.default = match[1].trim()
      }
    })
  }
  
  return {
    name: componentName,
    description,
    props,
    extends: propsInterfaceMatch[2]?.trim() || null
  }
}

/**
 * Get all exported types from index.ts
 */
function getExportedTypes() {
  const indexContent = readFileSync(join(rootDir, 'src', 'index.ts'), 'utf8')
  
  const types = []
  const exportTypeRegex = /export\s+type\s+{([^}]+)}/g
  let match
  
  while ((match = exportTypeRegex.exec(indexContent)) !== null) {
    const typeList = match[1]
    const typeNames = typeList.split(',').map(t => t.trim()).filter(Boolean)
    types.push(...typeNames)
  }
  
  return [...new Set(types)] // Remove duplicates
}

/**
 * Generate the CURSOR-friendly document
 */
function generateCursorDoc() {
  const timestamp = new Date().toISOString()
  
  // Get all component directories
  const components = []
  const componentDirs = readdirSync(srcDir).filter(item => {
    const itemPath = join(srcDir, item)
    return statSync(itemPath).isDirectory()
  })
  
  for (const dir of componentDirs) {
    const componentName = basename(dir)
    const info = extractComponentInfo(join(srcDir, dir), componentName)
    if (info) {
      components.push(info)
    }
  }
  
  // Sort components alphabetically for consistent output
  components.sort((a, b) => a.name.localeCompare(b.name))
  
  const exportedTypes = getExportedTypes()
  
  let doc = `# bdsa-react-components - CURSOR Integration Guide\n\n`
  doc += `**Version:** ${version} | **Generated:** ${timestamp}\n\n`
  doc += `> This document provides everything Cursor needs to integrate and use the bdsa-react-components library.\n`
  doc += `> Copy this entire document into your project's .cursorrules or docs folder.\n`
  doc += `> **Auto-generated from source code** - Updated automatically on build.\n\n`
  
  doc += `## Quick Start\n\n`
  doc += `### Published Package (when available)\n\n`
  doc += `\`\`\`bash\nnpm install bdsa-react-components\n\`\`\`\n\n`
  doc += `### Local Development (npm link)\n\n`
  doc += `If the library is local/unpublished, use npm link:\n\n`
  doc += `**Step 1:** In the library directory (\`bdsaReactComponents\`):\n`
  doc += `\`\`\`bash\nnpm link\n\`\`\`\n\n`
  doc += `**Step 2:** In your project directory:\n`
  doc += `\`\`\`bash\nnpm link bdsa-react-components\n\`\`\`\n\n`
  doc += `**Step 3:** Install peer dependencies in your project (if not already installed):\n`
  doc += `\`\`\`bash\nnpm install react@^18.0.0 react-dom@^18.0.0\n\`\`\`\n\n`
  doc += `**Note:** After making changes to the library, rebuild it:\n`
  doc += `\`\`\`bash\n# In library directory\nnpm run build\n\`\`\`\n\n`
  doc += `### Import\n\n`
  doc += `\`\`\`tsx\nimport { ${components.map(c => c.name).join(', ')} } from 'bdsa-react-components'\nimport 'bdsa-react-components/styles.css'\n\`\`\`\n\n`
  
  doc += `## Components API\n\n`
  
  // Generate component docs
  components.forEach(component => {
    doc += `### ${component.name}\n\n`
    doc += `${component.description}\n\n`
    
    if (component.extends) {
      doc += `**Extends:** \`${component.extends}\`\n\n`
    }
    
    // Props table
    if (component.props.length > 0) {
      doc += `**Props:**\n\n`
      doc += `| Prop | Type | Default | Required | Description |\n`
      doc += `|------|------|---------|----------|-------------|\n`
      
      component.props.forEach(prop => {
        const typeStr = prop.type.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const defaultStr = prop.default !== undefined && prop.default !== null ? `\`${prop.default}\`` : 
                          prop.required ? '-' : '`undefined`'
        const requiredStr = prop.required ? '**Yes**' : 'No'
        doc += `| \`${prop.name}\` | \`${typeStr}\` | ${defaultStr} | ${requiredStr} | ${prop.description} |\n`
      })
      
      doc += `\n`
    }
    
    // Component-specific examples
    if (component.name === 'SlideViewer') {
      doc += `**Example:**\n\n`
      doc += `\`\`\`tsx\n`
      doc += `<SlideViewer\n`
      doc += `  imageInfo={{\n`
      doc += `    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/IMAGE_ID/tiles/dzi.dzi'\n`
      doc += `  }}\n`
      doc += `  annotations={[]}\n`
      doc += `  height="800px"\n`
      doc += `/>\n`
      doc += `\`\`\`\n\n`
      doc += `**API Endpoints:**\n\n`
      doc += `- \`GET /annotation/{id}\` - Fetch annotation document by ID\n\n`
    } else if (component.name === 'AnnotationManager') {
      doc += `**Example:**\n\n`
      doc += `\`\`\`tsx\n`
      doc += `<AnnotationManager\n`
      doc += `  imageId="6903df8dd26a6d93de19a9b2"\n`
      doc += `  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
      doc += `  onAnnotationsLoaded={(anns) => console.log(anns)}\n`
      doc += `/>\n`
      doc += `\`\`\`\n\n`
      doc += `**API Endpoints:**\n\n`
      doc += `- \`GET /annotation?itemId={id}&limit={limit}&offset=0\` - Search annotations by itemId\n\n`
    } else if (component.name === 'FolderBrowser') {
      doc += `**Example:**\n\n`
      doc += `\`\`\`tsx\n`
      doc += `<FolderBrowser\n`
      doc += `  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
      doc += `  onResourceSelect={(resource) => console.log(resource)}\n`
      doc += `/>\n`
      doc += `\`\`\`\n\n`
      doc += `**API Endpoints:**\n\n`
      doc += `- \`GET /collection\` - List collections\n`
      doc += `- \`GET /folder?parentType={type}&parentId={id}\` - List folders\n\n`
    }
  })
  
  doc += `## Type Definitions\n\n`
  doc += `Import types:\n\n`
  doc += `\`\`\`tsx\nimport type {\n`
  exportedTypes.forEach(type => {
    doc += `  ${type},\n`
  })
  doc += `} from 'bdsa-react-components'\n\`\`\`\n\n`
  
  // Add key type definitions for complex types
  doc += `### Key Types\n\n`
  
  // Read SlideViewer to extract SlideImageInfo
  const slideViewerContent = readFileSync(join(rootDir, 'src', 'components', 'SlideViewer', 'SlideViewer.tsx'), 'utf8')
  const imageInfoMatch = slideViewerContent.match(/interface\s+SlideImageInfo\s*{([^}]+)}/s)
  if (imageInfoMatch) {
    doc += `**SlideImageInfo:**\n\`\`\`typescript\n`
    doc += `interface SlideImageInfo {\n`
    const props = imageInfoMatch[1].match(/(\w+)\??\s*:\s*([^\n;]+)/g) || []
    props.forEach(prop => {
      const clean = prop.trim()
      const isOptional = clean.includes('?')
      const [name, ...typeParts] = clean.replace('?', '').split(':')
      doc += `  ${name.trim()}${isOptional ? '?' : ''}: ${typeParts.join(':').trim()}\n`
    })
    doc += `}\n\`\`\`\n\n`
  }
  
  doc += `## Authentication\n\n`
  doc += `Components making API calls (\`SlideViewer\`, \`AnnotationManager\`, \`FolderBrowser\`) support auth via:\n\n`
  doc += `1. **\`fetchFn\` prop:** Custom fetch function \`(url: string, options?: RequestInit) => Promise<Response>\`\n`
  doc += `2. **\`apiHeaders\` prop:** Headers object \`HeadersInit\`\n\n`
  doc += `**Example:**\n\n`
  doc += `\`\`\`tsx\n`
  doc += `const fetchWithAuth = async (url: string, options?: RequestInit) => {\n`
  doc += `  return fetch(url, {\n`
  doc += `    ...options,\n`
  doc += `    headers: {\n`
  doc += `      ...options?.headers,\n`
  doc += `      'Authorization': \`Bearer \${token}\`,\n`
  doc += `    },\n`
  doc += `  })\n`
  doc += `}\n\n`
  doc += `<SlideViewer\n`
  doc += `  imageInfo={{ dziUrl: '...' }}\n`
  doc += `  fetchFn={fetchWithAuth}\n`
  doc += `  // OR: apiHeaders={{ 'Authorization': \`Bearer \${token}\` }}\n`
  doc += `/>\n`
  doc += `\`\`\`\n\n`
  
  doc += `## Common Integration Patterns\n\n`
  
  doc += `### 1. SlideViewer with Manual Annotations\n\n`
  doc += `\`\`\`tsx\n`
  doc += `<SlideViewer\n`
  doc += `  imageInfo={{\n`
  doc += `    dziUrl: 'http://bdsa.pathology.emory.edu:8080/api/v1/item/IMAGE_ID/tiles/dzi.dzi'\n`
  doc += `  }}\n`
  doc += `  annotations={[\n`
  doc += `    { id: 'ann-1', left: 100, top: 200, width: 150, height: 100, color: '#ff0000' }\n`
  doc += `  ]}\n`
  doc += `  height="800px"\n`
  doc += `  onAnnotationClick={(ann) => console.log(ann)}\n`
  doc += `/>\n`
  doc += `\`\`\`\n\n`
  
  doc += `### 2. SlideViewer with API-Fetched Annotations (RECOMMENDED)\n\n`
  doc += `**⭐ RECOMMENDED APPROACH:** Use \`onAnnotationStateChange\` - unified callback with complete state sync:\n\n`
  doc += `\`\`\`tsx\n`
  doc += `// Unified state - single state object for all annotation state\n`
  doc += `const [annotationState, setAnnotationState] = useState({\n`
  doc += `  loadedIds: [] as string[],\n`
  doc += `  opacities: new Map<string, number>(),\n`
  doc += `  visibility: new Map<string, boolean>(),\n`
  doc += `})\n\n`
  doc += `const [annotationHeaders, setAnnotationHeaders] = useState(new Map())\n\n`
  doc += `const imageId = '6903df8dd26a6d93de19a9b2'\n\n`
  doc += `<>\n`
  doc += `  <AnnotationManager\n`
  doc += `    imageId={imageId}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    onAnnotationStateChange={(state) => {\n`
  doc += `      // Single callback fires for all state changes (load, opacity, visibility)\n`
  doc += `      // 70% less boilerplate than individual callbacks!\n`
  doc += `      setAnnotationState({\n`
  doc += `        loadedIds: state.loadedAnnotationIds,\n`
  doc += `        opacities: state.opacities,\n`
  doc += `        visibility: state.visibility,\n`
  doc += `      })\n`
  doc += `    }}\n`
  doc += `    slideViewerOnAnnotationReady={(id) => {\n`
  doc += `      // Shared handler - no render props needed!\n`
  doc += `      console.log('Annotation ready:', id)\n`
  doc += `    }}\n`
  doc += `    onAnnotationHeadersChange={(headers) => {\n`
  doc += `      // Automatic headers sync for cache versioning\n`
  doc += `      setAnnotationHeaders(headers)\n`
  doc += `    }}\n`
  doc += `  />\n`
  doc += `  <SlideViewer\n`
  doc += `    imageInfo={{ dziUrl: \`.../item/\${imageId}/tiles/dzi.dzi\` }}\n`
  doc += `    annotationIds={annotationState.loadedIds}\n`
  doc += `    annotationOpacities={annotationState.opacities}\n`
  doc += `    visibleAnnotations={annotationState.visibility}\n`
  doc += `    annotationHeaders={annotationHeaders}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    onAnnotationReady={(id) => console.log('Annotation ready:', id)}\n`
  doc += `    height="800px"\n`
  doc += `  />\n`
  doc += `</>\n`
  doc += `\`\`\`\n\n`
  doc += `**Alternative approach:** Using individual callbacks - more verbose but still supported:\n\n`
  doc += `\`\`\`tsx\n`
  doc += `const [annotationIds, setAnnotationIds] = useState<string[]>([])\n`
  doc += `const [opacities, setOpacities] = useState(new Map<string, number>())\n`
  doc += `const imageId = '6903df8dd26a6d93de19a9b2'\n\n`
  doc += `<>\n`
  doc += `  <AnnotationManager\n`
  doc += `    imageId={imageId}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    onLoadedAnnotationIdsChange={(ids) => setAnnotationIds(ids)}\n`
  doc += `    onAnnotationOpacityChange={(id, opacity) => {\n`
  doc += `      setOpacities(prev => new Map(prev).set(id, opacity))\n`
  doc += `    }}\n`
  doc += `  />\n`
  doc += `  <SlideViewer\n`
  doc += `    imageInfo={{ dziUrl: \`.../item/\${imageId}/tiles/dzi.dzi\` }}\n`
  doc += `    annotationIds={annotationIds}\n`
  doc += `    annotationOpacities={opacities}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    height="800px"\n`
  doc += `  />\n`
  doc += `</>\n`
  doc += `\`\`\`\n\n`
  doc += `**Legacy approach:** Using \`onAnnotationsLoaded\` - requires manual ID extraction:\n\n`
  doc += `\`\`\`tsx\n`
  doc += `const [annotationIds, setAnnotationIds] = useState<string[]>([])\n`
  doc += `const imageId = '6903df8dd26a6d93de19a9b2'\n\n`
  doc += `<>\n`
  doc += `  <AnnotationManager\n`
  doc += `    imageId={imageId}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    onAnnotationsLoaded={(anns) => setAnnotationIds(anns.map(a => a._id))}\n`
  doc += `  />\n`
  doc += `  <SlideViewer\n`
  doc += `    imageInfo={{ dziUrl: \`.../item/\${imageId}/tiles/dzi.dzi\` }}\n`
  doc += `    annotationIds={annotationIds}\n`
  doc += `    apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `    height="800px"\n`
  doc += `  />\n`
  doc += `</>\n`
  doc += `\`\`\`\n\n`
  doc += `**Additional callbacks available (legacy - prefer \`onAnnotationStateChange\` for new code):**\n\n`
  doc += `- \`onAnnotationLoad(id, data?)\` - Fires when an annotation is loaded\n`
  doc += `- \`onAnnotationHide(id)\` - Fires when an annotation is hidden/unloaded\n`
  doc += `- \`onAnnotationOpacityChange(id, opacity)\` - Fires when opacity changes\n\n`
  
  doc += `### 3. FolderBrowser\n\n`
  doc += `\`\`\`tsx\n`
  doc += `<FolderBrowser\n`
  doc += `  apiBaseUrl="http://bdsa.pathology.emory.edu:8080/api/v1"\n`
  doc += `  showCollections={true}\n`
  doc += `  onResourceSelect={(resource) => console.log(resource)}\n`
  doc += `  foldersPerPage={50}\n`
  doc += `/>\n`
  doc += `\`\`\`\n\n`
  
  doc += `## Important Notes\n\n`
  doc += `- **SlideViewer height:** Must specify explicit \`height\` prop (e.g., \`"600px"\`, \`"100vh"\`) - OpenSeadragon requirement\n`
  doc += `- **DZI URL vs Manual:** Provide either \`dziUrl\` OR all manual fields (\`imageId\`, \`width\`, \`height\`, \`tileWidth\`, \`levels\`, \`baseUrl\`)\n`
  doc += `- **Annotations format:** Accepts \`AnnotationFeature[]\` or GeoJSON \`FeatureCollection\`\n`
  doc += `- **API Base URL:** Format: \`http://bdsa.pathology.emory.edu:8080/api/v1\` (no trailing slash)\n`
  doc += `- **Styles:** Always import \`'bdsa-react-components/styles.css'\`\n`
  doc += `- **Peer deps:** Requires React 18+\n\n`
  
  doc += `## Troubleshooting (npm link)\n\n`
  doc += `**"Module not found" error:**\n`
  doc += `- Ensure \`npm link\` was run in the library directory\n`
  doc += `- Ensure \`npm link bdsa-react-components\` was run in your project\n`
  doc += `- Check that \`node_modules/bdsa-react-components\` is a symlink (not a regular folder)\n`
  doc += `- Try removing and re-linking: \`npm unlink bdsa-react-components && npm link bdsa-react-components\`\n\n`
  doc += `**Styles not loading:**\n`
  doc += `- Ensure you've imported \`'bdsa-react-components/styles.css'\`\n`
  doc += `- Check that the CSS file exists at \`node_modules/bdsa-react-components/dist/style.css\`\n\n`
  doc += `**Changes not appearing:**\n`
  doc += `- Rebuild the library: \`cd /path/to/bdsaReactComponents && npm run build\`\n`
  doc += `- Restart your dev server (Vite/CRA/etc) after rebuilding\n`
  doc += `- For faster iteration, run \`npm run build -- --watch\` in the library directory\n\n`
  doc += `**TypeScript errors:**\n`
  doc += `- Ensure \`dist/index.d.ts\` exists in the library\n`
  doc += `- Restart TypeScript server in your editor (VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server")\n\n`
  
  doc += `## Annotation Caching\n\n`
  doc += `The library includes automatic IndexedDB-based caching for annotation documents to speed up loading and reduce server requests.\n\n`
  doc += `### Auto-Enabled Caching\n\n`
  doc += `Both \`AnnotationManager\` and \`SlideViewer\` automatically create and use an \`IndexedDBAnnotationCache\` instance by default. This provides:\n\n`
  doc += `- **Persistent caching** across page refreshes (uses IndexedDB, 50MB+ capacity)\n`
  doc += `- **Automatic cache validation** using version hashes from annotation headers\n`
  doc += `- **Per-annotation cache indicators** (database icon) when cached\n`
  doc += `- **Per-annotation cache bypass** (refresh icon) to clear and reload specific annotations\n\n`
  doc += `### Disabling Cache\n\n`
  doc += `To disable caching globally for debugging:\n\n`
  doc += `\`\`\`tsx\n`
  doc += `<AnnotationManager\n`
  doc += `  imageId="..."\n`
  doc += `  apiBaseUrl="..."\n`
  doc += `  disableCache={true}  // Disables all caching\n`
  doc += `/>\n`
  doc += `<SlideViewer\n`
  doc += `  annotationIds={[...]}\n`
  doc += `  disableCache={true}  // Disables all caching\n`
  doc += `/>\n`
  doc += `\`\`\`\n\n`
  doc += `### Cache Implementation\n\n`
  doc += `\`\`\`tsx\n`
  doc += `import { IndexedDBAnnotationCache, MemoryAnnotationCache } from 'bdsa-react-components'\n\n`
  doc += `// Use a specific cache implementation (optional)\n`
  doc += `const cache = new IndexedDBAnnotationCache()\n`
  doc += `<AnnotationManager annotationCache={cache} ... />\n`
  doc += `<SlideViewer annotationCache={cache} ... />\n`
  doc += `\`\`\`\n\n`
  doc += `### Cache Utilities\n\n`
  doc += `\`\`\`tsx\n`
  doc += `import { checkIndexedDBQuota, requestPersistentStorage, logQuotaInfo } from 'bdsa-react-components'\n\n`
  doc += `// Check cache quota and usage\n`
  doc += `const quotaInfo = await checkIndexedDBQuota()\n`
  doc += `if (quotaInfo) {\n`
  doc += `  console.log(\`Usage: \${quotaInfo.usagePercent.toFixed(1)}%\`)\n`
  doc += `  console.log(\`Available: \${quotaInfo.available} bytes\`)\n`
  doc += `}\n\n`
  doc += `// Request persistent storage (prevents browser cleanup)\n`
  doc += `await requestPersistentStorage()\n\n`
  doc += `// Log quota info in readable format\n`
  doc += `await logQuotaInfo()\n`
  doc += `\`\`\`\n\n`
  doc += `**Note:** IndexedDB storage limits are automatically managed by the browser. When quota is exceeded, the browser will prompt the user for permission to expand storage.\n\n`
  
  doc += `## Dependencies\n\n`
  doc += `**Peer:** react ^18.0.0, react-dom ^18.0.0\n\n`
  doc += `**Direct:** openseadragon ^5.0.1, osd-paperjs-annotation, paper ^0.12.18\n\n`
  
  doc += `---\n\n`
  doc += `_Auto-generated from source code - Regenerate with: npm run generate:cursor-doc_\n`
  
  return doc
}

// Write the document
const cursorDoc = generateCursorDoc()
const outputPath = join(rootDir, 'CURSOR_INTEGRATION.md')
writeFileSync(outputPath, cursorDoc, 'utf8')

console.log(`✓ Generated CURSOR integration document: ${outputPath}`)
console.log(`  Size: ${(cursorDoc.length / 1024).toFixed(2)} KB`)
console.log(`  Components documented: ${readdirSync(srcDir).filter(item => statSync(join(srcDir, item)).isDirectory()).length}`)
