import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
        testTimeout: 5000, // 5 second timeout per test
        hookTimeout: 5000, // 5 second timeout for hooks
    },
})

