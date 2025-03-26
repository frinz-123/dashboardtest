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
  // Add verbose debug logging for ventasmochis user
  try {
    // Convert to timestamps for easier comparison
    const dateTimestamp = date.getTime();
    const startTimestamp = periodStartDate.getTime();
    const endTimestamp = periodEndDate.getTime();
    
    // Debug only a sample of calls to avoid console flooding
    const shouldLog = Math.random() < 0.01; // Log approximately 1% of calls
    
    if (shouldLog) {
      console.log('DEBUG - isDateInPeriod details:', {
        dateISO: date.toISOString(),
        periodStartISO: periodStartDate.toISOString(),
        periodEndISO: periodEndDate.toISOString(),
        dateTimestamp: dateTimestamp,
        startTimestamp: startTimestamp, 
        endTimestamp: endTimestamp,
        isAfterStart: dateTimestamp >= startTimestamp,
        isBeforeEnd: dateTimestamp <= endTimestamp,
        isInPeriod: dateTimestamp >= startTimestamp && dateTimestamp <= endTimestamp
      });
    }
    
    return dateTimestamp >= startTimestamp && dateTimestamp <= endTimestamp;
  } catch (error) {
    console.error('ERROR in isDateInPeriod:', error, {
      date: date,
      periodStartDate: periodStartDate,
      periodEndDate: periodEndDate
    });
    return false; // Default to excluding dates that cause errors
  }
}

export function getCurrentPeriodNumber(date = new Date()): number {
  const { periodNumber } = getCurrentPeriodInfo(date);
  return periodNumber;
}
