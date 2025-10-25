import type { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload?: {
          sub?: string;
          email?: string;
          name?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
      user?: User;
    }
  }
}

export {};
