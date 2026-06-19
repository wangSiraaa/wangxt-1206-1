import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { router as apiRouter } from './routes.js';
import { initDb } from './db.js';
import { seedIfEmpty } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

initDb();
seedIfEmpty();

const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', apiRouter);

app.use('/api/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'ok' });
});

const clientDir = path.resolve(__dirname, '../dist-client');
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(500).json({ ok: false, error: { message: error.message || 'Server internal error' } });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: { message: `Not found: ${req.method} ${req.path}` } });
});

export default app;
