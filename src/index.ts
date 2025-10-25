const { express } = require('express');
import type { Request, Response } from 'express';
const { cors } = require('cors');
const { authMiddleware } = require('./middleware/auth');
const dotenv = require('dotenv');
const { prisma } = require('./db');

declare global {
  namespace Express {
    interface Request {
      auth?: any;
    }
  }
}

dotenv.config();

const app = express();

// CORS config for React Native app
app.use(cors({
  origin: '*', // In production, replace with your React Native app's domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public endpoint example
app.get('/public', (_req: Request, res: Response) => {
  res.json({ 
    message: 'Public endpoint',
    docs: 'This endpoint is accessible without authentication'
  });
});

// Protected endpoint example
app.get('/protected', authMiddleware, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ 
      take: 10,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ 
      protected: true, 
      authenticatedUser: req.auth, // Auth0 user info
      users 
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Could not fetch users'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /');
  console.log('  GET  /public');
  console.log('  GET  /protected (requires Auth0 token)');
});
