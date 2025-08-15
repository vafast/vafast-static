import { build, type Options } from 'tsup'

const tsupConfig: Options = {
    entry: ['src/**/*.ts'],
    splitting: false,
    sourcemap: false,
    clean: true,
    bundle: true
} satisfies Options

await Promise.all([
    // ? tsup esm
    build({
        outDir: 'dist',
        format: 'esm',
        target: 'node20',
        cjsInterop: false,
        ...tsupConfig
    }),
    // ? tsup cjs
    build({
        outDir: 'dist/cjs',
        format: 'cjs',
        target: 'node20',
        // dts: true,
        ...tsupConfig
    })
])

// Generate TypeScript declaration files
await build({
    entry: ['src/**/*.ts'],
    outDir: 'dist',
    dts: true,
    bundle: false,
    clean: false
})

// Copy .d.ts files to cjs directory
const { cp } = await import('fs/promises')
try {
    await cp('dist/*.d.ts', 'dist/cjs', { recursive: true })
} catch (error) {
    console.log('No .d.ts files to copy')
}

console.log('Build completed successfully!')
