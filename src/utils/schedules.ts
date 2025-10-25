import { ScheduleType } from '@prisma/client';
import { clampDayOfMonth, getBusinessDayRange, getNthBusinessDay, startOfDay } from './dates';

export interface ScheduleConfig {
  scheduleType: ScheduleType;
  dayOfMonth?: number | null;
  nthBusinessDay?: number | null;
  monthDayRangeStart?: number | null;
  monthDayRangeEnd?: number | null;
  businessDayRangeStart?: number | null;
  businessDayRangeEnd?: number | null;
  activeMonths?: number[] | null;
}

export interface ScheduleOccurrence {
  date: Date;
  endDate?: Date;
}

const isMonthActive = (monthIndexZeroBased: number, activeMonths?: number[] | null): boolean => {
  if (!activeMonths || activeMonths.length === 0) {
    return true;
  }
  const monthOneBased = monthIndexZeroBased + 1;
  return activeMonths.includes(monthOneBased);
};

export const validateScheduleConfig = (config: ScheduleConfig) => {
  const { scheduleType } = config;

  const ensureDefined = (value: number | null | undefined, field: string) => {
    if (value === null || value === undefined) {
      throw new Error(`Missing required field ${field} for schedule type ${scheduleType}`);
    }
  };

  const ensureRange = (start: number, end: number, fieldStart: string, fieldEnd: string) => {
    if (start > end) {
      throw new Error(`${fieldStart} must be less than or equal to ${fieldEnd}`);
    }
  };

  switch (scheduleType) {
    case ScheduleType.FIXED_DATE: {
      ensureDefined(config.dayOfMonth, 'dayOfMonth');
      break;
    }
    case ScheduleType.BUSINESS_DAY: {
      ensureDefined(config.nthBusinessDay, 'nthBusinessDay');
      break;
    }
    case ScheduleType.DATE_RANGE: {
      ensureDefined(config.monthDayRangeStart, 'monthDayRangeStart');
      ensureDefined(config.monthDayRangeEnd, 'monthDayRangeEnd');
      ensureRange(config.monthDayRangeStart!, config.monthDayRangeEnd!, 'monthDayRangeStart', 'monthDayRangeEnd');
      break;
    }
    case ScheduleType.BUSINESS_DAY_RANGE: {
      ensureDefined(config.businessDayRangeStart, 'businessDayRangeStart');
      ensureDefined(config.businessDayRangeEnd, 'businessDayRangeEnd');
      ensureRange(config.businessDayRangeStart!, config.businessDayRangeEnd!, 'businessDayRangeStart', 'businessDayRangeEnd');
      break;
    }
    default: {
      const exhaustiveCheck: never = scheduleType;
      throw new Error(`Unsupported schedule type ${exhaustiveCheck}`);
    }
  }

  if (config.dayOfMonth && (config.dayOfMonth < 1 || config.dayOfMonth > 31)) {
    throw new Error('dayOfMonth must be between 1 and 31');
  }

  if (config.nthBusinessDay && config.nthBusinessDay <= 0) {
    throw new Error('nthBusinessDay must be a positive integer');
  }

  if (config.monthDayRangeStart && (config.monthDayRangeStart < 1 || config.monthDayRangeStart > 31)) {
    throw new Error('monthDayRangeStart must be between 1 and 31');
  }

  if (config.monthDayRangeEnd && (config.monthDayRangeEnd < 1 || config.monthDayRangeEnd > 31)) {
    throw new Error('monthDayRangeEnd must be between 1 and 31');
  }

  if (config.businessDayRangeStart && config.businessDayRangeStart <= 0) {
    throw new Error('businessDayRangeStart must be positive');
  }

  if (config.businessDayRangeEnd && config.businessDayRangeEnd <= 0) {
    throw new Error('businessDayRangeEnd must be positive');
  }

  if (config.activeMonths) {
    const invalid = config.activeMonths.filter((month) => month < 1 || month > 12);
    if (invalid.length > 0) {
      throw new Error('activeMonths must contain values between 1 and 12');
    }
  }
};

export const generateOccurrencesWithinWindow = (
  config: ScheduleConfig,
  windowStart: Date,
  windowEnd: Date,
): ScheduleOccurrence[] => {
  const normalizedStart = startOfDay(windowStart);
  const normalizedEnd = startOfDay(windowEnd);

  if (normalizedEnd < normalizedStart) {
    return [];
  }

  const occurrences: ScheduleOccurrence[] = [];
  const cursor = new Date(Date.UTC(normalizedStart.getUTCFullYear(), normalizedStart.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(normalizedEnd.getUTCFullYear(), normalizedEnd.getUTCMonth(), 1));

  while (cursor <= limit) {
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();

    if (!isMonthActive(monthIndex, config.activeMonths ?? undefined)) {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      continue;
    }

    let occurrence: ScheduleOccurrence | undefined;

    switch (config.scheduleType) {
      case ScheduleType.FIXED_DATE: {
        const day = clampDayOfMonth(year, monthIndex, config.dayOfMonth!);
        occurrence = { date: day };
        break;
      }
      case ScheduleType.BUSINESS_DAY: {
        const businessDay = getNthBusinessDay(year, monthIndex, config.nthBusinessDay!);
        occurrence = { date: businessDay };
        break;
      }
      case ScheduleType.DATE_RANGE: {
        const start = clampDayOfMonth(year, monthIndex, config.monthDayRangeStart!);
        const end = clampDayOfMonth(year, monthIndex, config.monthDayRangeEnd!);
        occurrence = { date: start, endDate: end };
        break;
      }
      case ScheduleType.BUSINESS_DAY_RANGE: {
        const { start, end } = getBusinessDayRange(year, monthIndex, config.businessDayRangeStart!, config.businessDayRangeEnd!);
        occurrence = { date: start, endDate: end };
        break;
      }
      default:
        break;
    }

    if (occurrence) {
      const occurrenceDate = startOfDay(occurrence.date);
      const inRange = occurrenceDate >= normalizedStart && occurrenceDate <= normalizedEnd;
      const overlapsRange = occurrence.endDate
        ? startOfDay(occurrence.endDate) >= normalizedStart && occurrenceDate <= normalizedEnd
        : inRange;

      if (inRange || overlapsRange) {
        occurrences.push(occurrence);
      }
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());
};
