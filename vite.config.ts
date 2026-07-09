import { copyFileSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'
import type { Plugin } from 'vite'
import { libInjectCss } from 'vite-plugin-lib-inject-css'

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
        dts({
            insertTypesEntry: true,
            include: ['src'],
        }),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'BDSAReactComponents',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
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

