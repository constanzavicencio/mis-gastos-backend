import { Prisma, ScheduleType } from '@prisma/client';
import type { ScheduleConfig } from './schedules';
import { validateScheduleConfig } from './schedules';

export const parseDecimal = (value: unknown, field: string): Prisma.Decimal => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`${field} must be a finite number`);
    }
    return new Prisma.Decimal(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0 || Number.isNaN(Number(trimmed))) {
      throw new Error(`${field} must be a valid number`);
    }
    return new Prisma.Decimal(trimmed);
  }

  throw new Error(`${field} must be a number`);
};

export const parseOptionalDecimal = (value: unknown, field: string): Prisma.Decimal | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return parseDecimal(value, field);
};

export const parseOptionalNumber = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} must be numeric`);
  }
  return parsed;
};

export const parseOptionalInt = (value: unknown, field: string): number | null => {
  const parsed = parseOptionalNumber(value, field);
  if (parsed === null) {
    return null;
  }
  if (!Number.isInteger(parsed)) {
    throw new Error(`${field} must be an integer`);
  }
  return parsed;
};

export const parseOptionalIntArray = (value: unknown, field: string): number[] | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  const parsed = value.map((item, index) => {
    if (typeof item !== 'number' || !Number.isInteger(item)) {
      throw new Error(`${field}[${index}] must be an integer`);
    }
    return item;
  });
  return parsed;
};

export interface SchedulePayload {
  scheduleType: ScheduleType;
  dayOfMonth?: number | null;
  nthBusinessDay?: number | null;
  monthDayRangeStart?: number | null;
  monthDayRangeEnd?: number | null;
  businessDayRangeStart?: number | null;
  businessDayRangeEnd?: number | null;
  activeMonths?: number[] | null;
}

export const validateSchedulePayload = (payload: SchedulePayload) => {
  const config: ScheduleConfig = {
    scheduleType: payload.scheduleType,
    dayOfMonth: payload.dayOfMonth ?? null,
    nthBusinessDay: payload.nthBusinessDay ?? null,
    monthDayRangeStart: payload.monthDayRangeStart ?? null,
    monthDayRangeEnd: payload.monthDayRangeEnd ?? null,
    businessDayRangeStart: payload.businessDayRangeStart ?? null,
    businessDayRangeEnd: payload.businessDayRangeEnd ?? null,
    activeMonths: payload.activeMonths ?? null,
  };

  validateScheduleConfig(config);
};
