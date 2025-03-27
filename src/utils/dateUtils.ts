const PERIOD_START_2024 = new Date('2024-10-05');
const WEEKS_PER_PERIOD = 4;
const DAYS_PER_WEEK = 7;

export function getCurrentPeriodInfo(date = new Date()) {
  const timeDiff = date.getTime() - PERIOD_START_2024.getTime();
  const daysSinceStart = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  const periodNumber = Math.floor(daysSinceStart / (WEEKS_PER_PERIOD * DAYS_PER_WEEK)) + 11; // Starting from period 11
  const weekInPeriod = Math.floor((daysSinceStart % (WEEKS_PER_PERIOD * DAYS_PER_WEEK)) / DAYS_PER_WEEK) + 1;
  const dayInWeek = (daysSinceStart % DAYS_PER_WEEK) + 1;

  const periodStartDate = new Date(PERIOD_START_2024.getTime() + (periodNumber - 11) * WEEKS_PER_PERIOD * DAYS_PER_WEEK * 24 * 60 * 60 * 1000);
  const periodEndDate = new Date(periodStartDate.getTime() + WEEKS_PER_PERIOD * DAYS_PER_WEEK * 24 * 60 * 60 * 1000 - 1);

  return {
    periodNumber,
    weekInPeriod,
    dayInWeek,
    periodStartDate,
    periodEndDate
  };
}

export function getWeekDates(date = new Date()) {
  const { periodStartDate } = getCurrentPeriodInfo(date);
  const daysSinceStart = Math.floor((date.getTime() - periodStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const weekStartOffset = daysSinceStart - (daysSinceStart % 7);
  
  const weekStart = new Date(periodStartDate.getTime() + weekStartOffset * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

  return { weekStart, weekEnd };
}

export function isDateInPeriod(date: Date, periodStartDate: Date, periodEndDate: Date) {
  return date >= periodStartDate && date <= periodEndDate;
}

export function getCurrentPeriodNumber(date = new Date()): number {
  const { periodNumber } = getCurrentPeriodInfo(date);
  return periodNumber;
}
