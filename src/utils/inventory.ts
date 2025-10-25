import type { InventoryItem, InventoryPurchase } from '@prisma/client';
import { addDays, differenceInDays, startOfDay } from './dates';
import { decimalToNumber } from './serialization';

export interface InventoryRunout {
  stockOnHand: number;
  runOutDate: Date | null;
  reminderDate: Date | null;
}

const sortPurchases = (purchases: InventoryPurchase[]): InventoryPurchase[] =>
  [...purchases].sort((a, b) => new Date(a.purchasedAt).getTime() - new Date(b.purchasedAt).getTime());

export const calculateInventoryRunout = (
  item: InventoryItem,
  purchases: InventoryPurchase[],
  asOf: Date = new Date(),
): InventoryRunout => {
  const consumptionPerDay = decimalToNumber(item.consumptionPerDay) ?? 0;
  const initialQuantity = decimalToNumber(item.initialStockQuantity) ?? 0;
  const reminderAdvance = item.reminderAdvanceDays ?? 0;

  const today = startOfDay(asOf);
  let currentDate = startOfDay(item.initialStockDate ?? item.createdAt);
  let stock = initialQuantity;
  let runOutDate: Date | null = null;

  const orderedPurchases = sortPurchases(purchases);

  if (stock < 0) {
    stock = 0;
  }

  if (consumptionPerDay <= 0) {
    // No consumption configured; stock will not deplete based on schedule
    return {
      stockOnHand: stock,
      runOutDate: null,
      reminderDate: null,
    };
  }

  for (const purchase of orderedPurchases) {
    const purchaseDate = startOfDay(purchase.purchasedAt);

    if (purchaseDate > currentDate) {
      const daysBetween = differenceInDays(purchaseDate, currentDate);
      const consumptionDuring = consumptionPerDay * daysBetween;
      if (stock - consumptionDuring <= 0) {
        const daysUntilEmpty = stock / consumptionPerDay;
        runOutDate = addDays(currentDate, Math.max(0, Math.ceil(daysUntilEmpty)));
        break;
      }
      stock -= consumptionDuring;
      currentDate = purchaseDate;
    } else if (purchaseDate < currentDate) {
      currentDate = purchaseDate;
    }

    stock += decimalToNumber(purchase.quantity) ?? 0;
  }

  if (!runOutDate) {
    if (today > currentDate) {
      const daysSince = differenceInDays(today, currentDate);
      stock -= consumptionPerDay * daysSince;
      currentDate = today;
    }

    if (stock <= 0) {
      runOutDate = today;
    } else {
      const daysUntilEmpty = stock / consumptionPerDay;
      runOutDate = addDays(currentDate, Math.max(0, Math.ceil(daysUntilEmpty)));
    }
  }

  const reminderDate = runOutDate ? addDays(runOutDate, -reminderAdvance) : null;

  return {
    stockOnHand: Math.max(0, Number(stock.toFixed(4))),
    runOutDate,
    reminderDate,
  };
};
