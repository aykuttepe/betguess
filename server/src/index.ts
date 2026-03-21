import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDatabase } from './db/database';
import { requireAuth } from './auth/auth-middleware';
import { AuthRequest } from './auth/types';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import matchesRouter from './routes/matches';
import statsRouter from './routes/stats';
import aiRouter from './routes/ai';
import matchIntelRouter from './routes/match-intel';
import teamStatsRouter from './routes/team-stats';
import footballRouter from './routes/football';
import historyRouter from './routes/history';
import couponsRouter from './routes/coupons';
import { getCached } from './scraper/cache';
import { scrapeMatches } from './scraper/nesine-scraper';
import forumRouter from './routes/forum';
import { whatsappService } from './services/whatsapp-service';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

function warmMatchesCache(): void {
  if (getCached()) {
    return;
  }

  void scrapeMatches(true).catch((error: Error) => {
    console.error('[Server] Baslangic cache isitma basarisiz:', error.message);
  });
}

// Initialize database
initDatabase();

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(cookieParser());

// Static uploads (before auth)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public auth routes (no auth required)
app.use('/api/auth', authRouter);

// Public forum routes (optionalAuth handled internally)
app.use('/api/forum', forumRouter);

// Health check (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected API routes
app.use('/api', requireAuth as any);
app.use('/api', matchesRouter);
app.use('/api', statsRouter);
app.use('/api', matchIntelRouter);
app.use('/api', teamStatsRouter);
app.use('/api/football', footballRouter);
app.use('/api/ai', aiRouter);
app.use('/api', historyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/coupons', couponsRouter);

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist, {
  etag: true,
  lastModified: true,
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return;
    }

    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Server] http://localhost:${PORT} adresinde calisiyor`);
  warmMatchesCache();
  whatsappService.initialize();
});
