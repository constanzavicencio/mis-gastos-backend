import { Router } from 'express';
import { prisma } from '../db';
import { asyncHandler } from '../utils/async-handler';
import { calculateInventoryRunout } from '../utils/inventory';
import {
  parseDecimal,
  parseOptionalDecimal,
  parseOptionalInt,
} from '../utils/validation';

export const inventoryRouter = Router();

const ensureCategoryOwnership = async (userId: string, categoryId?: string | null, subcategoryId?: string | null) => {
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      throw new Error('categoryId is invalid');
    }
  }

  if (subcategoryId) {
    const subcategory = await prisma.subcategory.findFirst({ where: { id: subcategoryId, userId } });
    if (!subcategory) {
      throw new Error('subcategoryId is invalid');
    }
  }
};

inventoryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.inventoryItem.findMany({
      where: { userId: req.user!.id },
      include: { purchases: { orderBy: { purchasedAt: 'asc' } }, category: true, subcategory: true },
      orderBy: { name: 'asc' },
    });

    const enriched = items.map((item) => {
      const metrics = calculateInventoryRunout(item, item.purchases);
      return {
        ...item,
        metrics: {
          stockOnHand: metrics.stockOnHand,
          runOutDate: metrics.runOutDate,
          reminderDate: metrics.reminderDate,
        },
      };
    });

    res.json(enriched);
  }),
);

inventoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const {
      name,
      categoryId,
      subcategoryId,
      unitName,
      costPerPurchase,
      purchaseQuantity,
      consumptionPerDay,
      initialStockQuantity,
      initialStockDate,
      reminderAdvanceDays,
      notes,
    } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'name is required' });
    }

    const categoryIdValue = typeof categoryId === 'string' ? categoryId : null;
    const subcategoryIdValue = typeof subcategoryId === 'string' ? subcategoryId : null;

    try {
      await ensureCategoryOwnership(req.user!.id, categoryIdValue, subcategoryIdValue);
    } catch (error) {
      return res.status(400).json({ error: 'INVALID_BODY', message: (error as Error).message });
    }

    let initialStockDateParsed: Date | null = null;
    if (initialStockDate) {
      const parsed = new Date(initialStockDate as string);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: 'INVALID_BODY', message: 'initialStockDate must be a valid date' });
      }
      initialStockDateParsed = parsed;
    }

    const reminderDays = reminderAdvanceDays !== undefined ? parseOptionalInt(reminderAdvanceDays, 'reminderAdvanceDays') : null;

    const item = await prisma.inventoryItem.create({
      data: {
        userId: req.user!.id,
        name,
        categoryId: categoryIdValue,
        subcategoryId: subcategoryIdValue,
        unitName: (unitName as string) ?? null,
        costPerPurchase: parseOptionalDecimal(costPerPurchase, 'costPerPurchase'),
        purchaseQuantity: parseOptionalDecimal(purchaseQuantity, 'purchaseQuantity'),
        consumptionPerDay: parseOptionalDecimal(consumptionPerDay, 'consumptionPerDay'),
        initialStockQuantity: parseOptionalDecimal(initialStockQuantity, 'initialStockQuantity'),
        initialStockDate: initialStockDateParsed,
        reminderAdvanceDays: reminderDays ?? 7,
        notes: typeof notes === 'string' ? notes : null,
      },
      include: { purchases: true, category: true, subcategory: true },
    });

    const metrics = calculateInventoryRunout(item, item.purchases);
    res.status(201).json({
      ...item,
      metrics,
    });
  }),
);

inventoryRouter.get(
  '/:itemId',
  asyncHandler(async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const item = await prisma.inventoryItem.findFirst({
      where: { id: itemId, userId: req.user!.id },
      include: { purchases: { orderBy: { purchasedAt: 'asc' } }, category: true, subcategory: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventory item not found' });
    }

    const metrics = calculateInventoryRunout(item, item.purchases);
    res.json({
      ...item,
      metrics,
    });
  }),
);

inventoryRouter.put(
  '/:itemId',
  asyncHandler(async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const existing = await prisma.inventoryItem.findFirst({ where: { id: itemId, userId: req.user!.id } });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventory item not found' });
    }

    const {
      name,
      categoryId,
      subcategoryId,
      unitName,
      costPerPurchase,
      purchaseQuantity,
      consumptionPerDay,
      initialStockQuantity,
      initialStockDate,
      reminderAdvanceDays,
      notes,
    } = req.body as Record<string, unknown>;

    const categoryIdValue =
      categoryId === undefined
        ? existing.categoryId
        : typeof categoryId === 'string'
          ? categoryId
          : null;
    const subcategoryIdValue =
      subcategoryId === undefined
        ? existing.subcategoryId
        : typeof subcategoryId === 'string'
          ? subcategoryId
          : null;

    try {
      await ensureCategoryOwnership(req.user!.id, categoryIdValue, subcategoryIdValue);
    } catch (error) {
      return res.status(400).json({ error: 'INVALID_BODY', message: (error as Error).message });
    }

    let initialStockDateParsed = existing.initialStockDate;
    if (initialStockDate !== undefined) {
      if (!initialStockDate) {
        initialStockDateParsed = null;
      } else {
        const parsed = new Date(initialStockDate as string);
        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({ error: 'INVALID_BODY', message: 'initialStockDate must be a valid date' });
        }
        initialStockDateParsed = parsed;
      }
    }

    const reminderDays =
      reminderAdvanceDays !== undefined
        ? parseOptionalInt(reminderAdvanceDays, 'reminderAdvanceDays') ?? existing.reminderAdvanceDays
        : existing.reminderAdvanceDays;

    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        name: (name as string) ?? existing.name,
        categoryId: categoryIdValue,
        subcategoryId: subcategoryIdValue,
        unitName: unitName === undefined ? existing.unitName : typeof unitName === 'string' ? unitName : null,
        costPerPurchase:
          costPerPurchase !== undefined ? parseOptionalDecimal(costPerPurchase, 'costPerPurchase') : existing.costPerPurchase,
        purchaseQuantity:
          purchaseQuantity !== undefined
            ? parseOptionalDecimal(purchaseQuantity, 'purchaseQuantity')
            : existing.purchaseQuantity,
        consumptionPerDay:
          consumptionPerDay !== undefined
            ? parseOptionalDecimal(consumptionPerDay, 'consumptionPerDay')
            : existing.consumptionPerDay,
        initialStockQuantity:
          initialStockQuantity !== undefined
            ? parseOptionalDecimal(initialStockQuantity, 'initialStockQuantity')
            : existing.initialStockQuantity,
        initialStockDate: initialStockDateParsed,
        reminderAdvanceDays: reminderDays,
        notes: notes === undefined ? existing.notes : typeof notes === 'string' ? notes : null,
      },
      include: { purchases: true, category: true, subcategory: true },
    });

    const metrics = calculateInventoryRunout(updated, updated.purchases);
    res.json({
      ...updated,
      metrics,
    });
  }),
);

inventoryRouter.delete(
  '/:itemId',
  asyncHandler(async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const existing = await prisma.inventoryItem.findFirst({ where: { id: itemId, userId: req.user!.id } });

    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventory item not found' });
    }

    await prisma.inventoryItem.delete({ where: { id: itemId } });
    res.status(204).send();
  }),
);

inventoryRouter.get(
  '/:itemId/purchases',
  asyncHandler(async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, userId: req.user!.id } });
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventory item not found' });
    }

    const purchases = await prisma.inventoryPurchase.findMany({
      where: { inventoryItemId: itemId },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json(purchases);
  }),
);

inventoryRouter.post(
  '/:itemId/purchases',
  asyncHandler(async (req, res) => {
    const { itemId } = req.params as { itemId: string };
    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, userId: req.user!.id } });
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Inventory item not found' });
    }

    const { quantity, cost, purchasedAt, notes } = req.body as {
      quantity?: number | string;
      cost?: number | string;
      purchasedAt?: string;
      notes?: string;
    };

    if (quantity === undefined) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'quantity is required' });
    }

    if (!purchasedAt) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'purchasedAt is required' });
    }

    const purchaseDate = new Date(purchasedAt);
    if (Number.isNaN(purchaseDate.getTime())) {
      return res.status(400).json({ error: 'INVALID_BODY', message: 'purchasedAt must be a valid date' });
    }

    const purchase = await prisma.inventoryPurchase.create({
      data: {
        inventoryItemId: item.id,
        quantity: parseDecimal(quantity, 'quantity'),
        cost: parseOptionalDecimal(cost, 'cost'),
        purchasedAt: purchaseDate,
        notes: notes ?? null,
      },
    });

    const updatedItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { id: itemId },
      include: { purchases: { orderBy: { purchasedAt: 'asc' } }, category: true, subcategory: true },
    });

    const metrics = calculateInventoryRunout(updatedItem, updatedItem.purchases);

    res.status(201).json({
      purchase,
      item: {
        ...updatedItem,
        metrics,
      },
    });
  }),
);
