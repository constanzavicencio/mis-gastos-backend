export const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const endOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

export const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const differenceInDays = (a: Date, b: Date): number => {
  const diffMs = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const clampDayOfMonth = (year: number, monthIndex: number, day: number): Date => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(day, 1), lastDay);
  return new Date(Date.UTC(year, monthIndex, safeDay));
};

export const isBusinessDay = (date: Date): boolean => {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6; // Sunday=0, Saturday=6
};

export const getNthBusinessDay = (year: number, monthIndex: number, nth: number): Date => {
  if (nth <= 0) {
    throw new Error('nth business day must be positive');
  }

  let businessDaysCounted = 0;
  let currentDate = new Date(Date.UTC(year, monthIndex, 1));

  while (true) {
    if (isBusinessDay(currentDate)) {
      businessDaysCounted += 1;
      if (businessDaysCounted === nth) {
        return currentDate;
      }
    }
    currentDate = addDays(currentDate, 1);
  }
};

export const getBusinessDayRange = (year: number, monthIndex: number, startNth: number, endNth: number): { start: Date; end: Date } => {
  if (startNth > endNth) {
    throw new Error('start business day must be before or equal to end');
  }

  const start = getNthBusinessDay(year, monthIndex, startNth);
  const end = getNthBusinessDay(year, monthIndex, endNth);
  return { start, end };
};

export const monthRangeFromIso = (monthIso: string): { start: Date; end: Date } => {
  const [yearStr, monthStr] = monthIso.split('-');
  if (!yearStr || !monthStr) {
    throw new Error('Month must be in YYYY-MM format');
  }
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Invalid month provided');
  }

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1));
  return { start, end };
};
