import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';
import { calculateInventoryRunout } from '../utils/inventory';
import { addDays, startOfDay } from '../utils/dates';
import { decimalToNumber } from '../utils/serialization';
import { generateOccurrencesWithinWindow } from '../utils/schedules';

interface PlannerEventBase {
  type: 'INCOME' | 'SUBSCRIPTION' | 'INVENTORY_REMINDER' | 'INVENTORY_RUNOUT';
  id: string;
  name: string;
  date: Date;
  windowEnd?: Date;
  metadata?: Record<string, unknown>;
}

export const plannerRouter = Router();

plannerRouter.get(
  '/upcoming',
  asyncHandler(async (req, res) => {
    const daysParam = req.query.days as string | undefined;
    const includeParam = (req.query.include as string | undefined)?.split(',').map((entry) => entry.trim().toLowerCase());
    const includeSet = new Set(includeParam && includeParam[0] ? includeParam : ['incomes', 'subscriptions', 'inventory']);

    const days = daysParam ? Number(daysParam) : 60;
    if (!Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: 'INVALID_QUERY', message: 'days must be a positive number' });
    }

    const windowStart = startOfDay(new Date());
    const windowEnd = addDays(windowStart, days);

    const events: PlannerEventBase[] = [];

    if (includeSet.has('incomes')) {
      const incomes = await prisma.incomeStream.findMany({ where: { userId: req.user!.id } });
      for (const income of incomes) {
        const occurrences = generateOccurrencesWithinWindow(
          {
            scheduleType: income.scheduleType,
            dayOfMonth: income.dayOfMonth,
            nthBusinessDay: income.nthBusinessDay,
            monthDayRangeStart: income.monthDayRangeStart,
            monthDayRangeEnd: income.monthDayRangeEnd,
            businessDayRangeStart: income.businessDayRangeStart,
            businessDayRangeEnd: income.businessDayRangeEnd,
            activeMonths: income.activeMonths,
          },
          windowStart,
          windowEnd,
        );

        occurrences.forEach((occurrence) => {
          const event: PlannerEventBase = {
            type: 'INCOME',
            id: `income-${income.id}-${occurrence.date.toISOString()}`,
            name: income.name,
            date: occurrence.date,
            metadata: {
              amount: decimalToNumber(income.amount),
              currency: income.currency,
              notes: income.notes,
            },
          };

          if (occurrence.endDate) {
            event.windowEnd = occurrence.endDate;
          }

          events.push(event);
        });
      }
    }

    if (includeSet.has('subscriptions')) {
      const subscriptions = await prisma.subscription.findMany({ where: { userId: req.user!.id }, include: { category: true } });
      for (const subscription of subscriptions) {
        const occurrences = generateOccurrencesWithinWindow(
          {
            scheduleType: subscription.scheduleType,
            dayOfMonth: subscription.dayOfMonth,
            nthBusinessDay: subscription.nthBusinessDay,
            monthDayRangeStart: subscription.monthDayRangeStart,
            monthDayRangeEnd: subscription.monthDayRangeEnd,
            businessDayRangeStart: subscription.businessDayRangeStart,
            businessDayRangeEnd: subscription.businessDayRangeEnd,
            activeMonths: subscription.activeMonths,
          },
          windowStart,
          windowEnd,
        );

        occurrences.forEach((occurrence) => {
          const event: PlannerEventBase = {
            type: 'SUBSCRIPTION',
            id: `subscription-${subscription.id}-${occurrence.date.toISOString()}`,
            name: subscription.name,
            date: occurrence.date,
            metadata: {
              amount: decimalToNumber(subscription.amount),
              currency: subscription.currency,
              notes: subscription.notes,
              category: subscription.category?.name,
            },
          };

          if (occurrence.endDate) {
            event.windowEnd = occurrence.endDate;
          }

          events.push(event);
        });
      }
    }

    if (includeSet.has('inventory')) {
      const items = await prisma.inventoryItem.findMany({
        where: { userId: req.user!.id },
        include: { purchases: true, category: true, subcategory: true },
      });

      for (const item of items) {
        const metrics = calculateInventoryRunout(item, item.purchases, windowStart);

        if (metrics.reminderDate && metrics.reminderDate >= windowStart && metrics.reminderDate <= windowEnd) {
          events.push({
            type: 'INVENTORY_REMINDER',
            id: `inventory-reminder-${item.id}-${metrics.reminderDate.toISOString()}`,
            name: item.name,
            date: metrics.reminderDate,
            metadata: {
              stockOnHand: metrics.stockOnHand,
              runOutDate: metrics.runOutDate,
              reminderDays: item.reminderAdvanceDays,
              category: item.category?.name,
              subcategory: item.subcategory?.name,
              purchaseQuantity: decimalToNumber(item.purchaseQuantity),
              costPerPurchase: decimalToNumber(item.costPerPurchase),
            },
          });
        }

        if (metrics.runOutDate && metrics.runOutDate >= windowStart && metrics.runOutDate <= windowEnd) {
          events.push({
            type: 'INVENTORY_RUNOUT',
            id: `inventory-runout-${item.id}-${metrics.runOutDate.toISOString()}`,
            name: item.name,
            date: metrics.runOutDate,
            metadata: {
              stockOnHand: metrics.stockOnHand,
              reminderDays: item.reminderAdvanceDays,
              category: item.category?.name,
              subcategory: item.subcategory?.name,
              purchaseQuantity: decimalToNumber(item.purchaseQuantity),
              costPerPurchase: decimalToNumber(item.costPerPurchase),
            },
          });
        }
      }
    }

    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    res.json({
      windowStart,
      windowEnd,
      events,
    });
  }),
);
