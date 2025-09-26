import {
  getCurrentPeriodInfo,
  getWeekDates,
  isDateInPeriod,
  getCurrentPeriodNumber,
} from '@/utils/dateUtils'

describe('dateUtils', () => {
  const PERIOD_START_2024 = new Date('2024-10-05')

  describe('getCurrentPeriodInfo', () => {
    it('should return correct period info for a date in period 11', () => {
      const testDate = new Date('2024-10-10') // 5 days after start, should be period 11
      const result = getCurrentPeriodInfo(testDate)

      expect(result.periodNumber).toBe(11)
      expect(result.weekInPeriod).toBeGreaterThan(0)
      expect(result.weekInPeriod).toBeLessThanOrEqual(4)
      expect(result.dayInWeek).toBeGreaterThan(0)
      expect(result.dayInWeek).toBeLessThanOrEqual(7)
    })

    it('should calculate period numbers correctly over time', () => {
      const testDate1 = new Date('2024-10-10') // Period 11
      const testDate2 = new Date('2024-11-10') // Should be period 12

      const result1 = getCurrentPeriodInfo(testDate1)
      const result2 = getCurrentPeriodInfo(testDate2)

      expect(result1.periodNumber).toBe(11)
      expect(result2.periodNumber).toBeGreaterThan(11)
    })

    it('should use current date when no date provided', () => {
      const result = getCurrentPeriodInfo()

      expect(result).toHaveProperty('periodNumber')
      expect(result).toHaveProperty('weekInPeriod')
      expect(result).toHaveProperty('dayInWeek')
      expect(result).toHaveProperty('periodStartDate')
      expect(result).toHaveProperty('periodEndDate')
    })
  })

  describe('getWeekDates', () => {
    it('should return correct week start and end dates', () => {
      const testDate = new Date('2024-10-08') // Tuesday, should be in first week
      const result = getWeekDates(testDate)

      expect(result.weekStart).toEqual(PERIOD_START_2024)
      expect(result.weekEnd.getDay()).toBe(4) // Friday (if period starts on Saturday)
    })

    it('should handle dates in different weeks of the period', () => {
      const testDate = new Date('2024-10-15') // Second week
      const result = getWeekDates(testDate)

      const expectedWeekStart = new Date('2024-10-12')
      expect(result.weekStart).toEqual(expectedWeekStart)
      expect(result.weekEnd.getTime() - result.weekStart.getTime()).toBe(6 * 24 * 60 * 60 * 1000)
    })
  })

  describe('isDateInPeriod', () => {
    it('should return true for dates within the period', () => {
      const periodStart = new Date('2024-10-05')
      const periodEnd = new Date('2024-11-01')
      const testDate = new Date('2024-10-15')

      expect(isDateInPeriod(testDate, periodStart, periodEnd)).toBe(true)
    })

    it('should return false for dates outside the period', () => {
      const periodStart = new Date('2024-10-05')
      const periodEnd = new Date('2024-11-01')
      const testDate = new Date('2024-11-15')

      expect(isDateInPeriod(testDate, periodStart, periodEnd)).toBe(false)
    })

    it('should return true for dates exactly on period boundaries', () => {
      const periodStart = new Date('2024-10-05')
      const periodEnd = new Date('2024-11-01')

      expect(isDateInPeriod(periodStart, periodStart, periodEnd)).toBe(true)
      expect(isDateInPeriod(periodEnd, periodStart, periodEnd)).toBe(true)
    })
  })

  describe('getCurrentPeriodNumber', () => {
    it('should return the correct period number for a specific date', () => {
      const testDate = new Date('2024-10-10')
      const result = getCurrentPeriodNumber(testDate)

      expect(result).toBe(11)
    })

    it('should return the current period number when no date provided', () => {
      const result = getCurrentPeriodNumber()

      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(11) // Should be at least period 11
    })

    it('should increment period numbers correctly over time', () => {
      const date1 = new Date('2024-10-10') // Period 11
      const date2 = new Date('2024-11-10') // Later period

      const period1 = getCurrentPeriodNumber(date1)
      const period2 = getCurrentPeriodNumber(date2)

      expect(period1).toBe(11)
      expect(period2).toBeGreaterThan(period1)
    })
  })
})