import { BudgetPeriod } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';
import { monthRangeFromIso } from '../utils/dates';
import { decimalToNumber } from '../utils/serialization';
import { parseDecimal } from '../utils/validation';

export const budgetsRouter = Router();

budgetsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const budgets = await prisma.budget.findMany({
      where: { userId: req.user!.id },
      include: { category: true, subcategory: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json(budgets);
  }),
);

budgetsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, amount, currency, period, categoryId, subcategoryId, startDate, endDate } = req.body as {
      name?: string;
      amount?: number | string;
      currency?: string;
      period?: BudgetPeriod;
      categoryId?: string;
      subcategoryId?: string;
      startDate?: string;
      endDate?: string;
    };

    if (!name) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    if (amount === undefined) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'amount is required' });
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

    const start = startDate ? new Date(startDate) : null;
    if (start && Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'startDate must be a valid date' });
    }

    const end = endDate ? new Date(endDate) : null;
    if (end && Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'endDate must be a valid date' });
    }

    const budget = await prisma.budget.create({
      data: {
        userId: req.user!.id,
        name,
        amount: parseDecimal(amount, 'amount'),
        currency: currency ?? 'ARS',
        period: period ?? BudgetPeriod.MONTHLY,
        categoryId: typeof categoryId === 'string' ? categoryId : null,
        subcategoryId: typeof subcategoryId === 'string' ? subcategoryId : null,
        startDate: start,
        endDate: end,
      },
      include: { category: true, subcategory: true },
    });

    res.status(201).json(budget);
  }),
);

budgetsRouter.put(
  '/:budgetId',
  asyncHandler(async (req, res) => {
    const { budgetId } = req.params as { budgetId: string };
    const existing = await prisma.budget.findFirst({ where: { id: budgetId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Budget not found' });
    }

    const { name, amount, currency, period, categoryId, subcategoryId, startDate, endDate } = req.body as {
      name?: string;
      amount?: number | string;
      currency?: string;
      period?: BudgetPeriod;
      categoryId?: string | null;
      subcategoryId?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    };

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

    const start = startDate ? new Date(startDate) : existing.startDate;
    if (startDate && start && Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'startDate must be a valid date' });
    }

    const end = endDate ? new Date(endDate) : existing.endDate;
    if (endDate && end && Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'endDate must be a valid date' });
    }

    const updated = await prisma.budget.update({
      where: { id: budgetId },
      data: {
        name: name ?? existing.name,
        amount: amount !== undefined ? parseDecimal(amount, 'amount') : existing.amount,
        currency: currency ?? existing.currency,
        period: period ?? existing.period,
        categoryId:
          categoryId === undefined
            ? existing.categoryId
            : typeof categoryId === 'string'
              ? categoryId
              : null,
        subcategoryId:
          subcategoryId === undefined
            ? existing.subcategoryId
            : typeof subcategoryId === 'string'
              ? subcategoryId
              : null,
        startDate: start,
        endDate: end,
      },
      include: { category: true, subcategory: true },
    });

    res.json(updated);
  }),
);

budgetsRouter.delete(
  '/:budgetId',
  asyncHandler(async (req, res) => {
    const { budgetId } = req.params as { budgetId: string };
    const existing = await prisma.budget.findFirst({ where: { id: budgetId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Budget not found' });
    }

    await prisma.budget.delete({ where: { id: budgetId } });
    res.status(204).send();
  }),
);

budgetsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const { month } = req.query as { month?: string };
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    let range;
    try {
      range = monthRangeFromIso(targetMonth);
    } catch (error) {
      return res.status(400).json({ error: 'INVALID_QUERY', message: (error as Error).message });
    }

    const budgets = await prisma.budget.findMany({
      where: { userId: req.user!.id },
      include: { category: true, subcategory: true },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        userId: req.user!.id,
        occurredAt: {
          gte: range.start,
          lt: range.end,
        },
      },
      select: { amount: true, categoryId: true, subcategoryId: true },
    });

    type BudgetWithRelations = (typeof budgets)[number];
    type ExpenseSummary = (typeof expenses)[number];

    const response = budgets.map((budget: BudgetWithRelations) => {
      const actual = expenses
        .filter((expense: ExpenseSummary) => {
          if (budget.subcategoryId) {
            return expense.subcategoryId === budget.subcategoryId;
          }
          if (budget.categoryId) {
            return expense.categoryId === budget.categoryId;
          }
          return true;
        })
        .reduce((sum: number, expense: ExpenseSummary) => sum + (decimalToNumber(expense.amount) ?? 0), 0);

      const targetAmount = decimalToNumber(budget.amount) ?? 0;

      return {
        budget,
        actual,
        variance: targetAmount - actual,
      };
    });

    res.json({
      month: targetMonth,
      periodStart: range.start,
      periodEnd: range.end,
      results: response,
    });
  }),
);
