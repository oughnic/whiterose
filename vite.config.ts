import { defineConfig } from 'vite';

// The site is deployed to GitHub Pages at https://oughnic.github.io/whiterose/,
// so production assets must be served from the /whiterose/ sub-path. In dev the
// base is '/'. Override with VITE_BASE if the hosting path ever changes.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.VITE_BASE ?? '/whiterose/') : '/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    // Visual Studio holds locks on .vs/*.vsidx which crash the file watcher on Windows.
    watch: { ignored: ['**/.vs/**', '**/dist/**', '**/data/**'] },
  },
}));
