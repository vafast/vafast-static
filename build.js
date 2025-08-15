const { build } = require('tsup');
const { rm, cp } = require('fs/promises');
const { execSync } = require('child_process');

async function main() {
    try {
        await rm('dist', { recursive: true, force: true });

        const tsupConfig = {
            entry: ['src/**/*.ts'],
            splitting: false,
            sourcemap: false,
            clean: true,
            bundle: true
        };

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
        ]);

        execSync('tsc --project tsconfig.dts.json', { stdio: 'inherit' });

        // Copy .d.ts files to cjs directory
        try {
            await cp('dist/*.d.ts', 'dist/cjs', { recursive: true });
        } catch (error) {
            console.log('No .d.ts files to copy');
        }

        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

main();
