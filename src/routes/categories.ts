import { CategoryType } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.id },
      include: { subcategories: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    res.json(categories);
  }),
);

categoriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, type, color, icon } = req.body as {
      name?: string;
      type?: CategoryType;
      color?: string;
      icon?: string;
    };

    if (!name) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    const category = await prisma.category.create({
      data: {
        userId: req.user!.id,
        name,
        type: type ?? CategoryType.EXPENSE,
        color: color ?? null,
        icon: icon ?? null,
      },
    });

    res.status(201).json(category);
  }),
);

categoriesRouter.put(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.params as { categoryId: string };
    const { name, type, color, icon } = req.body as {
      name?: string;
      type?: CategoryType;
      color?: string;
      icon?: string;
    };

    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Category not found' });
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: name ?? existing.name,
        type: type ?? existing.type,
        color: color ?? existing.color ?? null,
        icon: icon ?? existing.icon ?? null,
      },
    });

    res.json(updated);
  }),
);

categoriesRouter.delete(
  '/:categoryId',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.params as { categoryId: string };

    const existing = await prisma.category.findFirst({ where: { id: categoryId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Category not found' });
    }

    await prisma.category.delete({ where: { id: categoryId } });
    res.status(204).send();
  }),
);

categoriesRouter.post(
  '/:categoryId/subcategories',
  asyncHandler(async (req, res) => {
    const { categoryId } = req.params as { categoryId: string };
    const { name } = req.body as { name?: string };

    if (!name) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.user!.id } });
    if (!category) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Category not found' });
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        categoryId: category.id,
        userId: req.user!.id,
      },
    });

    res.status(201).json(subcategory);
  }),
);

categoriesRouter.put(
  '/subcategories/:subcategoryId',
  asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params as { subcategoryId: string };
    const { name } = req.body as { name?: string };

    if (!name) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    const subcategory = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, userId: req.user!.id },
    });

    if (!subcategory) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Subcategory not found' });
    }

    const updated = await prisma.subcategory.update({
      where: { id: subcategoryId },
      data: { name },
    });

    res.json(updated);
  }),
);

categoriesRouter.delete(
  '/subcategories/:subcategoryId',
  asyncHandler(async (req, res) => {
    const { subcategoryId } = req.params as { subcategoryId: string };

    const subcategory = await prisma.subcategory.findFirst({
      where: { id: subcategoryId, userId: req.user!.id },
    });

    if (!subcategory) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Subcategory not found' });
    }

    await prisma.subcategory.delete({ where: { id: subcategoryId } });
    res.status(204).send();
  }),
);
