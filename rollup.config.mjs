import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    sourcemap: true,
  },
  plugins: [
    resolve({
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      sourceMap: true,
    }),
  ],
  external: [
    // Node.js built-ins
    'crypto',
    'fs',
    'path',
    'os',
    'http',
    'https',
    'stream',
    'util',
    'events',
    'buffer',
    'url',
    'zlib',
    'assert',
    'tty',
    'net',
  ],
}
