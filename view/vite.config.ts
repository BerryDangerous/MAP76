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

        server.middlewares.use('/dev/svg-list.json', (req, res) => {
          const assetsDir = path.resolve(__dirname, 'public/assets');
          const walkSync = (dir: string, filelist: string[] = []) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filepath = path.join(dir, file);
              if (fs.statSync(filepath).isDirectory()) {
                filelist = walkSync(filepath, filelist);
              } else if (filepath.endsWith('.svg')) {
                filelist.push(filepath.replace(path.resolve(__dirname, 'public') + path.sep, '').replace(/\\/g, '/'));
              }
            }
            return filelist;
          };
          const svgFiles = fs.existsSync(assetsDir) ? walkSync(assetsDir) : [];
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(svgFiles));
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
