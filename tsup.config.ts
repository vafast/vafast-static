import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/**/*.ts'],
    splitting: false,
    sourcemap: false,
    clean: true,
    bundle: true,
    format: ['esm', 'cjs'],
    outDir: 'dist',
    target: 'node20',
    cjsInterop: false,
    dts: true,
    outExtension({ format }) {
        return {
            js: format === 'cjs' ? '.js' : '.mjs'
        }
    },
    onSuccess:
        'cp dist/*.d.ts dist/cjs/ 2>/dev/null || echo "No .d.ts files to copy"'
})
