import { rm, writeFile } from 'node:fs/promises';
import { $ } from 'bun';

const outdir = '../../dist/sumac';

await rm(outdir, {
  recursive: true,
  force: true
});

const result = await Bun.build({
  entrypoints: [
    './src/index.ts',
    './src/runtime/bun.ts',
    './src/runtime/node.ts',
    './src/client/index.ts'
  ],
  outdir,
  target: 'bun',
  format: 'esm',
  minify: true,
  sourcemap: 'none'
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await $`bunx tsc --project tsconfig.build.json`;

const { name, version } = await Bun.file('./package.json').json();

await writeFile(
  `${outdir}/package.json`,
  JSON.stringify(
    {
      name,
      version,
      type: 'module',
      main: './index.js',
      types: './index.d.ts',
      exports: {
        '.': { types: './index.d.ts', default: './index.js' },
        './runtime/bun': {
          types: './runtime/bun.d.ts',
          default: './runtime/bun.js'
        },
        './runtime/node': {
          types: './runtime/node.d.ts',
          default: './runtime/node.js'
        },
        './client': {
          types: './client/index.d.ts',
          default: './client/index.js'
        }
      }
    },
    null,
    2
  )
);

console.log(`Built ${name}@${version} → dist/sumac`);
