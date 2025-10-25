import { ScheduleType } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';
import { parseDecimal, parseOptionalInt, parseOptionalIntArray, validateSchedulePayload } from '../utils/validation';

export const incomesRouter = Router();

incomesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const incomes = await prisma.incomeStream.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(incomes);
  }),
);

interface NormalizedSchedule {
  scheduleType: ScheduleType;
  dayOfMonth: number | null;
  nthBusinessDay: number | null;
  monthDayRangeStart: number | null;
  monthDayRangeEnd: number | null;
  businessDayRangeStart: number | null;
  businessDayRangeEnd: number | null;
  activeMonths: number[];
}

const buildSchedulePayload = (body: any): NormalizedSchedule => {
  const scheduleType = body.scheduleType as ScheduleType;
  if (!scheduleType) {
    throw new Error('scheduleType is required');
  }

  const payload = {
    scheduleType,
    dayOfMonth: parseOptionalInt(body.dayOfMonth, 'dayOfMonth'),
    nthBusinessDay: parseOptionalInt(body.nthBusinessDay, 'nthBusinessDay'),
    monthDayRangeStart: parseOptionalInt(body.monthDayRangeStart, 'monthDayRangeStart'),
    monthDayRangeEnd: parseOptionalInt(body.monthDayRangeEnd, 'monthDayRangeEnd'),
    businessDayRangeStart: parseOptionalInt(body.businessDayRangeStart, 'businessDayRangeStart'),
    businessDayRangeEnd: parseOptionalInt(body.businessDayRangeEnd, 'businessDayRangeEnd'),
    activeMonths: parseOptionalIntArray(body.activeMonths, 'activeMonths'),
  };

  validateSchedulePayload(payload);
  return {
    scheduleType: payload.scheduleType,
    dayOfMonth: payload.dayOfMonth ?? null,
    nthBusinessDay: payload.nthBusinessDay ?? null,
    monthDayRangeStart: payload.monthDayRangeStart ?? null,
    monthDayRangeEnd: payload.monthDayRangeEnd ?? null,
    businessDayRangeStart: payload.businessDayRangeStart ?? null,
    businessDayRangeEnd: payload.businessDayRangeEnd ?? null,
    activeMonths: payload.activeMonths ?? [],
  };
};

incomesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, amount, currency, notes } = req.body as {
      name?: string;
      amount?: number | string;
      currency?: string;
      notes?: string;
    };

    if (!name) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    if (amount === undefined) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'amount is required' });
    }

    let schedule;
    try {
      schedule = buildSchedulePayload(req.body);
    } catch (error) {
      return res.status(400).json({ error: 'INVALID_BODY', message: (error as Error).message });
    }

    const income = await prisma.incomeStream.create({
      data: {
        userId: req.user!.id,
        name,
        amount: parseDecimal(amount, 'amount'),
        currency: currency ?? 'ARS',
        scheduleType: schedule.scheduleType,
        dayOfMonth: schedule.dayOfMonth,
        nthBusinessDay: schedule.nthBusinessDay,
        monthDayRangeStart: schedule.monthDayRangeStart,
        monthDayRangeEnd: schedule.monthDayRangeEnd,
        businessDayRangeStart: schedule.businessDayRangeStart,
        businessDayRangeEnd: schedule.businessDayRangeEnd,
        activeMonths: schedule.activeMonths ?? [],
        notes: notes ?? null,
      },
    });

    res.status(201).json(income);
  }),
);

incomesRouter.put(
  '/:incomeId',
  asyncHandler(async (req, res) => {
    const { incomeId } = req.params as { incomeId: string };
    const existing = await prisma.incomeStream.findFirst({ where: { id: incomeId, userId: req.user!.id } });

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Income stream not found' });
    }

    let schedule: NormalizedSchedule = {
      scheduleType: existing.scheduleType,
      dayOfMonth: existing.dayOfMonth,
      nthBusinessDay: existing.nthBusinessDay,
      monthDayRangeStart: existing.monthDayRangeStart,
      monthDayRangeEnd: existing.monthDayRangeEnd,
      businessDayRangeStart: existing.businessDayRangeStart,
      businessDayRangeEnd: existing.businessDayRangeEnd,
      activeMonths: existing.activeMonths,
    };

    if (req.body.scheduleType) {
      try {
        schedule = buildSchedulePayload(req.body);
      } catch (error) {
        return res.status(400).json({ error: 'INVALID_BODY', message: (error as Error).message });
      }
    } else {
      // Partial updates to schedule fields
      const patchedSchedule = {
        scheduleType: schedule.scheduleType,
        dayOfMonth: req.body.dayOfMonth !== undefined ? parseOptionalInt(req.body.dayOfMonth, 'dayOfMonth') : schedule.dayOfMonth,
        nthBusinessDay:
          req.body.nthBusinessDay !== undefined
            ? parseOptionalInt(req.body.nthBusinessDay, 'nthBusinessDay')
            : schedule.nthBusinessDay,
        monthDayRangeStart:
          req.body.monthDayRangeStart !== undefined
            ? parseOptionalInt(req.body.monthDayRangeStart, 'monthDayRangeStart')
            : schedule.monthDayRangeStart,
        monthDayRangeEnd:
          req.body.monthDayRangeEnd !== undefined
            ? parseOptionalInt(req.body.monthDayRangeEnd, 'monthDayRangeEnd')
            : schedule.monthDayRangeEnd,
        businessDayRangeStart:
          req.body.businessDayRangeStart !== undefined
            ? parseOptionalInt(req.body.businessDayRangeStart, 'businessDayRangeStart')
            : schedule.businessDayRangeStart,
        businessDayRangeEnd:
          req.body.businessDayRangeEnd !== undefined
            ? parseOptionalInt(req.body.businessDayRangeEnd, 'businessDayRangeEnd')
            : schedule.businessDayRangeEnd,
        activeMonths:
          req.body.activeMonths !== undefined
            ? parseOptionalIntArray(req.body.activeMonths, 'activeMonths') ?? []
            : schedule.activeMonths,
      };

      try {
        validateSchedulePayload(patchedSchedule);
      } catch (error) {
        return res.status(400).json({ error: 'INVALID_BODY', message: (error as Error).message });
      }

      schedule = patchedSchedule;
    }

    const updated = await prisma.incomeStream.update({
      where: { id: incomeId },
      data: {
        name: req.body.name ?? existing.name,
        amount: req.body.amount !== undefined ? parseDecimal(req.body.amount, 'amount') : existing.amount,
        currency: req.body.currency ?? existing.currency,
        notes: req.body.notes === undefined ? existing.notes : req.body.notes ?? null,
        scheduleType: schedule.scheduleType,
        dayOfMonth: schedule.dayOfMonth,
        nthBusinessDay: schedule.nthBusinessDay,
        monthDayRangeStart: schedule.monthDayRangeStart,
        monthDayRangeEnd: schedule.monthDayRangeEnd,
        businessDayRangeStart: schedule.businessDayRangeStart,
        businessDayRangeEnd: schedule.businessDayRangeEnd,
        activeMonths: schedule.activeMonths ?? [],
      },
    });

    res.json(updated);
  }),
);

incomesRouter.delete(
  '/:incomeId',
  asyncHandler(async (req, res) => {
    const { incomeId } = req.params as { incomeId: string };
    const existing = await prisma.incomeStream.findFirst({ where: { id: incomeId, userId: req.user!.id } });

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Income stream not found' });
    }

    await prisma.incomeStream.delete({ where: { id: incomeId } });
    res.status(204).send();
  }),
);
