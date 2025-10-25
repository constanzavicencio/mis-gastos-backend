import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db';

export const ensureUser = async (req: Request, res: Response, next: NextFunction) => {
  const authPayload = (req as Request & { auth?: { payload?: { sub?: string; email?: string; name?: string } } }).auth?.payload;

  const auth0Id = authPayload?.sub;

  if (!auth0Id) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Missing Auth0 subject in token payload' });
  }

  try {
    let user = await prisma.user.findUnique({ where: { auth0Id } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          auth0Id,
          ...(authPayload?.email ? { email: authPayload.email } : {}),
          ...(authPayload?.name ? { name: authPayload.name } : {}),
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
