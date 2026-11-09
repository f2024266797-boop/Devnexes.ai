import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env = { ...process.env, ...env };

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-search-dev-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url === '/api/search' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { default: handler } = await import('./api/search.js');
                  const parsedBody = body ? JSON.parse(body) : {};
                  const fakeReq = { method: 'POST', body: parsedBody };
                  const fakeRes = {
                    status(code) { this.statusCode = code; return this; },
                    setHeader(name, val) { res.setHeader(name, val); return this; },
                    json(data) {
                      res.statusCode = this.statusCode || 200;
                      res.setHeader('Content-Type', 'application/json');
                      res.end(JSON.stringify(data));
                    }
                  };
                  await handler(fakeReq, fakeRes);
                } catch (err) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ],
    envPrefix: ['VITE_', 'GROQ_', 'TAVILY_', 'GEMINI_', 'BRAVE_', 'STABILITY_', 'HF_'],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('lucide-react')) return 'vendor-icons';
            }
          }
        }
      }
    }
  };
})
