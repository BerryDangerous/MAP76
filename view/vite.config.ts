import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    {
      name: 'dev-overrides-list',
      configureServer(server) {
        server.middlewares.use('/dev/overrides-list.json', (req, res) => {
          const overridesDir = path.resolve(__dirname, 'public/assets/icons/location/overrides');
          let files: string[] = [];
          if (fs.existsSync(overridesDir)) {
            files = fs.readdirSync(overridesDir).filter(f => f.endsWith('.json'));
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(files));
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './', 
  build: {
    outDir: 'dist',
    minify: 'terser',
    target: 'es2022',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
