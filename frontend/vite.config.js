import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// `vite build --mode demo`: every '../api' import gets the in-browser pretend server instead (src/demo/api.js),
// so the result is a static site that never opens an SSH session. base './' lets it live under any path.
export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  base: mode === 'demo' ? './' : '/',
  define: { __SSHFM_DEMO__: JSON.stringify(mode === 'demo') },
  resolve: {
    alias: [
      ...(mode === 'demo' ? [{ find: /^\.{1,2}\/api$/, replacement: fileURLToPath(new URL('./src/demo/api.js', import.meta.url)) }] : []),
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  server: {
    port: 6969,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:6970',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
    emptyOutDir: true,
  }
}))
