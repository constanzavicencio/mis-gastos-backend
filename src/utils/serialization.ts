import type { Prisma } from '@prisma/client';

export const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value.toString());
};

export const decimalToString = (value: Prisma.Decimal | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toString();
};

