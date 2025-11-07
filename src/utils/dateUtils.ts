// Create period start at local midnight, not UTC
const PERIOD_START_2024 = new Date(2024, 9, 5); // October 5, 2024 (month is 0-indexed)
const WEEKS_PER_PERIOD = 4;
const DAYS_PER_WEEK = 7;

// Helper to normalize a date to local midnight
function toLocalMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function getCurrentPeriodInfo(date = new Date()) {
  const normalizedDate = toLocalMidnight(date);
  const normalizedPeriodStart = toLocalMidnight(PERIOD_START_2024);

  const timeDiff = normalizedDate.getTime() - normalizedPeriodStart.getTime();
  const daysSinceStart = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

  const periodNumber = Math.floor(daysSinceStart / (WEEKS_PER_PERIOD * DAYS_PER_WEEK)) + 11; // Starting from period 11
  const daysIntoPeriod = daysSinceStart % (WEEKS_PER_PERIOD * DAYS_PER_WEEK);
  const weekInPeriod = Math.floor(daysIntoPeriod / DAYS_PER_WEEK) + 1;
  const dayInWeek = (daysIntoPeriod % DAYS_PER_WEEK) + 1;

  const periodStartDate = new Date(normalizedPeriodStart.getTime() + (periodNumber - 11) * WEEKS_PER_PERIOD * DAYS_PER_WEEK * 24 * 60 * 60 * 1000);
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setDate(periodEndDate.getDate() + (WEEKS_PER_PERIOD * DAYS_PER_WEEK) - 1);
  periodEndDate.setHours(23, 59, 59, 999);

  return {
    periodNumber,
    weekInPeriod,
    dayInWeek,
    periodStartDate,
    periodEndDate
  };
}

export function getWeekDates(date = new Date()) {
  const { periodStartDate, weekInPeriod } = getCurrentPeriodInfo(date);

  // Calculate week start based on which week we're in within the period
  const weekStart = new Date(periodStartDate);
  weekStart.setDate(weekStart.getDate() + (weekInPeriod - 1) * DAYS_PER_WEEK);
  weekStart.setHours(0, 0, 0, 0);

  // Week end is 6 days after week start (inclusive of 7 days total)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

export function isDateInPeriod(date: Date, periodStartDate: Date, periodEndDate: Date) {
  return date >= periodStartDate && date <= periodEndDate;
}

export function getCurrentPeriodNumber(date = new Date()): number {
  const { periodNumber } = getCurrentPeriodInfo(date);
  return periodNumber;
}

/**
 * Get default date range for current year
 */
export function getCurrentYearDateRange(): { dateFrom: string; dateTo: string } {
  const currentYear = new Date().getFullYear();
  const dateFrom = `${currentYear}-01-01`;
  const dateTo = new Date().toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

/**
 * Parse and validate date range, returning Date objects
 * If no dates provided, defaults to current year
 */
export function parseDateRange(dateFrom?: string, dateTo?: string): { fromDate: Date; toDate: Date } {
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getCurrentYearDateRange();

  const fromDate = dateFrom ? new Date(dateFrom) : new Date(defaultFrom);
  const toDate = dateTo ? new Date(dateTo) : new Date(defaultTo);

  // Set time to end of day for toDate to include the entire day
  toDate.setHours(23, 59, 59, 999);

  return { fromDate, toDate };
}

/**
 * Format date range for display
 */
export function formatDateRange(dateFrom?: string, dateTo?: string): string {
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getCurrentYearDateRange();

  if (!dateFrom && !dateTo) {
    return 'Año actual';
  }

  return `${dateFrom || defaultFrom} al ${dateTo || defaultTo}`;
}

/**
 * Debounce function for delaying execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function(this: any, ...args: Parameters<T>) {
    const context = this;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}
