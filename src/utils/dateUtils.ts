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

  const periodNumber =
    Math.floor(daysSinceStart / (WEEKS_PER_PERIOD * DAYS_PER_WEEK)) + 11; // Starting from period 11
  const daysIntoPeriod = daysSinceStart % (WEEKS_PER_PERIOD * DAYS_PER_WEEK);
  const weekInPeriod = Math.floor(daysIntoPeriod / DAYS_PER_WEEK) + 1;
  const dayInWeek = (daysIntoPeriod % DAYS_PER_WEEK) + 1;

  const periodStartDate = new Date(
    normalizedPeriodStart.getTime() +
      (periodNumber - 11) *
        WEEKS_PER_PERIOD *
        DAYS_PER_WEEK *
        24 *
        60 *
        60 *
        1000,
  );
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setDate(
    periodEndDate.getDate() + WEEKS_PER_PERIOD * DAYS_PER_WEEK - 1,
  );
  periodEndDate.setHours(23, 59, 59, 999);

  return {
    periodNumber,
    weekInPeriod,
    dayInWeek,
    periodStartDate,
    periodEndDate,
  };
}

export function getWeekDates(date = new Date()) {
  const { periodStartDate } = getCurrentPeriodInfo(date);
  const daysSinceStart = Math.floor(
    (date.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const weekStartOffset = daysSinceStart - (daysSinceStart % 7);

  const weekStart = new Date(
    periodStartDate.getTime() + weekStartOffset * 24 * 60 * 60 * 1000,
  );
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  weekEnd.setHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}

export function isDateInPeriod(
  date: Date,
  periodStartDate: Date,
  periodEndDate: Date,
) {
  return date >= periodStartDate && date <= periodEndDate;
}

export function getCurrentPeriodNumber(date = new Date()): number {
  const { periodNumber } = getCurrentPeriodInfo(date);
  return periodNumber;
}

/**
 * Get the date range for a specific period number
 * @param periodNumber The period number (11-25)
 * @returns Object with periodStartDate, periodEndDate, and period metadata
 */
export function getPeriodDateRange(periodNumber: number): {
  periodNumber: number;
  periodStartDate: Date;
  periodEndDate: Date;
  label: string;
} {
  const normalizedPeriodStart = toLocalMidnight(PERIOD_START_2024);

  // Calculate the start date for this period
  const daysFromStart = (periodNumber - 11) * WEEKS_PER_PERIOD * DAYS_PER_WEEK;
  const periodStartDate = new Date(
    normalizedPeriodStart.getTime() + daysFromStart * 24 * 60 * 60 * 1000,
  );

  // Calculate end date (28 days later, minus 1 day, end of day)
  const periodEndDate = new Date(periodStartDate);
  periodEndDate.setDate(
    periodEndDate.getDate() + WEEKS_PER_PERIOD * DAYS_PER_WEEK - 1,
  );
  periodEndDate.setHours(23, 59, 59, 999);

  // Create a human-readable label
  const startMonth = periodStartDate.toLocaleDateString("es-ES", {
    month: "short",
    day: "numeric",
  });
  const endMonth = periodEndDate.toLocaleDateString("es-ES", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const label = `${startMonth} - ${endMonth}`;

  return {
    periodNumber,
    periodStartDate,
    periodEndDate,
    label,
  };
}

/**
 * Get all available periods from the start (period 11) to current period
 * @returns Array of period objects with their date ranges
 */
export function getAllPeriods(): Array<{
  periodNumber: number;
  periodStartDate: Date;
  periodEndDate: Date;
  label: string;
  isCurrent: boolean;
  isCompleted: boolean;
}> {
  const currentPeriod = getCurrentPeriodNumber();
  const periods = [];

  // Generate periods from 11 to current period
  for (let p = 11; p <= currentPeriod; p++) {
    const periodInfo = getPeriodDateRange(p);
    const now = new Date();

    periods.push({
      ...periodInfo,
      isCurrent: p === currentPeriod,
      isCompleted: periodInfo.periodEndDate < now,
    });
  }

  return periods;
}

/**
 * Get week breakdown for a specific period
 * @param periodNumber The period number
 * @returns Array of 4 weeks with their date ranges
 */
export function getPeriodWeeks(periodNumber: number): Array<{
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  label: string;
}> {
  const { periodStartDate } = getPeriodDateRange(periodNumber);
  const weeks = [];

  for (let w = 0; w < WEEKS_PER_PERIOD; w++) {
    const weekStart = new Date(
      periodStartDate.getTime() + w * DAYS_PER_WEEK * 24 * 60 * 60 * 1000,
    );
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(
      weekStart.getTime() + (DAYS_PER_WEEK - 1) * 24 * 60 * 60 * 1000,
    );
    weekEnd.setHours(23, 59, 59, 999);

    const startLabel = weekStart.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
    const endLabel = weekEnd.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });

    weeks.push({
      weekNumber: w + 1,
      weekStart,
      weekEnd,
      label: `S${w + 1}: ${startLabel} - ${endLabel}`,
    });
  }

  return weeks;
}

/**
 * Get default date range for current year
 */
export function getCurrentYearDateRange(): {
  dateFrom: string;
  dateTo: string;
} {
  const currentYear = new Date().getFullYear();
  const dateFrom = `${currentYear}-01-01`;
  const dateTo = new Date().toISOString().split("T")[0];
  return { dateFrom, dateTo };
}

/**
 * Parse and validate date range, returning Date objects
 * If no dates provided, defaults to current year
 */
export function parseDateRange(
  dateFrom?: string,
  dateTo?: string,
): { fromDate: Date; toDate: Date } {
  const { dateFrom: defaultFrom, dateTo: defaultTo } =
    getCurrentYearDateRange();

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
  const { dateFrom: defaultFrom, dateTo: defaultTo } =
    getCurrentYearDateRange();

  if (!dateFrom && !dateTo) {
    return "Año actual";
  }

  return `${dateFrom || defaultFrom} al ${dateTo || defaultTo}`;
}

/**
 * Debounce function for delaying execution
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}
