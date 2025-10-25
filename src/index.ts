import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth';
import { ensureUser } from './middleware/ensureUser';
import { apiRouter } from './routes';
import { prisma } from './db';

dotenv.config();

const app = express();

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/public', (_req: Request, res: Response) => {
  res.json({
    message: 'Public endpoint',
    docs: 'This endpoint is accessible without authentication.',
  });
});

app.get(
  '/protected',
  authMiddleware,
  ensureUser,
  async (_req: Request, res: Response) => {
    const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
    res.json({
      protected: true,
      user: _req.user,
      recentUsers,
    });
  },
);

app.use('/api', authMiddleware, ensureUser, apiRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
