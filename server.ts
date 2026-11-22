import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCultureRouter } from './server/cultureRouter.ts';
import { createSportsRouter } from './server/sportsRouter.ts';
import { createStudyResearchRouter } from './server/studyResearchRouter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const SPEED_PROBE_BUFFER = Buffer.alloc(256 * 1024, 0x46); // 256 KB deterministic probe

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Preserve window.opener across cross-origin OAuth popups (Firebase Google Sign-In)
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  // Minimal health & latency probe endpoint (no preloaded AI providers or quotas)
  app.get('/api/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ok: true,
      service: 'fabro-platform',
      mode: 'offline-first-byok',
      timestamp: Date.now(),
    });
  });

  // Zero-cost real connection speed probe (256 KB non-cached response)
  app.get('/api/speed-probe', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(SPEED_PROBE_BUFFER.length));
    res.send(SPEED_PROBE_BUFFER);
  });

  // FABRO DEPORTES $0-cost public sports JSON & RSS aggregator with TTL cache
  app.use('/api/sports', createSportsRouter());

  // FABRO CULTURA $0-cost Spanish cultural RSS news aggregator with TTL cache
  app.use('/api/culture', createCultureRouter());

  // FABRO ESTUDIO 2.0 $0-cost academic research, dictionary, translation & spellcheck proxy
  app.use('/api/study', createStudyResearchRouter());

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FABRO Offline-First server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FABRO server:', err);
  process.exit(1);
});
