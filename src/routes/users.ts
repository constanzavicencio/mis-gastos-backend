import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';

export const usersRouter = Router();

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({ where: { id: req.user!.id } });
    res.json(user);
  }),
);
