import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Determine backend URL based on environment
  const backendUrl = mode === 'production'
    ? env.VITE_BACKEND_URL
    : 'http://localhost:5000';

  return {
    plugins: [react()],
    
    // Secure environment variables
    define: {
      'process.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    
    server: {
      proxy: {
        '/socket.io': {
          target: backendUrl,
          ws: true,
          changeOrigin: true
        }
      }
    },
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            socket: ['socket.io-client']
          }
        }
      }
    }
  };
});