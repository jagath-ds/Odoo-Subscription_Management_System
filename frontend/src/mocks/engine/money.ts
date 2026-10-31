import { formatINR, formatINRCompact } from '@/lib/format'

/**
 * Sign-aware half-up rounding to 2 decimals, mirroring Python's Decimal('0.01')
 * with ROUND_HALF_UP so mock mode matches the backend engine exactly.
 */
export function roundHalfUp2(value: number): number {
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  return sign * (Math.round((abs + Number.EPSILON) * 100) / 100)
}

export function sumLines<T>(lines: T[], extract: (item: T) => number): number {
  const rawSum = lines.reduce((acc, line) => acc + extract(line), 0)
  return roundHalfUp2(rawSum)
}

export { formatINR, formatINRCompact }
