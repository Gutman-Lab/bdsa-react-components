import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, relative, resolve } from 'path'
import dts from 'vite-plugin-dts'
import type { Plugin } from 'vite'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

/**
 * With multiple library entries the CSS is emitted per entry. Keep the
 * documented `styles.css` export working by writing one aggregate stylesheet.
 */
function aggregateEntryCss(): Plugin {
    return {
        name: 'bdsa-aggregate-entry-css',
        closeBundle() {
            const distDir = resolve(__dirname, 'dist')
            const cssFiles = readdirSync(distDir)
                .filter((name) => name.endsWith('.css') && name !== 'index.css')
                .sort()
            if (cssFiles.length === 0) return
            const css = cssFiles
                .map((name) => `@import "./${name}";`)
                .join('\n')
            writeFileSync(resolve(distDir, 'index.css'), `${css}\n`)
        },
    }
}

/**
 * ESM chunks import their CSS. CJS does not, so keep the previous behaviour
 * for CommonJS consumers by requiring the aggregate stylesheet from each entry.
 */
function injectCjsEntryCss(): Plugin {
    return {
        name: 'bdsa-cjs-entry-css',
        closeBundle() {
            const distDir = resolve(__dirname, 'dist')
            const entries: string[] = []
            const walk = (dir: string) => {
                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                    const full = resolve(dir, entry.name)
                    if (entry.isDirectory()) walk(full)
                    else if (entry.name === 'index.cjs') entries.push(full)
                }
            }
            walk(distDir)
            for (const entry of entries) {
                const target = resolve(distDir, 'index.css')
                let rel = relative(dirname(entry), target).replace(/\\/g, '/')
                if (!rel.startsWith('.')) rel = `./${rel}`
                const source = readFileSync(entry, 'utf8')
                if (source.includes('index.css')) continue
                writeFileSync(entry, `require(${JSON.stringify(rel)});\n${source}`)
            }
        },
    }
}

/** Ship Pitt split schemas in `dist/schemas/` for HTTP hosting and ProtocolManager fetch fallback. */
function copyBundledSchemas(): Plugin {
    const names = [
        'clinical-metadata.json',
        'region-metadata.json',
        'stain-metadata.json',
        'slide-level-metadata.json',
    ] as const
    const srcDir = resolve(__dirname, 'src/components/ProtocolManager/schemas')
    const destDir = resolve(__dirname, 'dist/schemas')
    return {
        name: 'copy-bdsa-schemas',
        closeBundle() {
            mkdirSync(destDir, { recursive: true })
            for (const name of names) {
                copyFileSync(resolve(srcDir, name), resolve(destDir, name))
            }
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        libInjectCss(),
        copyBundledSchemas(),
        aggregateEntryCss(),
        injectCjsEntryCss(),
        dts({
            insertTypesEntry: true,
            include: ['src'],
        }),
    ],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                'components/DsaAuthManager/index': resolve(__dirname, 'src/entries/dsa-auth-manager.ts'),
                'components/FolderBrowser/index': resolve(__dirname, 'src/entries/folder-browser.ts'),
                'components/OSDThumbnailBrowser/index': resolve(__dirname, 'src/entries/osd-thumbnail-browser.ts'),
                'components/ThumbnailGrid/index': resolve(__dirname, 'src/entries/thumbnail-grid.ts'),
                'components/ThumbnailViewer/index': resolve(__dirname, 'src/entries/thumbnail-viewer.ts'),
                'components/ManifestBrowser/index': resolve(__dirname, 'src/entries/manifest-browser.ts'),
                'components/SlideViewer/index': resolve(__dirname, 'src/entries/slide-viewer.ts'),
                'components/ZStackVolumeViewer/index': resolve(__dirname, 'src/entries/zstack-volume-viewer.ts'),
                'components/ChannelHistograms/index': resolve(__dirname, 'src/entries/channel-histograms.ts'),
                'components/AnnotationBrowser/index': resolve(__dirname, 'src/entries/annotation-browser.ts'),
                'components/AnnotationEditor/index': resolve(__dirname, 'src/entries/annotation-editor.ts'),
                'components/AnnotationEditorPolygons/index': resolve(__dirname, 'src/entries/annotation-editor-polygons.ts'),
                'components/SingleBoxSlideEditor/index': resolve(__dirname, 'src/entries/single-box-slide-editor.ts'),
                'components/ProtocolManager/index': resolve(__dirname, 'src/entries/protocol-manager.ts'),
                'auth/index': resolve(__dirname, 'src/entries/auth.ts'),
                'cache/index': resolve(__dirname, 'src/entries/cache.ts'),
                'utils/index': resolve(__dirname, 'src/entries/item-utils.ts'),
            },
            name: 'BDSAReactComponents',
            formats: ['es', 'cjs'],
            fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: (id) =>
                id === 'react' ||
                id === 'react-dom' ||
                id === 'react/jsx-runtime' ||
                id === '@kitware/vtk.js' ||
                id.startsWith('@kitware/vtk.js/'),
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    'react/jsx-runtime': 'react/jsx-runtime',
                },
            },
            onwarn(warning, warn) {
                // Suppress CSS minification warnings (false positives)
                if (warning.code === 'css-syntax-error') {
                    return
                }
                warn(warning)
            },
        },
        sourcemap: 'hidden',
        emptyOutDir: true,
        cssCodeSplit: false,
        minify: 'esbuild',
    },
})

