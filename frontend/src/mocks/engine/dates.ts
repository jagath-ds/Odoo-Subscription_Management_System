import type { BillingFrequency, DateStr } from '@/types/contracts'

function parseDate(dateStr: DateStr): [number, number, number] {
  const parts = dateStr.split('-')
  const y = Number(parts[0]) || 2026
  const m = Number(parts[1]) || 1
  const d = Number(parts[2]) || 1
  return [y, m, d]
}

function formatDate(y: number, m: number, d: number): DateStr {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${y}-${pad(m)}-${pad(d)}`
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate()
}

export function addDays(dateStr: DateStr, days: number): DateStr {
  const [y, m, d] = parseDate(dateStr)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function addWeeks(dateStr: DateStr, weeks: number): DateStr {
  return addDays(dateStr, weeks * 7)
}

/**
 * Real calendar addMonths (e.g. Jan 31 + 1 month = Feb 28, Jan 31 + 2 months = Mar 31)
 * Matches Python dateutil.relativedelta(months=+n)
 */
export function addMonths(dateStr: DateStr, months: number): DateStr {
  const [y, m, d] = parseDate(dateStr)
  const totalMonths = (y * 12 + (m - 1)) + months
  const newYear = Math.floor(totalMonths / 12)
  const newMonth1Based = (totalMonths % 12) + 1
  const maxDays = daysInMonth(newYear, newMonth1Based)
  const newDay = Math.min(d, maxDays)
  return formatDate(newYear, newMonth1Based, newDay)
}

export function addYears(dateStr: DateStr, years: number): DateStr {
  const [y, m, d] = parseDate(dateStr)
  const newYear = y + years
  const maxDays = daysInMonth(newYear, m)
  const newDay = Math.min(d, maxDays)
  return formatDate(newYear, m, newDay)
}

export function addCycle(dateStr: DateStr, freq: BillingFrequency): DateStr {
  switch (freq) {
    case 'DAILY':
      return addDays(dateStr, 1)
    case 'WEEKLY':
      return addWeeks(dateStr, 1)
    case 'MONTHLY':
      return addMonths(dateStr, 1)
    case 'YEARLY':
      return addYears(dateStr, 1)
  }
}

/**
 * Returns (dateA - dateB) in calendar days.
 * E.g. diffDays('2026-10-31', '2026-10-21') === 10
 */
export function diffDays(dateA: DateStr, dateB: DateStr): number {
  const [yA, mA, dA] = parseDate(dateA)
  const [yB, mB, dB] = parseDate(dateB)
  const utcA = Date.UTC(yA, mA - 1, dA)
  const utcB = Date.UTC(yB, mB - 1, dB)
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  return Math.round((utcA - utcB) / MS_PER_DAY)
}

export function isWithinWindow(
  dateStr: DateStr,
  validFrom: DateStr | null,
  validUntil: DateStr | null,
): boolean {
  if (validFrom && dateStr < validFrom) return false
  if (validUntil && dateStr > validUntil) return false
  return true
}
