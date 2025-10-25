import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';
import { parseDecimal } from '../utils/validation';

export const expensesRouter = Router();

expensesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, categoryId, subcategoryId } = req.query as {
      from?: string;
      to?: string;
      categoryId?: string;
      subcategoryId?: string;
    };

    const where: any = { userId: req.user!.id };

    if (from || to) {
      where.occurredAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({ error: 'INVALID_QUERY', message: 'from must be a valid date' });
        }
        where.occurredAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({ error: 'INVALID_QUERY', message: 'to must be a valid date' });
        }
        where.occurredAt.lte = toDate;
      }
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (subcategoryId) {
      where.subcategoryId = subcategoryId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });

    res.json(expenses);
  }),
);

expensesRouter.get(
  '/:expenseId',
  asyncHandler(async (req, res) => {
    const { expenseId } = req.params as { expenseId: string };
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, userId: req.user!.id },
    });

    if (!expense) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    }

    res.json(expense);
  }),
);

expensesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { amount, currency, occurredAt, categoryId, subcategoryId, description, notes } = req.body as {
      amount?: number | string;
      currency?: string;
      occurredAt?: string;
      categoryId?: string;
      subcategoryId?: string;
      description?: string;
      notes?: string;
    };

    if (amount === undefined) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'amount is required' });
    }

    if (!occurredAt) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'occurredAt is required' });
    }

    const occurredDate = new Date(occurredAt);
    if (Number.isNaN(occurredDate.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'occurredAt must be a valid date' });
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.user!.id } });
      if (!category) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'categoryId is invalid' });
      }
    }

    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findFirst({ where: { id: subcategoryId, userId: req.user!.id } });
      if (!subcategory) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'subcategoryId is invalid' });
      }
    }

    const expense = await prisma.expense.create({
      data: {
        userId: req.user!.id,
        amount: parseDecimal(amount, 'amount'),
        currency: currency ?? 'ARS',
        occurredAt: occurredDate,
        categoryId: categoryId ?? null,
        subcategoryId: subcategoryId ?? null,
        description: description ?? null,
        notes: notes ?? null,
      },
    });

    res.status(201).json(expense);
  }),
);

expensesRouter.put(
  '/:expenseId',
  asyncHandler(async (req, res) => {
    const { expenseId } = req.params as { expenseId: string };
    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    }

    const { amount, currency, occurredAt, categoryId, subcategoryId, description, notes } = req.body as {
      amount?: number | string;
      currency?: string;
      occurredAt?: string;
      categoryId?: string | null;
      subcategoryId?: string | null;
      description?: string | null;
      notes?: string | null;
    };

    let occurredDate = existing.occurredAt;
    if (occurredAt) {
      const parsed = new Date(occurredAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'occurredAt must be a valid date' });
      }
      occurredDate = parsed;
    }

    if (categoryId) {
      const category = await prisma.category.findFirst({ where: { id: categoryId, userId: req.user!.id } });
      if (!category) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'categoryId is invalid' });
      }
    }

    if (subcategoryId) {
      const subcategory = await prisma.subcategory.findFirst({ where: { id: subcategoryId, userId: req.user!.id } });
      if (!subcategory) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'subcategoryId is invalid' });
      }
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: amount !== undefined ? parseDecimal(amount, 'amount') : existing.amount,
        currency: currency ?? existing.currency,
        occurredAt: occurredDate,
        categoryId: categoryId === undefined ? existing.categoryId : categoryId,
        subcategoryId: subcategoryId === undefined ? existing.subcategoryId : subcategoryId,
        description: description === undefined ? existing.description : description ?? null,
        notes: notes === undefined ? existing.notes : notes ?? null,
      },
    });

    res.json(updated);
  }),
);

expensesRouter.delete(
  '/:expenseId',
  asyncHandler(async (req, res) => {
    const { expenseId } = req.params as { expenseId: string };

    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Expense not found' });
    }

    await prisma.expense.delete({ where: { id: expenseId } });
    res.status(204).send();
  }),
);
