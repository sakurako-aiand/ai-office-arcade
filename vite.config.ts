import { defineConfig } from 'vite';

// Vite config for ai& Office Arcade.
// `base: './'` produces relative asset URLs so the build can be served
// from any subpath (important for build.io / static hosting).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    // Phaser is large; raise the warning threshold so the production
    // build log stays readable.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
