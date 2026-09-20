import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { anchorChain } from './utils/hashChain.js';
import authRouter from './routes/auth.js';
import patientsRouter from './routes/patients.js';
import logsRouter from './routes/logs.js';
import adminRouter from './routes/admin.js';
import testRouter from './routes/test.js';

dotenv.config();

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: false
  }));
  app.use(express.json());
  app.get('/', (req, res) => res.json({ status: 'ok', service: 'Holay API' }));
  app.use('/auth', authRouter);
  app.use('/patients', patientsRouter);
  app.use('/logs', logsRouter);
  app.use('/admin', adminRouter);
  app.use('/api', testRouter);

  return app;
}

export function startAnchorScheduler() {
  const anchorInterval = setInterval(async () => {
    try {
      const anchor = await anchorChain();
      if (anchor) {
        console.log(`[ANCHOR] Periodic chain anchor recorded: row ${anchor.row_id_at_anchor} -> ${anchor.anchor_hash.substring(0, 16)}...`);
      }
    } catch (err) {
      console.error('[ANCHOR] Periodic anchor error:', err.message);
    }
  }, 2 * 60 * 1000);

  anchorInterval.unref?.();
  return anchorInterval;
}

export const app = createApp();
export default app;